// API轮询功能的类型定义

export interface ApiConfig {
  id: string;
  name: string; // 用户自定义名称，如 "Gemini-主力", "Gemini-备用1"
  provider: 'deepseek' | 'gemini' | 'openai' | 'custom';
  apiKey: string;
  isActive: boolean; // 是否启用
  priority: number; // 优先级 (0-10)
  
  // 轮询相关
  lastUsedAt: number; // 上次使用时间戳
  errorCount: number; // 连续错误次数
  isHealthy: boolean; // 健康状态
  
  // 可选的自定义配置
  baseUrl?: string; // 自定义API endpoint
  model?: string; // 指定模型
  maxRetries?: number; // 最大重试次数
}

export interface ApiPoolConfig {
  // 每个provider独立的模式
  providerModes: {
    [provider: string]: 'single' | 'active_only' | 'round_robin';
  };
  pools: {
    [provider: string]: ApiConfig[];
  };
  roundRobinState: {
    [provider: string]: number; // 当前轮询索引
  };
  // 全局配置
  globalSettings: {
    retryCount: number; // 失败重试次数 (1-5)
    healthCheckInterval: number; // 健康检查间隔 (分钟)
    maxErrorThreshold: number; // 标记为不健康的错误次数阈值
  };
}

// 兼容旧版本的接口
export interface LegacyApiConfig {
  deepseek?: string;
  gemini?: string;
  openai?: string;
}

// API连接测试结果
export interface ApiConnectionTestResult {
  success: boolean;
  latency?: number; // 响应延迟 (ms)
  error?: string;
  timestamp: number;
}

// API使用统计
export interface ApiUsageStats {
  apiId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastUsed: number;
}