import { ApiPoolConfig, ApiConfig, ApiConnectionTestResult } from '../types/apiConfig';
import { migrateApiConfig } from './apiMigration';

class ApiManager {
  private config: ApiPoolConfig;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // 先设置默认配置，再加载和修复
    this.config = this.getDefaultConfig();
    
    try {
      this.config = this.loadConfig();
    } catch (error) {
      console.error('构造函数中加载配置失败:', error);
      this.config = this.getDefaultConfig();
    }
    
    // 监听localStorage变化
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this));
    }
  }

  // 加载配置
  private loadConfig(): ApiPoolConfig {
    if (typeof window === 'undefined') {
      // 服务端默认配置
      return this.getDefaultConfig();
    }

    try {
      const saved = localStorage.getItem('api_pool_config');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        return this.validateAndRepairConfig(parsedConfig);
      } else {
        // 尝试迁移旧版配置
        return migrateApiConfig();
      }
    } catch (error) {
      console.error('加载API配置失败:', error);
      return this.getDefaultConfig();
    }
  }

  // 验证和修复配置
  private validateAndRepairConfig(config: any): ApiPoolConfig {
    const defaultConfig = this.getDefaultConfig();
    
    // 确保providerModes字段存在
    if (!config.providerModes) {
      console.log('🔄 修复配置：添加missing providerModes字段');
      config.providerModes = { ...defaultConfig.providerModes };
      
      // 如果存在旧的全局mode，迁移到每个provider
      if (config.mode && ['single', 'active_only', 'round_robin'].includes(config.mode)) {
        Object.keys(config.providerModes).forEach(provider => {
          config.providerModes[provider] = config.mode;
        });
        console.log(`🔄 将全局模式 '${config.mode}' 迁移到所有provider`);
      }
    }

    // 确保所有必要的provider都存在
    Object.keys(defaultConfig.providerModes).forEach(provider => {
      if (!config.providerModes[provider]) {
        config.providerModes[provider] = 'single';
      }
    });

    // 确保其他必要字段存在
    config.pools = config.pools || defaultConfig.pools;
    config.roundRobinState = config.roundRobinState || defaultConfig.roundRobinState;
    config.globalSettings = config.globalSettings || defaultConfig.globalSettings;

    // 确保pools中的provider都存在
    Object.keys(defaultConfig.pools).forEach(provider => {
      if (!config.pools[provider]) {
        config.pools[provider] = [];
      }
    });

    // 确保roundRobinState中的provider都存在
    Object.keys(defaultConfig.roundRobinState).forEach(provider => {
      if (config.roundRobinState[provider] === undefined) {
        config.roundRobinState[provider] = 0;
      }
    });

    // 保存修复后的配置
    localStorage.setItem('api_pool_config', JSON.stringify(config));
    
    return config as ApiPoolConfig;
  }

  // 获取默认配置
  private getDefaultConfig(): ApiPoolConfig {
    return {
      providerModes: {
        deepseek: 'single',
        gemini: 'single',
        openai: 'single',
        custom: 'single'
      },
      pools: {
        deepseek: [],
        gemini: [],
        openai: [],
        custom: []
      },
      roundRobinState: {
        deepseek: 0,
        gemini: 0,
        openai: 0,
        custom: 0
      },
      globalSettings: {
        retryCount: 3,
        healthCheckInterval: 15,
        maxErrorThreshold: 3
      }
    };
  }

  // 保存配置
  private saveConfig(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('api_pool_config', JSON.stringify(this.config));
      this.notifyListeners();
    }
  }

  // 处理localStorage变化
  private handleStorageChange(e: StorageEvent): void {
    if (e.key === 'api_pool_config' && e.newValue) {
      try {
        const parsedConfig = JSON.parse(e.newValue);
        this.config = this.validateAndRepairConfig(parsedConfig);
        this.notifyListeners();
      } catch (error) {
        console.error('解析更新的API配置失败:', error);
      }
    }
  }

  // 通知监听器
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // 添加配置变化监听器
  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  // 移除监听器
  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  // 获取当前配置
  getConfig(): ApiPoolConfig {
    return { ...this.config };
  }

  // 获取指定provider的模式
  getProviderMode(provider: string): 'single' | 'active_only' | 'round_robin' {
    // 多重检查确保配置安全
    if (!this.config) {
      console.error('❌ config未初始化');
      this.config = this.getDefaultConfig();
    }
    
    if (!this.config.providerModes) {
      console.warn('⚠️ providerModes未定义，重新初始化');
      this.config.providerModes = {
        deepseek: 'single',
        gemini: 'single',
        openai: 'single',
        custom: 'single'
      };
      this.saveConfig();
    }
    
    const mode = this.config.providerModes[provider];
    if (!mode || !['single', 'active_only', 'round_robin'].includes(mode)) {
      console.warn(`⚠️ provider ${provider} 模式无效，使用默认值 'single'`);
      return 'single';
    }
    
    return mode;
  }

  // 设置指定provider的模式
  setProviderMode(provider: string, mode: 'single' | 'active_only' | 'round_robin'): void {
    // 多重检查确保配置安全
    if (!this.config) {
      console.error('❌ config未初始化');
      this.config = this.getDefaultConfig();
    }
    
    if (!this.config.providerModes) {
      console.warn('⚠️ providerModes未定义，重新初始化');
      this.config.providerModes = {
        deepseek: 'single',
        gemini: 'single',
        openai: 'single',
        custom: 'single'
      };
    }
    
    this.config.providerModes[provider] = mode;
    this.saveConfig();
    
    console.log(`✅ 设置 ${provider} 模式为: ${mode}`);
  }

  // 获取指定provider的API池
  getPool(provider: string): ApiConfig[] {
    return this.config.pools[provider] || [];
  }

  // 添加API配置
  addApi(provider: string, apiConfig: Omit<ApiConfig, 'id'>): string {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const newApi: ApiConfig = {
      ...apiConfig,
      id
    };

    if (!this.config.pools[provider]) {
      this.config.pools[provider] = [];
    }

    this.config.pools[provider].push(newApi);
    this.saveConfig();

    console.log(`➕ 添加API: ${newApi.name} (${provider})`);
    return id;
  }

  // 更新API配置
  updateApi(apiId: string, updates: Partial<ApiConfig>): boolean {
    for (const pool of Object.values(this.config.pools)) {
      const api = pool.find(a => a.id === apiId);
      if (api) {
        Object.assign(api, updates);
        this.saveConfig();
        console.log(`✏️ 更新API: ${api.name} (ID: ${apiId})`);
        return true;
      }
    }
    return false;
  }

  // 删除API配置
  removeApi(apiId: string): boolean {
    for (const [provider, pool] of Object.entries(this.config.pools)) {
      const index = pool.findIndex(a => a.id === apiId);
      if (index !== -1) {
        const removedApi = pool.splice(index, 1)[0];
        this.saveConfig();
        console.log(`🗑️ 删除API: ${removedApi.name} (${provider})`);
        return true;
      }
    }
    return false;
  }

  // 根据模式选择API
  selectApi(provider: string): ApiConfig | null {
    const pool = this.config.pools[provider] || [];
    const mode = this.getProviderMode(provider);
    
    switch (mode) {
      case 'single':
        return this.selectSingle(pool);
        
      case 'active_only':
        return this.selectActiveOnly(pool);
        
      case 'round_robin':
        return this.selectRoundRobin(provider, pool);
        
      default:
        return null;
    }
  }

  // 单API模式选择
  private selectSingle(pool: ApiConfig[]): ApiConfig | null {
    const activeApi = pool.find(api => api.isActive && api.isHealthy);
    return activeApi || pool.find(api => api.isActive) || pool[0] || null;
  }

  // 多API选择模式
  private selectActiveOnly(pool: ApiConfig[]): ApiConfig | null {
    const activeApis = pool.filter(api => api.isActive && api.isHealthy);
    
    if (activeApis.length === 0) {
      // 如果没有健康的活跃API，尝试使用不健康但活跃的API
      const fallbackApis = pool.filter(api => api.isActive);
      return fallbackApis[0] || null;
    }
    
    // 按优先级排序，返回最高优先级的API
    activeApis.sort((a, b) => b.priority - a.priority);
    return activeApis[0];
  }

  // 轮询模式选择
  private selectRoundRobin(provider: string, pool: ApiConfig[]): ApiConfig | null {
    const healthyApis = pool.filter(api => api.isActive && api.isHealthy);
    
    if (healthyApis.length === 0) {
      // 回退到活跃的API（即使不健康）
      const activeApis = pool.filter(api => api.isActive);
      return activeApis[0] || null;
    }

    // 按优先级排序
    healthyApis.sort((a, b) => b.priority - a.priority);

    // 获取当前轮询索引
    let currentIndex = this.config.roundRobinState[provider] || 0;
    
    // 确保索引在有效范围内
    if (currentIndex >= healthyApis.length) {
      currentIndex = 0;
    }

    const selectedApi = healthyApis[currentIndex];
    
    // 更新轮询索引
    this.config.roundRobinState[provider] = (currentIndex + 1) % healthyApis.length;
    
    // 更新使用时间
    selectedApi.lastUsedAt = Date.now();
    
    this.saveConfig();
    return selectedApi;
  }

  // 标记API错误
  markApiError(apiId: string): void {
    for (const pool of Object.values(this.config.pools)) {
      const api = pool.find(a => a.id === apiId);
      if (api) {
        api.errorCount++;
        
        // 连续错误超过阈值就标记为不健康
        if (api.errorCount >= this.config.globalSettings.maxErrorThreshold) {
          api.isHealthy = false;
          console.warn(`⚠️ API ${api.name} 标记为不健康 (错误次数: ${api.errorCount})`);
        }
        
        this.saveConfig();
        return;
      }
    }
  }

  // 标记API成功
  markApiSuccess(apiId: string): void {
    for (const pool of Object.values(this.config.pools)) {
      const api = pool.find(a => a.id === apiId);
      if (api) {
        api.errorCount = 0;
        api.isHealthy = true;
        api.lastUsedAt = Date.now();
        this.saveConfig();
        return;
      }
    }
  }

  // 测试API连接
  async testApiConnection(apiId: string): Promise<ApiConnectionTestResult> {
    const api = this.findApiById(apiId);
    if (!api) {
      return {
        success: false,
        error: 'API配置不存在',
        timestamp: Date.now()
      };
    }

    const startTime = Date.now();
    
    try {
      // 这里可以调用实际的API测试接口
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: api.provider,
          apiKey: api.apiKey,
          baseUrl: api.baseUrl
        })
      });

      const latency = Date.now() - startTime;
      
      if (response.ok) {
        this.markApiSuccess(apiId);
        return {
          success: true,
          latency,
          timestamp: Date.now()
        };
      } else {
        const errorText = await response.text();
        this.markApiError(apiId);
        return {
          success: false,
          error: errorText || '连接失败',
          latency,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      this.markApiError(apiId);
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误',
        timestamp: Date.now()
      };
    }
  }

  // 根据ID查找API
  private findApiById(apiId: string): ApiConfig | null {
    for (const pool of Object.values(this.config.pools)) {
      const api = pool.find(a => a.id === apiId);
      if (api) return api;
    }
    return null;
  }

  // 获取健康统计
  getHealthStats(): { healthy: number; unhealthy: number; total: number } {
    let healthy = 0;
    let unhealthy = 0;
    let total = 0;

    for (const pool of Object.values(this.config.pools)) {
      for (const api of pool) {
        if (api.isActive) {
          total++;
          if (api.isHealthy) {
            healthy++;
          } else {
            unhealthy++;
          }
        }
      }
    }

    return { healthy, unhealthy, total };
  }

  // 重置所有API健康状态
  resetHealthStatus(): void {
    for (const pool of Object.values(this.config.pools)) {
      for (const api of pool) {
        api.isHealthy = true;
        api.errorCount = 0;
      }
    }
    this.saveConfig();
    console.log('🔄 已重置所有API健康状态');
  }
}

// 创建单例实例
export const apiManager = new ApiManager();