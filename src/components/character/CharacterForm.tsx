'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Check, Eye, Globe, Layers, Loader2, MessageSquareQuote, Palette, Save, ScrollText, Sparkles, UserRound, Users } from 'lucide-react'
import { supabase, type Character } from '@/app/lib/supabase'
import { deleteAvatar } from '@/app/lib/avatarUpload'
import { useAuth } from '@/providers/AuthProvider'
import { qk } from '@/queries/keys'
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
import { ExtrasSection } from './form/ExtrasSection'
import { LorebookSection } from './form/LorebookSection'
import { SkinSection } from './form/SkinSection'
import { PreviewDock } from './preview/PreviewDock'
import { buildPromptTemplate, draftFromCharacter, emptyDraft, emptyPersona, personaHasContent, validateDraft, type CharacterDraft, type DraftErrors } from './form/types'
import { useSavePersona } from '@/queries/usePersonas'
import Link from 'next/link'

export type { CharacterDraft } from './form/types'

interface Props {
  mode: 'create' | 'edit'
  character?: Character
}

const NO_ERRORS: DraftErrors = {}
const SECTION_IDS = ['identity', 'core', 'opening', 'rules', 'persona', 'extras', 'lorebook', 'skin', 'publish'] as const
type SectionId = (typeof SECTION_IDS)[number]
const LEGACY_SECTION: Record<string, SectionId> = { basic: 'identity', modules: 'extras' }

/**
 * Create / edit a character card as one scrolling document: anchor rail on the left,
 * the card's sections in writing order, and a dock on the right that shows the assembled
 * prompt (with token estimates) or a scratch 「试聊」 against the unsaved draft.
 * Mount with `key={character.id}` in edit mode so a different character resets the draft.
 */
