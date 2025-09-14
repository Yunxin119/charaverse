/**
 * 智能消息分割系统
 * 支持 {pause} 字符分割，智能识别对话节奏，控制消息长度，保持语义完整性
 */

export interface MessageSegment {
  id: string
  content: string
  delay: number // 发送前的延迟时间（毫秒）
  isTyping: boolean // 是否显示打字效果
  typingDuration?: number // 打字效果持续时间
  priority: 'high' | 'normal' | 'low' // 消息优先级
  emotion?: string // 情绪标记
}

export interface MessageSplitterConfig {
  minSegmentLength: number // 最小片段长度
  maxSegmentLength: number // 最大片段长度
  typingSpeed: number // 打字速度（字符/秒）
  baseDelay: number // 基础延迟时间
  randomDelayRange: number // 随机延迟范围
  enableSmartSplit: boolean // 启用智能分割
  preserveFormatting: boolean // 保持格式化
}

export class MessageSplitter {
  private config: MessageSplitterConfig

  constructor(config: Partial<MessageSplitterConfig> = {}) {
    this.config = {
      minSegmentLength: 20,
      maxSegmentLength: 80,
      typingSpeed: 15, // 15 字符/秒，模拟真人打字速度
      baseDelay: 800, // 基础延迟 0.8 秒
      randomDelayRange: 2000, // 随机延迟 0-2 秒
      enableSmartSplit: true,
      preserveFormatting: true,
      ...config
    }
  }

  /**
   * 分割消息为多个片段
   */
  splitMessage(content: string): MessageSegment[] {
    console.log('🔪 开始分割消息:', {
      originalLength: content.length,
      hasPauseMarkers: /\{pause\}/i.test(content)
    })

    // 如果没有 {pause} 标记，返回单个片段
    if (!/\{pause\}/i.test(content)) {
      return [{
        id: this.generateSegmentId(),
        content: content.trim(),
        delay: 0,
        isTyping: false,
        priority: 'normal'
      }]
    }

    // 按 {pause} 分割
    const rawSegments = content.split(/\{pause\}/i)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0)

    console.log('✂️ 初步分割结果:', rawSegments.length, '个片段')

    // 处理每个片段
    const processedSegments: MessageSegment[] = []
    
    for (let i = 0; i < rawSegments.length; i++) {
      const segment = rawSegments[i]
      
      // 如果启用智能分割且片段过长，进一步分割
      if (this.config.enableSmartSplit && segment.length > this.config.maxSegmentLength) {
        const subSegments = this.smartSplit(segment)
        processedSegments.push(...subSegments.map((subSeg, subIndex) => ({
          id: this.generateSegmentId(),
          content: subSeg,
          delay: this.calculateDelay(i, subIndex, rawSegments.length),
          isTyping: this.shouldShowTyping(subSeg),
          typingDuration: this.calculateTypingDuration(subSeg),
          priority: this.determinePriority(subSeg, i, rawSegments.length),
          emotion: this.detectEmotion(subSeg)
        })))
      } else {
        processedSegments.push({
          id: this.generateSegmentId(),
          content: segment,
          delay: this.calculateDelay(i, 0, rawSegments.length),
          isTyping: this.shouldShowTyping(segment),
          typingDuration: this.calculateTypingDuration(segment),
          priority: this.determinePriority(segment, i, rawSegments.length),
          emotion: this.detectEmotion(segment)
        })
      }
    }

    console.log('✅ 最终分割结果:', {
      totalSegments: processedSegments.length,
      segments: processedSegments.map(s => ({
        length: s.content.length,
        delay: s.delay,
        isTyping: s.isTyping,
        priority: s.priority
      }))
    })

