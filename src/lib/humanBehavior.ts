// 人性化聊天行为模拟库

export interface HumanBehaviorConfig {
  // 打字速度配置
  typingSpeed: {
    min: number  // 最小字符/秒
    max: number  // 最大字符/秒
    variance: number  // 速度变化幅度 (0-1)
  }
  
  // 消息发送行为
  sendingBehavior: {
    pauseProbability: number  // 发送前暂停的概率 (0-1)
    pauseDuration: { min: number, max: number }  // 暂停时长范围(ms)
    retryProbability: number  // 重新编辑消息的概率 (0-1)
    fastTypingProbability: number  // 快速连发的概率 (0-1)
  }
  
  // 情绪化行为
  emotionalBehavior: {
    excitementMultiplier: number  // 兴奋时速度倍数
    hesitationMultiplier: number  // 犹豫时速度倍数
    emotionDetectionKeywords: {
      excitement: string[]  // 兴奋关键词
      hesitation: string[]  // 犹豫关键词
      anger: string[]       // 愤怒关键词
      sadness: string[]     // 悲伤关键词
    }
  }
}

// 默认人性化行为配置
export const defaultHumanBehaviorConfig: HumanBehaviorConfig = {
  typingSpeed: {
    min: 8,
    max: 15,
    variance: 0.3
  },
  sendingBehavior: {
    pauseProbability: 0.15,
    pauseDuration: { min: 500, max: 2000 },
    retryProbability: 0.08,
    fastTypingProbability: 0.12
  },
  emotionalBehavior: {
    excitementMultiplier: 1.8,
    hesitationMultiplier: 0.6,
    emotionDetectionKeywords: {
      excitement: ['哈哈', '太好了', 'amazing', '棒', '爽', '开心', '兴奋', '!', '！！'],
      hesitation: ['嗯...', '这个...', '可能', '也许', '不太确定', '应该', '大概'],
      anger: ['气死了', '烦', '讨厌', '什么鬼', '无语', '愤怒', '生气'],
      sadness: ['难过', '伤心', '哭', '失望', '沮丧', '不开心', '郁闷']
    }
  }
}

// 情绪类型
export type EmotionType = 'neutral' | 'excitement' | 'hesitation' | 'anger' | 'sadness'

// 检测文本情绪
export function detectEmotion(text: string, config: HumanBehaviorConfig = defaultHumanBehaviorConfig): EmotionType {
  const lowerText = text.toLowerCase()
  
  // 检查兴奋
  if (config.emotionalBehavior.emotionDetectionKeywords.excitement.some(keyword => 
    lowerText.includes(keyword.toLowerCase()))) {
    return 'excitement'
  }
  
  // 检查犹豫
  if (config.emotionalBehavior.emotionDetectionKeywords.hesitation.some(keyword => 
    lowerText.includes(keyword.toLowerCase()))) {
    return 'hesitation'
  }
  
  // 检查愤怒
  if (config.emotionalBehavior.emotionDetectionKeywords.anger.some(keyword => 
    lowerText.includes(keyword.toLowerCase()))) {
    return 'anger'
  }
  
  // 检查悲伤
  if (config.emotionalBehavior.emotionDetectionKeywords.sadness.some(keyword => 
    lowerText.includes(keyword.toLowerCase()))) {
    return 'sadness'
  }
  
  return 'neutral'
}

// 计算打字持续时间
export function calculateTypingDuration(
  text: string, 
  emotion: EmotionType = 'neutral',
  config: HumanBehaviorConfig = defaultHumanBehaviorConfig
): number {
  const { min, max, variance } = config.typingSpeed
  const baseSpeed = min + Math.random() * (max - min)
  
  // 添加速度变化
  const speedVariance = 1 + (Math.random() - 0.5) * variance
  let finalSpeed = baseSpeed * speedVariance
  
  // 根据情绪调整速度
  switch (emotion) {
    case 'excitement':
      finalSpeed *= config.emotionalBehavior.excitementMultiplier
      break
    case 'hesitation':
    case 'sadness':
      finalSpeed *= config.emotionalBehavior.hesitationMultiplier
      break
    case 'anger':
      finalSpeed *= config.emotionalBehavior.excitementMultiplier * 0.9  // 稍慢于兴奋
      break
  }
  
  // 计算总时长（字符数 / 速度 * 1000ms）
  const duration = Math.max(500, (text.length / finalSpeed) * 1000)
  
  return Math.round(duration)
}

// 计算发送前延迟
export function calculateSendDelay(
  text: string,
  emotion: EmotionType = 'neutral',
  config: HumanBehaviorConfig = defaultHumanBehaviorConfig
): number {
  // 基础延迟
  let baseDelay = 200 + Math.random() * 800
  
  // 根据情绪调整
  switch (emotion) {
    case 'excitement':
      baseDelay *= 0.5  // 兴奋时更快发送
      break
    case 'hesitation':
      baseDelay *= 2.5  // 犹豫时延迟更久
      break
    case 'anger':
      baseDelay *= 0.7  // 愤怒时稍快
      break
    case 'sadness':
      baseDelay *= 1.8  // 悲伤时稍慢
      break
  }
  
  // 检查是否需要额外暂停
  if (Math.random() < config.sendingBehavior.pauseProbability) {
    const { min, max } = config.sendingBehavior.pauseDuration
    baseDelay += min + Math.random() * (max - min)
  }
  
  return Math.round(baseDelay)
}

