import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// 删除评论
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      )
    }

    // 删除评论（RLS 策略会确保只能删除自己的评论）
    const { error } = await supabase
      .from('character_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ 
      message: '评论删除成功' 
    })
  } catch (error) {
    console.error('删除评论失败:', error)
    return NextResponse.json(
      { error: '删除评论失败' },
      { status: 500 }
    )
  }
}

// 更新评论
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params
    const body = await request.json()
    const { content, userId } = body

    if (!content || !userId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 更新评论（RLS 策略会确保只能更新自己的评论）
    const { data: comment, error } = await supabase
      .from('character_comments')
      .update({ content: content.trim() })
      .eq('id', commentId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      message: '评论更新成功',
      comment 
    })
  } catch (error) {
    console.error('更新评论失败:', error)
    return NextResponse.json(
      { error: '更新评论失败' },
      { status: 500 }
    )
  }
}
