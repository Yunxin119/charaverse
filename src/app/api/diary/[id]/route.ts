import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface DiaryUpdateRequest {
  content: string
}

interface DiaryRegenerateRequest {
  sessionId: string
  userId: string
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: diaryId } = await params

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

    // 验证日记存在且属于当前用户
    const { data: diary, error: fetchError } = await supabase
      .from('diaries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !diary) {
      return NextResponse.json({ error: '日记不存在或无权限删除' }, { status: 404 })
    }

    // 删除日记
    const { error: deleteError } = await supabase
      .from('diaries')
      .delete()
      .eq('id', diaryId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('删除日记失败:', deleteError)
      return NextResponse.json({ error: '删除日记失败' }, { status: 500 })
    }

    return NextResponse.json({ message: '日记删除成功' })

  } catch (error) {
    console.error('删除日记失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: diaryId } = await params

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
    const { content } = await request.json() as DiaryUpdateRequest
    
    if (!content || !content.trim()) {
      return NextResponse.json({ error: '日记内容不能为空' }, { status: 400 })
    }

    // 验证日记存在且属于当前用户
    const { data: diary, error: fetchError } = await supabase
      .from('diaries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !diary) {
      return NextResponse.json({ error: '日记不存在或无权限编辑' }, { status: 404 })
    }

    // 更新日记内容
    const { data: updatedDiary, error: updateError } = await supabase
      .from('diaries')
      .update({
        content: content.trim()
      })
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('更新日记失败:', updateError)
      return NextResponse.json({ error: '更新日记失败' }, { status: 500 })
    }

    return NextResponse.json({ 
      diary: updatedDiary,
      message: '日记更新成功' 
    })

  } catch (error) {
    console.error('更新日记失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}