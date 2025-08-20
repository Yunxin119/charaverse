import { ChatMessage } from './supabase'

// 上下文配置接口
export interface ContextConfig {
  maxContextTokens: number        // 最大上下文token数
  reservedTokens: number          // 为生成预留的token数
  enableSummary: boolean          // 是否启用摘要功能
  summaryThreshold: number        // 触发摘要的消息数量阈值
  keepRecentMessages: number      // 保留的最近消息数量
  summaryModel?: string           // 用于摘要的模型（可选）
}

// 默认配置
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxContextTokens: 4000,        // 大部分模型的安全上下文长度
  reservedTokens: 1000,          // 为AI生成预留1000 tokens
  enableSummary: true,
  summaryThreshold: 20,          // 超过20条消息时开始摘要
  keepRecentMessages: 10,        // 始终保留最近10条消息
}

// 简单的token计数器（粗略估算）
export function estimateTokens(text: string): number {
  // 粗略估算：中文字符 * 1.5 + 英文单词数
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  const otherChars = text.length - chineseChars
  
  return Math.ceil(chineseChars * 1.5 + englishWords + otherChars * 0.3)
}

// 上下文管理器类
export class ContextManager {
  private config: ContextConfig
  
  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config }
  }

  // 更新配置
  updateConfig(config: Partial<ContextConfig>) {
    this.config = { ...this.config, ...config }
  }

  // 构建完整的prompt上下文
  async buildContext(params: {
    systemPrompt: string
    messages: ChatMessage[]
    characterCard?: string
    worldInfo?: string[]
    exampleDialogues?: string[]
    summaries?: string[]
  }): Promise<{
    systemPrompt: string
    messages: { role: string; content: string }[]
    stats: {
      totalTokens: number
      systemTokens: number
      messageTokens: number
      truncatedMessages: number
      hasSummary: boolean
    }
  }> {
    const { systemPrompt, messages, characterCard, worldInfo, exampleDialogues, summaries } = params

    // 1. 计算核心组件的token数
    const corePromptParts = [
      systemPrompt,
      characterCard || '',
      ...(worldInfo || []),
      ...(exampleDialogues || []),
      ...(summaries || [])
    ]
    
    const corePrompt = corePromptParts.filter(part => part.trim()).join('\n\n')
    const coreTokens = estimateTokens(corePrompt)
    
    // 2. 计算可用于消息历史的token预算
    const availableTokens = this.config.maxContextTokens - this.config.reservedTokens - coreTokens
    
    if (availableTokens <= 0) {
      throw new Error('核心prompt过长，没有空间容纳消息历史')
    }

    // 3. 选择要包含的消息
    const selectedMessages = this.selectMessages(messages, availableTokens)
    
    // 4. 构建最终的消息历史
    const finalMessages = selectedMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // 5. 计算统计信息
    const messageTokens = finalMessages.reduce((sum, msg) => 
      sum + estimateTokens(msg.content), 0
    )

    return {
      systemPrompt: corePrompt,
      messages: finalMessages,
      stats: {
        totalTokens: coreTokens + messageTokens,
        systemTokens: coreTokens,
        messageTokens,
        truncatedMessages: messages.length - finalMessages.length,
        hasSummary: (summaries?.length || 0) > 0
      }
    }
  }

  // 选择要包含的消息（实现截断策略）
  private selectMessages(messages: ChatMessage[], availableTokens: number): ChatMessage[] {
    if (messages.length === 0) return []

    // 1. 总是保留最近的几条消息
    const recentMessages = messages.slice(-this.config.keepRecentMessages)
    let selectedMessages = [...recentMessages]
    let usedTokens = selectedMessages.reduce((sum, msg) => 
      sum + estimateTokens(msg.content), 0
    )

    // 2. 如果还有空间，从倒数第二新的消息开始向前添加
    if (usedTokens < availableTokens && messages.length > this.config.keepRecentMessages) {
      const olderMessages = messages.slice(0, -this.config.keepRecentMessages).reverse()
      
      for (const msg of olderMessages) {
        const msgTokens = estimateTokens(msg.content)
        if (usedTokens + msgTokens <= availableTokens) {
          selectedMessages.unshift(msg)
          usedTokens += msgTokens
        } else {
          break
        }
      }
    }

    return selectedMessages
  }

  // 生成对话摘要
  async generateSummary(params: {
    messages: ChatMessage[]
    characterName: string
    apiKey: string
    model?: string
  }): Promise<string> {
    const { messages, characterName, apiKey, model = 'deepseek-chat' } = params

    if (messages.length === 0) return ''

    // 构建摘要prompt
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? '用户' : characterName}: ${msg.content}`)
      .join('\n')

    const summaryPrompt = `请为以下对话生成一个简洁的摘要，重点记录：
1. 关键事件和情节发展
2. 重要的约定、决定或承诺
3. 角色关系的变化
4. 重要的背景信息

要求：
- 使用第三人称描述
- 保持客观中性的语调
- 控制在200字以内
- 重点突出对后续对话有影响的信息

对话内容：
${conversationText}

摘要：`

    try {
      // 调用AI API生成摘要
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: summaryPrompt }],
          systemPrompt: '你是一个专业的对话摘要助手，能够准确提取对话中的关键信息。',
          apiKey,
          model
        }),
      })

      if (!response.ok) {
        throw new Error('摘要生成失败')
      }

      const result = await response.json()
      return result.content || '摘要生成失败'
    } catch (error) {
      console.error('生成摘要时出错:', error)
      return '摘要生成失败'
    }
  }

  // 判断是否需要生成摘要
  shouldGenerateSummary(messages: ChatMessage[]): boolean {
    return this.config.enableSummary && 
           messages.length >= this.config.summaryThreshold
  }

  // 获取当前配置
  getConfig(): ContextConfig {
    return { ...this.config }
  }

  // 估算消息数组的总token数
  estimateMessagesTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
  }
}