    return processedSegments
  }

  /**
   * 智能分割长片段
   */
  private smartSplit(text: string): string[] {
    const segments: string[] = []
    const sentences = text.split(/([。！？；.!?;])/g)
    let currentSegment = ''

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '')
      
      // 如果添加这个句子会超过最大长度，先保存当前片段
      if (currentSegment.length + sentence.length > this.config.maxSegmentLength && currentSegment.length > 0) {
        segments.push(currentSegment.trim())
        currentSegment = sentence
      } else {
        currentSegment += sentence
      }
    }

    // 添加最后一个片段
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim())
    }

    // 如果还有太长的片段，按字符强制分割
    return segments.flatMap(segment => {
      if (segment.length <= this.config.maxSegmentLength) {
        return [segment]
      }
      
      const forceSplit: string[] = []
      for (let i = 0; i < segment.length; i += this.config.maxSegmentLength) {
        forceSplit.push(segment.slice(i, i + this.config.maxSegmentLength))
      }
      return forceSplit
    })
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(segmentIndex: number, subIndex: number, totalSegments: number): number {
    // 第一个片段没有延迟
    if (segmentIndex === 0 && subIndex === 0) {
      return 0
    }

    // 基础延迟 + 随机延迟
    const baseDelay = this.config.baseDelay
    const randomDelay = Math.random() * this.config.randomDelayRange
    
    // 根据片段位置调整延迟
    const positionMultiplier = segmentIndex === totalSegments - 1 ? 1.2 : 1.0 // 最后一个片段稍微长一点
    
    return Math.round((baseDelay + randomDelay) * positionMultiplier)
  }

  /**
   * 判断是否应该显示打字效果
   */
  private shouldShowTyping(content: string): boolean {
    // 短消息总是显示打字效果
    if (content.length <= 30) {
      return true
    }
    
    // 长消息有 70% 概率显示打字效果
    return Math.random() < 0.7
  }

  /**
   * 计算打字效果持续时间
   */
  calculateTypingDuration(content: string): number {
    const baseTime = (content.length / this.config.typingSpeed) * 1000
    const randomVariation = baseTime * 0.3 * (Math.random() - 0.5) // ±15% 的随机变化
    return Math.max(500, Math.round(baseTime + randomVariation)) // 最少 0.5 秒
  }

  /**
   * 确定消息优先级
   */
  private determinePriority(content: string, index: number, totalSegments: number): 'high' | 'normal' | 'low' {
    // 包含重要词汇的消息为高优先级
    const importantPatterns = [/[！!]{2,}/, /重要|紧急|注意/, /\?{2,}/, /但是|然而|不过/]
    if (importantPatterns.some(pattern => pattern.test(content))) {
      return 'high'
    }
    
    // 第一条和最后一条消息为高优先级
    if (index === 0 || index === totalSegments - 1) {
      return 'high'
    }
    
    // 很短的消息为低优先级
    if (content.length < 20) {
      return 'low'
    }
    
    return 'normal'
  }

  /**
   * 检测情绪
   */
  private detectEmotion(content: string): string | undefined {
    const emotionPatterns = {
      happy: /[哈呵嘿嘻😊😄😃😀🤣😂]|开心|高兴|快乐|兴奋/,
      sad: /[😢😭😔😞😟]|难过|伤心|失落|沮丧/,
      angry: /[😠😡🤬]|生气|愤怒|气愤|恼火/,
      surprised: /[😲😮😯😱]|惊讶|震惊|意外|不敢相信/,
      thinking: /[🤔💭]|想想|思考|考虑|琢磨/,
      love: /[❤️💕💖😍🥰]|爱|喜欢|心动|温暖/
    }

    for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
      if (pattern.test(content)) {
        return emotion
      }
    }

    return undefined
  }

  /**
   * 生成片段ID
   */
  private generateSegmentId(): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取配置
   */
  getConfig(): MessageSplitterConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MessageSplitterConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 预览分割结果（调试用）
   */
  previewSplit(content: string): {
    originalLength: number
    segmentCount: number
    segments: Array<{
      content: string
      length: number
      delay: number
      isTyping: boolean
      priority: string
    }>
  } {
    const segments = this.splitMessage(content)
    return {
      originalLength: content.length,
      segmentCount: segments.length,
      segments: segments.map(s => ({
        content: s.content,
        length: s.content.length,
        delay: s.delay,
        isTyping: s.isTyping,
        priority: s.priority
      }))
    }
  }
}

/**
 * 创建消息分割器实例
 */
export function createMessageSplitter(config?: Partial<MessageSplitterConfig>): MessageSplitter {
  return new MessageSplitter(config)
}

/**
 * 快速分割消息的工具函数
 */
export function splitMessage(content: string, config?: Partial<MessageSplitterConfig>): MessageSegment[] {
  const splitter = createMessageSplitter(config)
  return splitter.splitMessage(content)
}

/**
 * 检查消息是否需要分割
 */
export function needsSplitting(content: string): boolean {
  return /\{pause\}/i.test(content)
}

/**
 * 清理消息中的分割标记（用于显示）
 */
export function cleanPauseMarkers(content: string): string {
  return content.replace(/\{pause\}/gi, '').replace(/\s+/g, ' ').trim()
}
