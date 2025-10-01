import { useState, useEffect, useCallback } from 'react';
import { apiManager } from './apiManager';
import { ApiConfig, ApiPoolConfig } from '../types/apiConfig';

// 兼容旧版本的命名中转配置接口
interface NamedRelayConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  description?: string;
  supportsThinking?: boolean;
  thinkingBudgetMode?: 'auto' | 'manual';
  thinkingBudget?: number;
}

// 模型配置结果接口
interface ModelConfig {
  apiKey: string | null;
  baseUrl?: string;
  modelName?: string;
  isRelay: boolean;
  apiId?: string; // 新增：API配置ID，用于追踪使用情况
  apiName?: string; // 新增：API配置名称
}

export function useApiConfig() {
  const [config, setConfig] = useState<ApiPoolConfig>(apiManager.getConfig());
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // 监听配置变化
  useEffect(() => {
    const handleConfigChange = () => {
      setConfig(apiManager.getConfig());
      updateAvailableModels();
    };

    apiManager.addListener(handleConfigChange);
    
    // 初始化时更新可用模型
    updateAvailableModels();

    return () => {
      apiManager.removeListener(handleConfigChange);
    };
  }, []);

  // 更新可用模型列表
  const updateAvailableModels = useCallback(() => {
    const models: string[] = [];
    const currentConfig = apiManager.getConfig();

    // 从新的API池系统获取模型
    for (const [provider, pool] of Object.entries(currentConfig.pools)) {
      const activeApis = pool.filter(api => api.isActive);
      
      if (activeApis.length > 0) {
        switch (provider) {
          case 'deepseek':
            models.push('deepseek-chat', 'deepseek-reasoner');
            break;
          case 'gemini':
            models.push('gemini-2.5-flash', 'gemini-2.5-pro');
            break;
          case 'openai':
            models.push('gpt-4o', 'gpt-4o-mini');
            break;
          case 'custom':
            // 自定义provider的模型会在下面的命名中转配置中处理
            break;
        }
      }
    }

    // 兼容旧版命名中转配置
    try {
      const savedNamedConfigs = localStorage.getItem('named_relay_configs');
      if (savedNamedConfigs) {
        const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs);
        namedConfigs.forEach((namedConfig) => {
          // 验证配置完整性后才添加到可用模型列表
          if (namedConfig.id && namedConfig.apiKey && namedConfig.baseUrl && namedConfig.modelName) {
            models.push(`named-relay-${namedConfig.id}`);
          } else {
            console.warn(`跳过不完整的命名中转配置: ${namedConfig.id}`);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to parse named relay configs:', e);
    }

    setAvailableModels(models);
    
    if (models.length === 0) {
      console.warn('No models available - user needs to configure API keys');
    }
  }, []);

  // 获取模型配置（支持轮询选择）
  const getModelConfig = useCallback((model: string): ModelConfig => {
    // 处理命名中转配置（向后兼容）
    if (model.startsWith('named-relay-')) {
      const configId = model.replace('named-relay-', '');
      try {
        const savedNamedConfigs = localStorage.getItem('named_relay_configs');
        if (savedNamedConfigs) {
          const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs);
          const config = namedConfigs.find(c => c.id === configId);
          if (config) {
            return {
              apiKey: config.apiKey,
              baseUrl: config.baseUrl,
              modelName: config.modelName,
              isRelay: true,
              apiId: configId,
              apiName: config.name
            };
          }
        }
      } catch (e) {
        console.warn('Failed to parse named relay configs:', e);
      }

      // 如果找不到对应的命名中转配置，返回错误信息
      console.error(`❌ 命名中转配置不存在: ${configId}`);
      throw new Error(`命名中转配置 ${configId} 不存在，请检查配置是否已删除或损坏`);
    }

    // 处理标准模型 - 使用新的API选择逻辑
    let provider: string;
    if (model.startsWith('deepseek')) provider = 'deepseek';
    else if (model.startsWith('gemini')) provider = 'gemini';
    else if (model.startsWith('gpt')) provider = 'openai';
    else provider = 'custom';

    // 从API管理器选择API
    const selectedApi = apiManager.selectApi(provider);
    
    if (selectedApi) {
      const providerMode = apiManager.getProviderMode(provider);
      console.log(`🎯 选择API: ${selectedApi.name} (${provider}, 模式: ${providerMode})`);
      
      return {
        apiKey: selectedApi.apiKey,
        baseUrl: selectedApi.baseUrl,
        modelName: selectedApi.model,
        isRelay: !!selectedApi.baseUrl,
        apiId: selectedApi.id,
        apiName: selectedApi.name
      };
    }

    console.warn(`⚠️ 没有可用的 ${provider} API`);
    return {
      apiKey: null,
      isRelay: false
    };
  }, []);

  // 获取模型显示名称
  const getModelDisplayName = useCallback((model: string): string => {
    if (model.startsWith('named-relay-')) {
      const configId = model.replace('named-relay-', '');
      try {
        const savedNamedConfigs = localStorage.getItem('named_relay_configs');
        if (savedNamedConfigs) {
          const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs);
          const config = namedConfigs.find(c => c.id === configId);
          if (config) return config.name;
        }
      } catch (e) {
        console.warn('Failed to parse named relay configs');
      }
      return `中转配置 ${configId}`;
    }

    const modelNames: Record<string, string> = {
      'deepseek-chat': 'DeepSeek Chat (V3.1)',
      'deepseek-reasoner': 'DeepSeek Reasoner (V3.1)',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini'
    };

    return modelNames[model] || model;
  }, []);

  // 标记API成功/失败
  const markApiResult = useCallback((apiId: string | undefined, success: boolean) => {
    if (!apiId) return;
    
    if (success) {
      apiManager.markApiSuccess(apiId);
    } else {
      apiManager.markApiError(apiId);
    }
  }, []);

  // 检查是否有任何可用的API配置
  const hasAnyApiConfig = useCallback((): boolean => {
    const currentConfig = apiManager.getConfig();
    
    // 检查新的API池配置
    for (const pool of Object.values(currentConfig.pools)) {
      if (pool.some(api => api.isActive && api.apiKey)) {
        return true;
      }
    }

    // 检查旧版命名中转配置
    try {
      const savedNamedConfigs = localStorage.getItem('named_relay_configs');
      if (savedNamedConfigs) {
        const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs);
        return namedConfigs.length > 0;
      }
    } catch (e) {
      console.warn('Failed to parse named relay configs');
    }

    return false;
  }, []);

  // 获取指定provider的模式显示文本
  const getProviderModeDisplayText = useCallback((provider: string): string => {
    const mode = apiManager.getProviderMode(provider);
    switch (mode) {
      case 'single':
        return '单API模式';
      case 'active_only':
        return '多API选择模式';
      case 'round_robin':
        return '轮询模式';
      default:
        return '未知模式';
    }
  }, []);

  // 获取通用的模式显示文本（为了向后兼容）
  const getModeDisplayText = useCallback((): string => {
    // 检查所有provider的模式，如果都一样就显示统一模式，否则显示混合模式
    const providers = ['deepseek', 'gemini', 'openai', 'custom'];
    const modes = providers.map(p => apiManager.getProviderMode(p));
    const uniqueModes = [...new Set(modes)];
    
    if (uniqueModes.length === 1) {
      return getProviderModeDisplayText(providers[0]);
    } else {
      return '混合模式';
    }
  }, [getProviderModeDisplayText]);

  // 获取健康统计
  const getHealthStats = useCallback(() => {
    return apiManager.getHealthStats();
  }, []);

  // 清理无效的命名中转配置
  const cleanupInvalidNamedConfigs = useCallback(() => {
    try {
      const savedNamedConfigs = localStorage.getItem('named_relay_configs');
      if (savedNamedConfigs) {
        const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs);
        const validConfigs = namedConfigs.filter(config =>
          config.id && config.apiKey && config.baseUrl && config.modelName
        );

        if (validConfigs.length !== namedConfigs.length) {
          console.log(`🧹 清理了 ${namedConfigs.length - validConfigs.length} 个无效的命名中转配置`);
          localStorage.setItem('named_relay_configs', JSON.stringify(validConfigs));
          updateAvailableModels(); // 更新可用模型列表
          return true;
        }
      }
      return false;
    } catch (e) {
      console.warn('清理命名中转配置时出错:', e);
      return false;
    }
  }, [updateAvailableModels]);

  return {
    config,
    availableModels,
    getModelConfig,
    getModelDisplayName,
    markApiResult,
    hasAnyApiConfig,
    getProviderModeDisplayText,
    getModeDisplayText, // 向后兼容的通用模式显示
    getHealthStats,
    cleanupInvalidNamedConfigs,

    // 直接暴露API管理器的方法
    getProviderMode: apiManager.getProviderMode.bind(apiManager),
    setProviderMode: apiManager.setProviderMode.bind(apiManager),
    addApi: apiManager.addApi.bind(apiManager),
    updateApi: apiManager.updateApi.bind(apiManager),
    removeApi: apiManager.removeApi.bind(apiManager),
    testApiConnection: apiManager.testApiConnection.bind(apiManager),
    resetHealthStatus: apiManager.resetHealthStatus.bind(apiManager)
  };
}