// 决定是否需要重新编辑
export function shouldRetryMessage(
  text: string,
  config: HumanBehaviorConfig = defaultHumanBehaviorConfig
): boolean {
  // 长消息更容易被重新编辑
  const lengthFactor = Math.min(1, text.length / 100)
  const adjustedProbability = config.sendingBehavior.retryProbability * (1 + lengthFactor)
  
  return Math.random() < adjustedProbability
}

// 决定是否快速连发
export function shouldFastType(
  text: string,
  emotion: EmotionType = 'neutral',
  config: HumanBehaviorConfig = defaultHumanBehaviorConfig
): boolean {
  let probability = config.sendingBehavior.fastTypingProbability
  
  // 兴奋情绪增加快速连发概率
  if (emotion === 'excitement') {
    probability *= 2.5
  } else if (emotion === 'anger') {
    probability *= 1.8
  }
  
  return Math.random() < probability
}

// 生成人性化的打字模式
export interface TypingPattern {
  totalDuration: number
  sendDelay: number
  shouldRetry: boolean
  shouldFastType: boolean
  emotion: EmotionType
  typingSpeed: number
}

export function generateTypingPattern(
  text: string,
  config: HumanBehaviorConfig = defaultHumanBehaviorConfig
): TypingPattern {
  const emotion = detectEmotion(text, config)
  const totalDuration = calculateTypingDuration(text, emotion, config)
  const sendDelay = calculateSendDelay(text, emotion, config)
  const shouldRetry = shouldRetryMessage(text, config)
  const shouldFastTypeResult = shouldFastType(text, emotion, config)
  
  // 计算实际打字速度（字符/秒）
  const typingSpeed = text.length / (totalDuration / 1000)
  
  return {
    totalDuration,
    sendDelay,
    shouldRetry,
    shouldFastType: shouldFastTypeResult,
    emotion,
    typingSpeed
  }
}

// 角色个性化配置
export interface CharacterPersonality {
  name: string
  typingSpeedMultiplier: number  // 打字速度倍数
  emotionalIntensity: number     // 情绪强度 (0-2)
  impulsiveness: number          // 冲动性 (0-1)
  thoughtfulness: number         // 深思熟虑程度 (0-1)
}

// 根据角色个性调整行为
export function personalizeConfig(
  baseConfig: HumanBehaviorConfig,
  personality: CharacterPersonality
): HumanBehaviorConfig {
  const config = JSON.parse(JSON.stringify(baseConfig)) // 深拷贝
  
  // 调整打字速度
  config.typingSpeed.min *= personality.typingSpeedMultiplier
  config.typingSpeed.max *= personality.typingSpeedMultiplier
  
  // 调整情绪反应
  config.emotionalBehavior.excitementMultiplier = 1 + 
    (config.emotionalBehavior.excitementMultiplier - 1) * personality.emotionalIntensity
  config.emotionalBehavior.hesitationMultiplier = 1 - 
    (1 - config.emotionalBehavior.hesitationMultiplier) * personality.emotionalIntensity
  
  // 调整冲动性（影响暂停和重试概率）
  config.sendingBehavior.pauseProbability *= (1 - personality.impulsiveness * 0.7)
  config.sendingBehavior.retryProbability *= personality.thoughtfulness
  
  return config
}

// 预设角色个性
export const characterPersonalities = {
  energetic: {
    name: '活泼型',
    typingSpeedMultiplier: 1.3,
    emotionalIntensity: 1.5,
    impulsiveness: 0.8,
    thoughtfulness: 0.4
  },
  calm: {
    name: '沉稳型',
    typingSpeedMultiplier: 0.8,
    emotionalIntensity: 0.7,
    impulsiveness: 0.2,
    thoughtfulness: 0.9
  },
  playful: {
    name: '调皮型',
    typingSpeedMultiplier: 1.1,
    emotionalIntensity: 1.3,
    impulsiveness: 0.7,
    thoughtfulness: 0.5
  },
  serious: {
    name: '严肃型',
    typingSpeedMultiplier: 0.9,
    emotionalIntensity: 0.5,
    impulsiveness: 0.1,
    thoughtfulness: 1.0
  },
  random: {
    name: '随机型',
    typingSpeedMultiplier: 0.8 + Math.random() * 0.6,
    emotionalIntensity: 0.5 + Math.random() * 1.0,
    impulsiveness: Math.random(),
    thoughtfulness: Math.random()
  }
} as const

// 工具函数：模拟网络延迟
export function simulateNetworkDelay(): number {
  // 模拟 50-200ms 的网络延迟
  return 50 + Math.random() * 150
}

// 工具函数：生成随机的"正在输入"持续时间
export function generateTypingIndicatorDuration(textLength: number): number {
  // 基于文本长度的合理指示器显示时间
  const baseDuration = Math.min(textLength * 80, 3000)  // 最多3秒
  const variance = baseDuration * 0.3
  return baseDuration + (Math.random() - 0.5) * variance
}