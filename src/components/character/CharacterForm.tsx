'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Check, Globe, LayoutList, Loader2, MessageSquareQuote, Palette, Save, UserRound } from 'lucide-react'
import { supabase, type Character } from '@/app/lib/supabase'
import { deleteAvatar } from '@/app/lib/avatarUpload'
import { useAuth } from '@/providers/AuthProvider'
import { qk } from '@/queries/keys'
import { Button } from '@/components/ui/button'
import { Chip, GlassPanel, IconButton } from '@/components/glass'
import { PublishSection } from '@/components/character/PublishSection'
import { SectionNav, type NavSection, type SectionId } from './form/SectionNav'
import { SectionHeader } from './form/Field'
import { BasicInfoSection } from './form/BasicInfoSection'
import { ModulesSection } from './form/ModulesSection'
import { OpeningSection } from './form/OpeningSection'
import { LorebookSection } from './form/LorebookSection'
import { SkinSection } from './form/SkinSection'
import { buildPromptTemplate, draftFromCharacter, emptyDraft, validateDraft, type CharacterDraft, type DraftErrors } from './form/types'

export type { CharacterDraft } from './form/types'

interface Props {
  mode: 'create' | 'edit'
  character?: Character
}

const NO_ERRORS: DraftErrors = {}

/**
 * Create / edit a character card. One draft object, sectioned UI, explicit 保存.
 * Mount with `key={character.id}` in edit mode so a different character resets the draft.
 */
export function CharacterForm({ mode, character }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editing = mode === 'edit' && !!character

  const initial = useMemo(() => (character ? draftFromCharacter(character) : emptyDraft()), [character])
  const [draft, setDraft] = useState<CharacterDraft>(initial)
  const [baseline, setBaseline] = useState<CharacterDraft>(initial)
  const [active, setActive] = useState<SectionId>(() => {
    if (typeof window === 'undefined' || mode !== 'edit') return 'basic'
    const q = new URLSearchParams(window.location.search).get('section')
    return q === 'modules' || q === 'opening' || q === 'lorebook' || q === 'skin' || q === 'publish' ? q : 'basic'
  })
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline])
  const errors = useMemo(() => validateDraft(draft), [draft])
  const shown = submitted ? errors : NO_ERRORS

  const set = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

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
    if (Object.keys(errors).length) { setActive('basic'); return }
    save.mutate(draft)
  }

  const back = () => {
    if (!dirty || confirm('有未保存的修改，确定离开？')) router.back()
  }

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

  const sections: NavSection[] = [
    { id: 'basic', label: '基本信息', icon: UserRound, error: !!(shown.name || shown.content) },
    { id: 'modules', label: '人设模块', icon: LayoutList, error: !!shown.content, meta: draft.modules.length ? String(draft.modules.length) : undefined },
    { id: 'opening', label: '开场白', icon: MessageSquareQuote, meta: draft.initialMessage.trim() ? '✓' : undefined },
    { id: 'lorebook', label: '世界书', icon: BookOpen, meta: draft.lorebook.entries.length ? String(draft.lorebook.entries.length) : undefined },
    { id: 'skin', label: '外观皮肤', icon: Palette },
    { id: 'publish', label: '发布', icon: Globe, meta: editing && character?.is_public ? '公开' : undefined },
  ]

  const title = editing ? (draft.name.trim() || character?.name || '编辑角色') : '新建角色'
  const canSave = dirty && !save.isPending

  return (
    <form
      className="mx-auto max-w-4xl px-4 py-6 sm:px-6"
      onSubmit={(e) => { e.preventDefault(); submit() }}
      noValidate
    >
      {/* sticky bar: actions, and on small screens the section tabs */}
      <div className="sticky top-0 z-20 -mt-2 pt-2 pb-3">
        <GlassPanel strength="strong" padding="none" className="space-y-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <IconButton label="返回" variant="ghost" size="sm" onClick={back}><ArrowLeft /></IconButton>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-semibold leading-tight sm:text-xl">{title}</h1>
              <p className="hidden text-[11px] text-cv-fg-muted sm:block">{editing ? '修改只在你按「保存」后生效' : '保存后可以继续编辑皮肤和发布'}</p>
            </div>
            {dirty ? <Chip tone="warning">未保存</Chip> : saved ? <Chip tone="success">已保存</Chip> : null}
            <Button type="submit" size="sm" disabled={!canSave}>
              {save.isPending ? <Loader2 className="animate-spin" /> : saved && !dirty ? <Check /> : <Save />}
              {save.isPending ? '保存中' : '保存'}
            </Button>
          </div>
          <div className="lg:hidden">
            <SectionNav variant="tabs" sections={sections} active={active} onSelect={setActive} />
          </div>
        </GlassPanel>
        {error && <p role="alert" className="mt-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-danger)_12%,transparent)] px-3 py-2 text-sm text-cv-danger">{error}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <SectionNav variant="rail" sections={sections} active={active} onSelect={setActive} />
        </aside>

        <div className="min-w-0">
          {active === 'basic' && <BasicInfoSection draft={draft} errors={shown} onChange={set} />}
          {active === 'modules' && <ModulesSection modules={draft.modules} error={shown.content} onChange={(m) => set('modules', m)} />}
          {active === 'opening' && <OpeningSection value={draft.initialMessage} onChange={(v) => set('initialMessage', v)} alternates={draft.alternateGreetings} onAlternatesChange={(v) => set('alternateGreetings', v)} exampleDialogue={draft.exampleDialogue} onExampleDialogueChange={(v) => set('exampleDialogue', v)} />}
          {active === 'lorebook' && <LorebookSection value={draft.lorebook} onChange={(v) => set('lorebook', v)} characterName={draft.name.trim() || undefined} />}
          {active === 'skin' && <SkinSection characterId={editing ? character?.id : undefined} />}
          {active === 'publish' && (
            <section aria-labelledby="sec-publish">
              <SectionHeader title="发布" description="发布会冻结一份当前内容给其他人看；之后的修改要再次发布才会公开。" />
              {editing && character ? (
                <PublishSection
                  character={character}
                  draft={{ name: draft.name, avatar_url: draft.avatar_url || null, prompt_template: buildPromptTemplate(draft, character.prompt_template) }}
                />
              ) : (
                <GlassPanel className="text-sm text-cv-fg-muted">保存角色后就可以在这里发布到探索页。</GlassPanel>
              )}
            </section>
          )}
        </div>
      </div>
    </form>
  )
}
