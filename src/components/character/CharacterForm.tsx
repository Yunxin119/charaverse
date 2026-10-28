'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Check, Globe, Loader2, MessageSquareQuote, Palette, PanelRightClose, PanelRightOpen, Save, ScrollText, Sparkles, UserRound, Users } from 'lucide-react'
import { supabase, type Character } from '@/app/lib/supabase'
import { deleteAvatar } from '@/app/lib/avatarUpload'
import { useAuth } from '@/providers/AuthProvider'
import { qk } from '@/queries/keys'
import { useSavePersona } from '@/queries/usePersonas'
import { estimateTokens } from '@/lib/prompt/tokens'
import { Button } from '@/components/ui/button'
import { Chip, GlassPanel, GlassSheet, GlassSheetContent, IconButton } from '@/components/glass'
import { PublishSection } from '@/components/character/PublishSection'
import { DocumentNav, type DocSection } from './form/DocumentNav'
import { SectionHeader } from './form/Field'
import { IdentitySection } from './form/IdentitySection'
import { CoreSection } from './form/CoreSection'
import { OpeningSection } from './form/OpeningSection'
import { RulesSection } from './form/RulesSection'
import { PersonaSection } from './form/PersonaSection'
import { LorebookSection } from './form/LorebookSection'
import { PreviewDock } from './preview/PreviewDock'
import { buildPromptTemplate, draftFromCharacter, emptyDraft, emptyPersona, personaHasContent, validateDraft, type CharacterDraft, type DraftErrors } from './form/types'

export type { CharacterDraft } from './form/types'

interface Props {
  mode: 'create' | 'edit'
  character?: Character
}

const NO_ERRORS: DraftErrors = {}
const SECTION_IDS = ['identity', 'core', 'opening', 'rules', 'persona', 'lorebook', 'publish'] as const
type SectionId = (typeof SECTION_IDS)[number]
/** old `?section=` values from links and bookmarks */
const LEGACY_SECTION: Record<string, SectionId> = { basic: 'identity', modules: 'core', extras: 'core', skin: 'publish' }
const XL_QUERY = '(min-width: 1280px)' // tailwind `xl`: where the preview fits beside the page

/**
 * Preview dock state: open by default where it fits beside the page (xl), closed below,
 * and re-synced whenever the viewport crosses that line; the toolbar button toggles it.
 */
function useDock(): { isXl: boolean; dock: boolean; setDock: (v: boolean | ((d: boolean) => boolean)) => void } {
  const [isXl, setXl] = useState(false)
  const [dock, setDock] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(XL_QUERY)
    const sync = () => { setXl(mq.matches); setDock(mq.matches) }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return { isXl, dock, setDock }
}

const tokensOf = (...parts: string[]) => estimateTokens(parts.filter((p) => p.trim()).join('\n'))
const tokMeta = (n: number) => (n > 0 ? `≈${n}` : undefined)

/**
 * Create / edit a character card as one document: a cover (avatar + name), then the
 * card's sections in writing order with an anchor rail on the left, and a preview dock on
 * the right (the assembled prompt with token estimates, or a scratch 「试聊」) that can be
 * tucked away to widen the page. Mount with `key={character.id}` in edit mode so a different
 * character resets the draft.
 */
