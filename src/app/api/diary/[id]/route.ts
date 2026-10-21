import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'

const MAX_DIARY_CHARS = 20_000

function parseId(id: string): number | null {
  const n = Number(id)
  return Number.isInteger(n) ? n : null
}

/** PUT /api/diary/[id]  { content }  → { diary, message } */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request)
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { user, supabase } = auth

  const diaryId = parseId((await params).id)
  if (diaryId === null) return NextResponse.json({ error: '日记 id 不合法' }, { status: 400 })

  let content: string
  try {
    const body = (await request.json()) as { content?: unknown }
    content = typeof body.content === 'string' ? body.content.trim() : ''
  } catch {
    return NextResponse.json({ error: '请求参数不合法' }, { status: 400 })
  }
  if (!content) return NextResponse.json({ error: '日记内容不能为空' }, { status: 400 })
  if (content.length > MAX_DIARY_CHARS) return NextResponse.json({ error: '日记内容过长' }, { status: 400 })

  const { data: diary, error } = await supabase
    .from('diaries')
    .update({ content })
    .eq('id', diaryId)
    .eq('user_id', user.id)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: '更新日记失败' }, { status: 500 })
  if (!diary) return NextResponse.json({ error: '日记不存在或无权限编辑' }, { status: 404 })

  return NextResponse.json({ diary, message: '日记更新成功' })
}

/** DELETE /api/diary/[id] → { message } */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request)
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { user, supabase } = auth

  const diaryId = parseId((await params).id)
  if (diaryId === null) return NextResponse.json({ error: '日记 id 不合法' }, { status: 400 })

  const { data: deleted, error } = await supabase
    .from('diaries')
    .delete()
    .eq('id', diaryId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: '删除日记失败' }, { status: 500 })
  if (!deleted) return NextResponse.json({ error: '日记不存在或无权限删除' }, { status: 404 })

  return NextResponse.json({ message: '日记删除成功' })
}
