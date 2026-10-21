import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 更新记忆条目
export async function PATCH(request: NextRequest) {
  try {
    // 创建Supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // 获取用户的access token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证token' }, { status: 401 })
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
    }

    // 解析请求体
    const {
      memoryId,
      updates
    } = await request.json()

    if (!memoryId) {
      return NextResponse.json({ error: '缺少记忆ID' }, { status: 400 })
    }

    // 允许更新的字段
    const allowedFields = ['title', 'content', 'importance', 'metadata', 'is_enabled']
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // 过滤并添加允许的字段
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field]
      }
    }

    // 更新记忆条目
    const { data: updatedMemory, error: updateError } = await supabase
      .from('chat_memories')
      .update(updateData)
      .eq('id', memoryId)
      .eq('user_id', user.id) // 确保用户只能更新自己的记忆
      .select()
      .single()

    if (updateError) {
      console.error('更新记忆失败:', updateError)
      return NextResponse.json({ error: '更新记忆失败' }, { status: 500 })
    }

    return NextResponse.json({
      memory: updatedMemory,
      message: '记忆更新成功'
    })

  } catch (error) {
    console.error('更新记忆失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 删除记忆条目
export async function DELETE(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证token' }, { status: 401 })
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memoryId = searchParams.get('memoryId')

    if (!memoryId) {
      return NextResponse.json({ error: '缺少记忆ID' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('chat_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('删除记忆失败:', deleteError)
      return NextResponse.json({ error: '删除记忆失败' }, { status: 500 })
    }

    return NextResponse.json({ message: '记忆删除成功' })

  } catch (error) {
    console.error('删除记忆失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}