export function CharacterForm({ mode, character }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editing = mode === 'edit' && !!character
  const { isXl, dock, setDock } = useDock()

  const initial = useMemo(() => (character ? draftFromCharacter(character) : emptyDraft()), [character])
  const [draft, setDraft] = useState<CharacterDraft>(initial)
  const [baseline, setBaseline] = useState<CharacterDraft>(initial)
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<SectionId>('identity')

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline])
  const errors = useMemo(() => validateDraft(draft), [draft])
  const shown = submitted ? errors : NO_ERRORS

  const set = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  // --- anchor navigation: the rail follows the scroll position; `?section=` deep-links ---
  const scrollTo = (id: SectionId) => {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }
  const deepLinked = useRef(false)
  useEffect(() => {
    if (deepLinked.current || mode !== 'edit') return
    deepLinked.current = true
    const q = new URLSearchParams(window.location.search).get('section')
    const id = q && (SECTION_IDS as readonly string[]).includes(q) ? (q as SectionId) : q ? LEGACY_SECTION[q] : undefined
    if (id) setTimeout(() => scrollTo(id), 50)
  }, [mode])
  useEffect(() => {
    const els = SECTION_IDS.map((id) => document.getElementById(`sec-${id}`)).filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActive(visible[0].target.id.replace('sec-', '') as SectionId)
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [editing])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = useMutation({
    mutationFn: async (d: CharacterDraft) => {
      if (!user) throw new Error('请先登录')
      const prompt_template = buildPromptTemplate(d, character?.prompt_template)
      // the embedded world book lives in its own jsonb column, not inside prompt_template
      const row = { name: d.name.trim(), avatar_url: d.avatar_url || null, prompt_template, lorebook: d.lorebook }
      if (!editing || !character) {
        const { data, error } = await supabase.from('characters').insert({ user_id: user.id, ...row, is_public: false }).select('id').single()
        if (error) throw error
        return { id: Number(data.id), created: true }
      }
      const { error } = await supabase.from('characters').update({ ...row, updated_at: new Date().toISOString() }).eq('id', character.id).eq('user_id', user.id)
      if (error) throw error
      return { id: character.id, created: false }
    },
    onSuccess: ({ id, created }, d) => {
      qc.invalidateQueries({ queryKey: qk.character(id) })
      if (user) qc.invalidateQueries({ queryKey: qk.characters(user.id) })
      const old = baseline.avatar_url
      if (!created && old && old !== d.avatar_url) void deleteAvatar(old)
      setBaseline(d)
      if (created) {
        router.replace(`/characters/${id}/edit`)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 1600)
      }
    },
    onError: (e) => setError((e as Error).message || '保存失败，请重试'),
  })

  const submit = () => {
    setSubmitted(true)
    setError(null)
    if (errors.name) { scrollTo('identity'); return }
    if (errors.content) { scrollTo('core'); return }
    save.mutate(draft)
  }
  const back = () => { if (!dirty || confirm('有未保存的修改，确定离开？')) router.back() }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty && !save.isPending) submit()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // legacy in-card persona → 「我的人设」
  const savePersona = useSavePersona(user?.id)
  const saveLegacyPersona = async () => {
    const p = draft.persona
    try {
      await savePersona.mutateAsync({ name: p.name.trim() || '我', age: p.age, gender: p.gender, details: p.details })
      toast.success('已存到「我的人设」，可以把卡里的这段清掉了')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    }
  }
  const legacyPersona = personaHasContent(draft.persona)

  const sections: DocSection[] = [
    { id: 'identity', label: '身份', icon: UserRound, error: !!shown.name },
    { id: 'core', label: '设定', icon: Sparkles, error: !!shown.content, meta: tokMeta(tokensOf(draft.description, draft.personality, draft.scenario, ...draft.extras.map((e) => e.content))) },
    { id: 'opening', label: '开场', icon: MessageSquareQuote, meta: tokMeta(tokensOf(draft.initialMessage, ...draft.alternateGreetings, draft.exampleDialogue)) },
    { id: 'rules', label: '规则', icon: ScrollText, meta: tokMeta(tokensOf(draft.systemPrompt, draft.postHistory)) },
    ...(legacyPersona ? [{ id: 'persona' as const, label: '卡内人设', icon: Users, meta: '旧' }] : []),
    { id: 'lorebook', label: '世界书', icon: BookOpen, meta: draft.lorebook.entries.length ? String(draft.lorebook.entries.length) : undefined },
    { id: 'publish', label: '发布', icon: Globe, meta: editing && character?.is_public ? '公开' : undefined },
  ]

  const title = editing ? (draft.name.trim() || character?.name || '编辑角色') : '新建角色'
  const canSave = dirty && !save.isPending
  const dockPanel = <PreviewDock draft={draft} className="min-h-0 flex-1" />

  return (
    <form className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
      {/* sticky bar: actions, and on small screens the section tabs */}
      <div className="sticky top-0 z-20 -mt-1 pt-1 pb-3">
        <GlassPanel strength="strong" padding="none" className="space-y-2 px-2 py-2 sm:px-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <IconButton label="返回" variant="ghost" size="sm" onClick={back}><ArrowLeft /></IconButton>
            <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold leading-tight sm:text-xl">{title}</h1>
            {dirty ? <Chip tone="warning" title="⌘S 保存">未保存</Chip> : saved ? <Chip tone="success">已保存</Chip> : null}
            {editing && character && (
              <Button asChild type="button" variant="ghost" size="sm" title="打开皮肤编辑器">
                <Link href={`/characters/${character.id}/skin`}><Palette /><span className="hidden sm:inline">皮肤</span></Link>
              </Button>
            )}
            <Button type="button" variant={dock ? 'neu' : 'ghost'} size="sm" aria-pressed={dock} onClick={() => setDock((v) => !v)} title={dock ? '收起预览' : '打开预览：模型会看到什么 / 试聊'}>
              {dock ? <PanelRightClose /> : <PanelRightOpen />}<span className="hidden sm:inline">预览</span>
            </Button>
            <Button type="submit" size="sm" disabled={!canSave} title="保存（⌘S）">
              {save.isPending ? <Loader2 className="animate-spin" /> : saved && !dirty ? <Check /> : <Save />}
              {save.isPending ? '保存中' : '保存'}
            </Button>
          </div>
          <div className="lg:hidden">
            <DocumentNav variant="tabs" sections={sections} active={active} onSelect={(id) => scrollTo(id as SectionId)} />
          </div>
        </GlassPanel>
        {error && <p role="alert" className="mt-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-danger)_12%,transparent)] px-3 py-2 text-sm text-cv-danger">{error}</p>}
      </div>

      <div className={dock && isXl ? 'grid gap-6 lg:grid-cols-[150px_minmax(0,1fr)] xl:grid-cols-[150px_minmax(0,1fr)_minmax(360px,420px)]' : 'grid gap-6 lg:grid-cols-[150px_minmax(0,1fr)]'}>
        <aside className="hidden lg:block">
          <DocumentNav variant="rail" sections={sections} active={active} onSelect={(id) => scrollTo(id as SectionId)} />
        </aside>

        {/* the document: a comfortable measure, centred in whatever room the dock leaves */}
        <div className="mx-auto w-full min-w-0 max-w-3xl space-y-12 pb-28">
          <section id="sec-identity" aria-label="身份" className="scroll-mt-28">
            <IdentitySection draft={draft} errors={shown} onChange={set} />
          </section>
          <Section id="core" index="01" title="设定" description="描述、性格、场景是提示词的主体，每一块都以独立标签注入。">
            <CoreSection draft={draft} errors={shown} onChange={set} />
          </Section>
          <Section id="opening" index="02" title="开场" description="角色的第一句话，以及教模型说话方式的示例。">
            <OpeningSection value={draft.initialMessage} onChange={(v) => set('initialMessage', v)} alternates={draft.alternateGreetings} onAlternatesChange={(v) => set('alternateGreetings', v)} exampleDialogue={draft.exampleDialogue} onExampleDialogueChange={(v) => set('exampleDialogue', v)} />
          </Section>
          <Section id="rules" index="03" title="规则" description="希望模型遵守的东西。系统提示一直在；后置指令贴在历史后面，更有力。">
            <RulesSection draft={draft} onChange={set} />
          </Section>
          {legacyPersona && (
            <Section id="persona" title="卡内人设" badge={<Chip tone="warning">旧</Chip>} description="用户人设现在在「我的人设」里统一管理，跟着玩家走、不随卡分享。这段只在玩家没选任何人设时兜底。"
              action={
                <span className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="neu" disabled={savePersona.isPending} onClick={() => void saveLegacyPersona()}>
                    {savePersona.isPending ? <Loader2 className="animate-spin" /> : <UserRound />} 存为我的人设
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => set('persona', emptyPersona())}>清空</Button>
                </span>
              }>
              <PersonaSection value={draft.persona} onChange={(v) => set('persona', v)} />
            </Section>
          )}
          <Section id="lorebook" index="04" title="世界书" description="随角色一起保存的背景设定。关键词出现在最近几条消息里时注入对应条目；常驻条目总是注入。">
            <LorebookSection value={draft.lorebook} onChange={(v) => set('lorebook', v)} characterName={draft.name.trim() || undefined} />
          </Section>
          <Section id="publish" index="05" title="发布" description="发布会冻结一份当前内容给其他人看；之后的修改要再次发布才会公开。">
            {editing && character ? (
              <PublishSection character={character} draft={{ name: draft.name, avatar_url: draft.avatar_url || null, prompt_template: buildPromptTemplate(draft, character.prompt_template) }} />
            ) : (
              <p className="text-sm text-cv-fg-muted">保存角色后就可以在这里发布到探索页。</p>
            )}
          </Section>
        </div>

        {dock && isXl && (
          <aside>
            <GlassPanel className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col">
              {dockPanel}
            </GlassPanel>
          </aside>
        )}
      </div>

      {!isXl && (
        <GlassSheet open={dock} onOpenChange={setDock}>
          <GlassSheetContent side="right" title="预览" className="sm:w-[min(520px,calc(100%-1.5rem))] [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col">
            {dockPanel}
          </GlassSheetContent>
        </GlassSheet>
      )}
    </form>
  )
}

/** Stable component (defined outside the form) so typing never remounts a section. */
function Section({ id, index, title, description, badge, action, children }: { id: SectionId; index?: string; title: string; description?: string; badge?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={`sec-${id}`} aria-labelledby={`sec-${id}-title`} className="scroll-mt-28 border-t border-cv-border pt-10">
      <SectionHeader id={`sec-${id}-title`} index={index} title={title} description={description} badge={badge} action={action} />
      {children}
    </section>
  )
}
