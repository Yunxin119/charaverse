import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// 复制公开角色到用户的角色库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { characterId, userId } = body

    if (!characterId || !userId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 获取要复制的角色信息
    const { data: originalCharacter, error: fetchError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .eq('is_public', true)
      .single()

    if (fetchError || !originalCharacter) {
      return NextResponse.json(
        { error: '角色不存在或未公开' },
        { status: 404 }
      )
    }

    // 检查用户是否已经复制过这个角色
    const { data: existingCopy } = await supabase
      .from('characters')
      .select('id')
      .eq('user_id', userId)
      .eq('name', `${originalCharacter.name} (副本)`)
      .single()

    let copyName = `${originalCharacter.name} (副本)`
    if (existingCopy) {
      // 如果已经有副本，添加数字后缀
      const { data: copies } = await supabase
        .from('characters')
        .select('name')
        .eq('user_id', userId)
        .like('name', `${originalCharacter.name} (副本%)`)

      const copyNumber = copies ? copies.length + 1 : 2
      copyName = `${originalCharacter.name} (副本${copyNumber})`
    }

    // 创建角色副本
    const { data: newCharacter, error: insertError } = await supabase
      .from('characters')
      .insert({
        user_id: userId,
        name: copyName,
        avatar_url: originalCharacter.avatar_url,
        prompt_template: originalCharacter.prompt_template,
        is_public: false, // 复制的角色默认设为私有
        likes_count: 0
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ 
      message: '角色复制成功',
      character: newCharacter
    })
  } catch (error) {
    console.error('复制角色失败:', error)
    return NextResponse.json(
      { error: '复制角色失败' },
      { status: 500 }
    )
  }
}
