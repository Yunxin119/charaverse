import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'

// 获取角色评论
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const characterId = searchParams.get('characterId')
    
    if (!characterId) {
      return NextResponse.json(
        { error: '缺少角色ID参数' },
        { status: 400 }
      )
    }

    // 验证角色是否存在且公开
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('id, is_public')
      .eq('id', characterId)
      .eq('is_public', true)
      .single()

    if (characterError || !character) {
      return NextResponse.json(
        { error: '角色不存在或未公开' },
        { status: 404 }
      )
    }

    // 获取评论
    const { data: comments, error: commentsError } = await supabase
      .from('character_comments')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })

    if (commentsError) throw commentsError

    // 获取评论者信息
    if (comments && comments.length > 0) {
      const userIds = [...new Set(comments.map(comment => comment.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds)

      const commentsWithProfiles = comments.map(comment => ({
        ...comment,
        profiles: profiles?.find(profile => profile.id === comment.user_id)
      }))

      return NextResponse.json({ comments: commentsWithProfiles })
    }

    return NextResponse.json({ comments: [] })
  } catch (error) {
    console.error('获取评论失败:', error)
    return NextResponse.json(
      { error: '获取评论失败' },
      { status: 500 }
    )
  }
}

// 发布评论
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { characterId, content, userId } = body

    if (!characterId || !content || !userId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 验证角色是否存在且公开
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('id, is_public')
      .eq('id', characterId)
      .eq('is_public', true)
      .single()

    if (characterError || !character) {
      return NextResponse.json(
        { error: '角色不存在或未公开' },
        { status: 404 }
      )
    }

    // 插入评论
    const { data: comment, error: insertError } = await supabase
      .from('character_comments')
      .insert({
        character_id: characterId,
        user_id: userId,
        content: content.trim()
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ 
      message: '评论发布成功',
      comment 
    })
  } catch (error) {
    console.error('发布评论失败:', error)
    return NextResponse.json(
      { error: '发布评论失败' },
      { status: 500 }
    )
  }
}
