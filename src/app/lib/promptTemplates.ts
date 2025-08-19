import { supabase, type PromptTemplate } from './supabase'

// 获取用户的模板列表（包括公开模板）
export async function getPromptTemplates(templateType?: string): Promise<PromptTemplate[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    let query = supabase
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (user) {
      // 如果用户已登录，显示公开模板和用户自己的模板
      query = query.or(`is_public.eq.true,user_id.eq.${user.id}`)
    } else {
      // 如果用户未登录，只显示公开模板
      query = query.eq('is_public', true)
    }

    if (templateType) {
      query = query.eq('template_type', templateType)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('获取模板失败:', error)
    throw error
  }
}

// 获取用户自己的模板
export async function getUserTemplates(templateType?: string): Promise<PromptTemplate[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    let query = supabase
      .from('prompt_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (templateType) {
      query = query.eq('template_type', templateType)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('获取用户模板失败:', error)
    throw error
  }
}

// 保存新模板
export async function savePromptTemplate(template: {
  name: string
  template_type: string
  content: Record<string, any>
  description?: string
  is_public?: boolean
}): Promise<PromptTemplate> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        user_id: user.id,
        name: template.name,
        template_type: template.template_type,
        content: template.content,
        description: template.description,
        is_public: template.is_public || false,
        usage_count: 0
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('保存模板失败:', error)
    throw error
  }
}

// 更新模板
export async function updatePromptTemplate(
  id: number, 
  updates: Partial<Pick<PromptTemplate, 'name' | 'content' | 'description' | 'is_public'>>
): Promise<PromptTemplate> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    const { data, error } = await supabase
      .from('prompt_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // 确保只能更新自己的模板
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('更新模板失败:', error)
    throw error
  }
}

// 删除模板
export async function deletePromptTemplate(id: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // 确保只能删除自己的模板

    if (error) throw error
  } catch (error) {
    console.error('删除模板失败:', error)
    throw error
  }
}

// 增加模板使用次数
export async function incrementTemplateUsage(id: number): Promise<void> {
  try {
    // 先获取当前使用次数，然后加1
    const { data: currentTemplate } = await supabase
      .from('prompt_templates')
      .select('usage_count')
      .eq('id', id)
      .single()

    if (currentTemplate) {
      const { error } = await supabase
        .from('prompt_templates')
        .update({ usage_count: (currentTemplate.usage_count || 0) + 1 })
        .eq('id', id)

      if (error) throw error
    }
  } catch (error) {
    console.error('更新模板使用次数失败:', error)
    // 这个错误不影响主要功能，只记录日志
  }
}

// 根据模块类型获取模板的默认内容结构
export function getTemplateDefaultContent(templateType: string): Record<string, any> {
  switch (templateType) {
    case '用户角色设定':
      return {
        userRoleName: '',
        userRoleAge: '',
        userRoleGender: '',
        userRoleDetails: ''
      }
    case '注意事项':
    case '初始情景':
    case '特殊要求':
      return {
        content: ''
      }
    case '自定义模块':
      return {
        name: '',
        content: ''
      }
    default:
      return {}
  }
}

// 获取预置模板数据
export function getPresetTemplates(): Array<{
  name: string
  template_type: string
  content: Record<string, any>
  description: string
}> {
  return [
    // 用户角色设定模板
    {
      name: '现代都市学生',
      template_type: '用户角色设定',
      content: {
        userRoleName: '李小明',
        userRoleAge: '18',
        userRoleGender: 'male',
        userRoleDetails: '一名普通的高中生，性格开朗，喜欢运动和游戏'
      },
      description: '适合校园、青春类角色扮演'
    },
    {
      name: '职场新人',
      template_type: '用户角色设定',
      content: {
        userRoleName: '张小雨',
        userRoleAge: '25',
        userRoleGender: 'female',
        userRoleDetails: '刚毕业的大学生，初入职场，对工作充满热情但经验不足'
      },
      description: '适合职场、成长类角色扮演'
    },
    // 注意事项模板
    {
      name: '保持角色一致性',
      template_type: '注意事项',
      content: {
        content: '请始终保持角色的性格特征一致，不要突然改变说话风格或行为模式。'
      },
      description: '确保角色扮演的连贯性'
    },
    {
      name: '避免不当内容',
      template_type: '注意事项',
      content: {
        content: '请避免涉及暴力、色情、政治敏感等不当内容，保持对话健康向上。'
      },
      description: '内容安全指导'
    },
    // 初始情景模板
    {
      name: '校园相遇',
      template_type: '初始情景',
      content: {
        content: '在学校的图书馆里，你正在安静地看书，突然有人在你对面坐下...'
      },
      description: '适合校园背景的开场'
    },
    {
      name: '咖啡厅偶遇',
      template_type: '初始情景',
      content: {
        content: '在一个安静的咖啡厅里，你正在享受下午茶时光，这时一个熟悉的身影走了进来...'
      },
      description: '适合日常生活场景'
    },
    // 特殊要求模板
    {
      name: '简短回复',
      template_type: '特殊要求',
      content: {
        content: '请保持回复简短，每次回复不超过50字，模拟真实对话的节奏。'
      },
      description: '适合快节奏对话'
    },
    {
      name: '情感丰富',
      template_type: '特殊要求',
      content: {
        content: '请在对话中表达丰富的情感，使用适当的语气词和表情描述。'
      },
      description: '增加对话的情感色彩'
    }
  ]
}

// 为用户创建预置模板
export async function createPresetTemplatesForUser(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    const presetTemplates = getPresetTemplates()
    
    // 批量创建预置模板
    for (const template of presetTemplates) {
      await savePromptTemplate({
        ...template,
        is_public: false // 为用户创建私人副本
      })
    }
  } catch (error) {
    console.error('创建预置模板失败:', error)
    // 不抛出错误，因为这不是关键功能
  }
}
