import { ApiPoolConfig, ApiConfig, LegacyApiConfig } from '../types/apiConfig';

// 生成唯一ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 默认配置
const createDefaultApiPoolConfig = (): ApiPoolConfig => ({
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
    healthCheckInterval: 15, // 15分钟
    maxErrorThreshold: 3
  }
});

// 创建API配置对象
const createApiConfig = (
  provider: 'deepseek' | 'gemini' | 'openai',
  apiKey: string,
  name?: string
): ApiConfig => ({
  id: generateId(),
  name: name || `${provider.charAt(0).toUpperCase() + provider.slice(1)} 默认`,
  provider,
  apiKey,
  isActive: true,
  priority: 5,
  lastUsedAt: 0,
  errorCount: 0,
  isHealthy: true
});

// 从localStorage读取旧版配置
const getLegacyApiConfig = (): LegacyApiConfig => {
  const config: LegacyApiConfig = {};
  
  const deepseek = localStorage.getItem('api_key_deepseek');
  const gemini = localStorage.getItem('api_key_gemini');
  const openai = localStorage.getItem('api_key_openai');
  
  if (deepseek) config.deepseek = deepseek;
  if (gemini) config.gemini = gemini;
  if (openai) config.openai = openai;
  
  return config;
};

// 主要迁移函数
export const migrateApiConfig = (): ApiPoolConfig => {
  console.log('🔄 开始API配置迁移...');
  
  // 检查是否已经存在新格式的配置
  const existingConfig = localStorage.getItem('api_pool_config');
  if (existingConfig) {
    try {
      const parsed = JSON.parse(existingConfig) as ApiPoolConfig;
      console.log('✅ 发现现有的API池配置，跳过迁移');
      
      // 验证配置完整性，如果缺少字段则补充
      return validateAndRepairConfig(parsed);
    } catch (error) {
      console.warn('⚠️ 现有配置格式错误，重新创建:', error);
    }
  }
  
  // 读取旧版配置
  const legacyConfig = getLegacyApiConfig();
  const newConfig = createDefaultApiPoolConfig();
  
  let migrationCount = 0;
  
  // 迁移每个provider的API key
  if (legacyConfig.deepseek) {
    newConfig.pools.deepseek.push(createApiConfig('deepseek', legacyConfig.deepseek));
    migrationCount++;
  }
  
  if (legacyConfig.gemini) {
    newConfig.pools.gemini.push(createApiConfig('gemini', legacyConfig.gemini));
    migrationCount++;
  }
  
  if (legacyConfig.openai) {
    newConfig.pools.openai.push(createApiConfig('openai', legacyConfig.openai));
    migrationCount++;
  }
  
  // 保存新配置
  localStorage.setItem('api_pool_config', JSON.stringify(newConfig));
  
  if (migrationCount > 0) {
    console.log(`✅ API配置迁移完成，迁移了 ${migrationCount} 个API配置`);
    
    // 可选：备份旧配置（保留一段时间）
    const backup = {
      timestamp: Date.now(),
      config: legacyConfig
    };
    localStorage.setItem('api_config_backup', JSON.stringify(backup));
  } else {
    console.log('ℹ️ 没有发现旧版API配置，创建默认配置');
  }
  
  return newConfig;
};

// 验证和修复配置完整性
const validateAndRepairConfig = (config: any): ApiPoolConfig => {
  const repaired = createDefaultApiPoolConfig();
  
  // 处理旧版全局mode到新版per-provider模式的迁移
  if (config.mode && ['single', 'active_only', 'round_robin'].includes(config.mode)) {
    // 将旧的全局mode应用到所有provider
    Object.keys(repaired.providerModes).forEach(provider => {
      repaired.providerModes[provider] = config.mode;
    });
  }
  
  // 复制新版的per-provider模式配置
  if (config.providerModes && typeof config.providerModes === 'object') {
    Object.keys(repaired.providerModes).forEach(provider => {
      if (config.providerModes[provider] && ['single', 'active_only', 'round_robin'].includes(config.providerModes[provider])) {
        repaired.providerModes[provider] = config.providerModes[provider];
      }
    });
  }
  
  if (config.pools && typeof config.pools === 'object') {
    Object.keys(repaired.pools).forEach(provider => {
      if (config.pools[provider] && Array.isArray(config.pools[provider])) {
        repaired.pools[provider] = config.pools[provider].map((api: any) => ({
          id: api.id || generateId(),
          name: api.name || `${provider} API`,
          provider: api.provider || provider,
          apiKey: api.apiKey || '',
          isActive: api.isActive !== undefined ? api.isActive : true,
          priority: api.priority || 5,
          lastUsedAt: api.lastUsedAt || 0,
          errorCount: api.errorCount || 0,
          isHealthy: api.isHealthy !== undefined ? api.isHealthy : true,
          baseUrl: api.baseUrl,
          model: api.model,
          maxRetries: api.maxRetries
        }));
      }
    });
  }
  
  if (config.roundRobinState && typeof config.roundRobinState === 'object') {
    repaired.roundRobinState = { ...repaired.roundRobinState, ...config.roundRobinState };
  }
  
  if (config.globalSettings && typeof config.globalSettings === 'object') {
    repaired.globalSettings = { ...repaired.globalSettings, ...config.globalSettings };
  }
  
  // 保存修复后的配置
  localStorage.setItem('api_pool_config', JSON.stringify(repaired));
  
  return repaired;
};

// 清理旧版配置（在确认迁移成功后调用）
export const cleanupLegacyConfig = (): void => {
  const keysToRemove = ['api_key_deepseek', 'api_key_gemini', 'api_key_openai'];
  
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`🗑️ 清理旧版配置: ${key}`);
    }
  });
};

// 导出配置到文件（用于备份）
export const exportApiConfig = (): string => {
  const config = localStorage.getItem('api_pool_config');
  if (!config) {
    throw new Error('没有找到API配置');
  }
  
  const exportData = {
    version: '2.0',
    timestamp: Date.now(),
    config: JSON.parse(config)
  };
  
  return JSON.stringify(exportData, null, 2);
};

// 从文件导入配置
export const importApiConfig = (configJson: string): boolean => {
  try {
    const importData = JSON.parse(configJson);
    
    if (importData.version && importData.config) {
      const validatedConfig = validateAndRepairConfig(importData.config);
      localStorage.setItem('api_pool_config', JSON.stringify(validatedConfig));
      console.log('✅ API配置导入成功');
      return true;
    } else {
      throw new Error('配置文件格式不正确');
    }
  } catch (error) {
    console.error('❌ API配置导入失败:', error);
    return false;
  }
};

// 检查是否需要迁移
export const needsMigration = (): boolean => {
  const hasNewConfig = localStorage.getItem('api_pool_config');
  const hasLegacyConfig = 
    localStorage.getItem('api_key_deepseek') ||
    localStorage.getItem('api_key_gemini') ||
    localStorage.getItem('api_key_openai');
  
  return !hasNewConfig && !!hasLegacyConfig;
};