export function CharacterForm({ mode, character }: Props) {
  const router = useRouter()
  const { user } = useAuth()
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
  const qc = useQueryClient()
  const editing = mode === 'edit' && !!character

  const initial = useMemo(() => (character ? draftFromCharacter(character) : emptyDraft()), [character])
  const [draft, setDraft] = useState<CharacterDraft>(initial)
  const [baseline, setBaseline] = useState<CharacterDraft>(initial)
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<SectionId>('identity')
  const [dockOpen, setDockOpen] = useState(false)

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

  const sections: DocSection[] = [
    { id: 'identity', label: '身份', icon: UserRound, error: !!shown.name },
    { id: 'core', label: '设定', icon: Sparkles, error: !!shown.content },
    { id: 'opening', label: '开场', icon: MessageSquareQuote, meta: draft.initialMessage.trim() ? '✓' : undefined },
    { id: 'rules', label: '规则', icon: ScrollText, meta: draft.systemPrompt.trim() || draft.postHistory.trim() ? '✓' : undefined },
    ...(personaHasContent(draft.persona) ? [{ id: 'persona' as const, label: '卡内人设（旧）', icon: Users, meta: '!' }] : []),
    { id: 'extras', label: '补充设定', icon: Layers, meta: draft.extras.length ? String(draft.extras.length) : undefined },
    { id: 'lorebook', label: '世界书', icon: BookOpen, meta: draft.lorebook.entries.length ? String(draft.lorebook.entries.length) : undefined },
    { id: 'skin', label: '皮肤', icon: Palette },
    { id: 'publish', label: '发布', icon: Globe, meta: editing && character?.is_public ? '公开' : undefined },
  ]

  const title = editing ? (draft.name.trim() || character?.name || '编辑角色') : '新建角色'
  const canSave = dirty && !save.isPending

  return (
    <form className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
      {/* sticky bar: actions, and on small screens the section tabs */}
      <div className="sticky top-0 z-20 -mt-2 pt-2 pb-3">
        <GlassPanel strength="strong" padding="none" className="space-y-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <IconButton label="返回" variant="ghost" size="sm" onClick={back}><ArrowLeft /></IconButton>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-semibold leading-tight sm:text-xl">{title}</h1>
              <p className="hidden text-[11px] text-cv-fg-muted sm:block">{editing ? '修改只在你按「保存」后生效 · ⌘S' : '保存后可以编辑皮肤和发布'}</p>
            </div>
            {dirty ? <Chip tone="warning">未保存</Chip> : saved ? <Chip tone="success">已保存</Chip> : null}
            <Button type="button" variant="neu" size="sm" className="xl:hidden" onClick={() => setDockOpen(true)}><Eye />预览</Button>
            <Button type="submit" size="sm" disabled={!canSave}>
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

      <div className="grid gap-6 lg:grid-cols-[160px_minmax(0,1fr)] xl:grid-cols-[160px_minmax(0,1fr)_minmax(340px,400px)]">
        <aside className="hidden lg:block">
          <DocumentNav variant="rail" sections={sections} active={active} onSelect={(id) => scrollTo(id as SectionId)} />
        </aside>

        <div className="min-w-0 space-y-10 pb-24">
          <Section id="identity" title="身份" description="名字、形象、标签和公开简介。发布后别人在探索页看到的就是这些。">
            <IdentitySection draft={draft} errors={shown} onChange={set} />
          </Section>
          <Section id="core" title="设定" description="描述、性格、场景：提示词的主体，每一块都会以独立标签注入。">
            <CoreSection draft={draft} errors={shown} onChange={set} />
          </Section>
          <Section id="opening" title="开场" description="角色的第一句话，以及教模型说话方式的示例。">
            <OpeningSection value={draft.initialMessage} onChange={(v) => set('initialMessage', v)} alternates={draft.alternateGreetings} onAlternatesChange={(v) => set('alternateGreetings', v)} exampleDialogue={draft.exampleDialogue} onExampleDialogueChange={(v) => set('exampleDialogue', v)} />
          </Section>
          <Section id="rules" title="规则" description="希望模型遵守的东西。前者一直在，后者贴在历史后面、更有力。">
            <RulesSection draft={draft} onChange={set} />
          </Section>
          {personaHasContent(draft.persona) && (
            <Section id="persona" title="角色卡自带的用户人设（旧）" description="用户人设现在在「我的人设」里统一管理，跟着玩家走、不随卡分享。这张卡以前写在卡里的人设还在，只在玩家没选任何人设时兜底。">
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-warning)_12%,transparent)] px-3 py-2 text-xs text-cv-fg-muted">
                <span className="min-w-0 flex-1">建议把它存成你自己的人设，然后从卡里清掉。<Link href="/settings/personas" className="text-cv-accent underline-offset-4 hover:underline">打开「我的人设」</Link></span>
                <Button type="button" size="sm" variant="neu" disabled={savePersona.isPending} onClick={() => void saveLegacyPersona()}>
                  {savePersona.isPending ? <Loader2 className="animate-spin" /> : <UserRound />} 存为我的人设
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => set('persona', emptyPersona())}>清空</Button>
              </div>
              <PersonaSection value={draft.persona} onChange={(v) => set('persona', v)} />
            </Section>
          )}
          <Section id="extras" title="补充设定" description="固定字段放不下的，起个名字放这里，按顺序注入。">
            <ExtrasSection value={draft.extras} onChange={(v) => set('extras', v)} />
          </Section>
          <Section id="lorebook" title="世界书" description="随角色一起保存的背景设定。关键词出现在最近几条消息里时，对应条目会注入到提示词；常驻条目总是注入。">
            <LorebookSection value={draft.lorebook} onChange={(v) => set('lorebook', v)} characterName={draft.name.trim() || undefined} />
          </Section>
          <Section id="skin" title="皮肤" description="给聊天页换一套样子：CSS、正则脚本和沙箱 HTML。">
            <SkinSection characterId={editing ? character?.id : undefined} />
          </Section>
          <Section id="publish" title="发布" description="发布会冻结一份当前内容给其他人看；之后的修改要再次发布才会公开。">
            {editing && character ? (
              <PublishSection character={character} draft={{ name: draft.name, avatar_url: draft.avatar_url || null, prompt_template: buildPromptTemplate(draft, character.prompt_template) }} />
            ) : (
              <GlassPanel className="text-sm text-cv-fg-muted">保存角色后就可以在这里发布到探索页。</GlassPanel>
            )}
          </Section>
        </div>

        <aside className="hidden xl:block">
          <GlassPanel className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col">
            <PreviewDock draft={draft} className="min-h-0 flex-1" />
          </GlassPanel>
        </aside>
      </div>

      <GlassSheet open={dockOpen} onOpenChange={setDockOpen}>
        <GlassSheetContent side="right" title="预览" className="sm:w-[min(520px,calc(100%-1.5rem))] [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col">
          <PreviewDock draft={draft} className="min-h-0 flex-1" />
        </GlassSheetContent>
      </GlassSheet>
    </form>
  )
}

/** Stable component (defined outside the form) so typing never remounts a section. */
function Section({ id, title, description, children }: { id: SectionId; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={`sec-${id}`} aria-labelledby={`sec-${id}-title`} className="scroll-mt-28">
      <SectionHeader title={title} description={description} />
      {children}
    </section>
  )
}
