📋 CharaVerse API 轮询功能开发计划

Phase 1: 数据结构重构 (Data Architecture)

Step 1.1: 重新设计 API 配置数据结构
// 新的 API 配置接口
interface ApiConfig {
id: string;
name: string; // 用户自定义名称，如 "Gemini-主力", "Gemini-备用 1"
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

}

interface ApiPoolConfig {
mode: 'single' | 'active_only' | 'round_robin';
pools: {
[provider: string]: ApiConfig[];
};
roundRobinState: {
[provider: string]: number; // 当前轮询索引
};
}

Step 1.2: localStorage 数据迁移
// utils/apiMigration.ts
const migrateApiConfig = () => {
// 将现有的单 key 格式迁移到新的多 key 格式
const oldGemini = localStorage.getItem('api_key_gemini');
if (oldGemini && !localStorage.getItem('api_pool_config')) {
const newConfig: ApiPoolConfig = {
mode: 'single',
pools: {
gemini: [{
id: generateId(),
name: 'Gemini 默认',
provider: 'gemini',
apiKey: oldGemini,
isActive: true,
priority: 5,
lastUsedAt: 0,
errorCount: 0,
isHealthy: true
}]
},
roundRobinState: { gemini: 0 }
};
localStorage.setItem('api_pool_config', JSON.stringify(newConfig));
}
};

Phase 2: UI 界面重构 (User Interface)

Step 2.1: 设置页面 UI 改造
// app/settings/page.tsx - 新增 API 池管理 UI
const ApiPoolManager = ({ provider }: { provider: string }) => {
return (
<Card className="space-y-4">

<div className="flex items-center justify-between">
<h3 className="text-lg font-semibold">{provider.toUpperCase()} API 池</h3>

          {/* 模式选择器 */}
          <Select value={mode} onValueChange={setMode}>
            <SelectItem value="single">单API模式</SelectItem>
            <SelectItem value="active_only">多API选择模式</SelectItem>
            <SelectItem value="round_robin">轮询模式</SelectItem>
          </Select>
        </div>

        {/* API列表 */}
        <div className="space-y-3">
          {apis.map((api, index) => (
            <div key={api.id} className="flex items-center space-x-3 p-3 border rounded-lg">
              {/* 健康状态指示器 */}
              <div className={`w-3 h-3 rounded-full ${
                api.isHealthy ? 'bg-green-500' : 'bg-red-500'
              }`} />

              {/* API名称和key输入 */}
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="API名称 (如: Gemini-主力)"
                  value={api.name}
                  onChange={(e) => updateApiName(api.id, e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="API Key"
                  value={api.apiKey}
                  onChange={(e) => updateApiKey(api.id, e.target.value)}
                />
              </div>

              {/* 控制按钮 */}
              <div className="flex items-center space-x-2">
                {mode === 'active_only' && (
                  <Switch
                    checked={api.isActive}
                    onCheckedChange={(checked) => toggleApiActive(api.id, checked)}
                  />
                )}

                {mode === 'round_robin' && (
                  <Badge variant="outline">
                    优先级: {api.priority}
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testApiConnection(api.id)}
                >
                  <Zap className="w-4 h-4" />
                  测试
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeApi(api.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* 添加新API按钮 */}
        <Button
          variant="outline"
          onClick={() => addNewApi(provider)}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加新的 {provider.toUpperCase()} API
        </Button>

        {/* 轮询模式额外配置 */}
        {mode === 'round_robin' && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <h4 className="font-medium mb-2">轮询配置</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">失败重试次数:</span>
                <Input
                  type="number"
                  className="w-20"
                  min="1"
                  max="5"
                  value={retryCount}
                  onChange={(e) => setRetryCount(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">健康检查间隔:</span>
                <Select value={healthCheckInterval} onValueChange={setHealthCheckInterval}>
                  <SelectItem value="5m">5分钟</SelectItem>
                  <SelectItem value="15m">15分钟</SelectItem>
                  <SelectItem value="30m">30分钟</SelectItem>
                </Select>
              </div>
            </div>
          </div>
        )}
      </Card>
    );

};

Phase 3: 核心轮询逻辑 (Core Logic)

Step 3.1: API 选择器服务
// lib/apiSelector.ts
class ApiSelector {
private config: ApiPoolConfig;

    constructor() {
      this.config = this.loadConfig();
    }

    // 根据模式选择API
    selectApi(provider: string): ApiConfig | null {
      const pool = this.config.pools[provider] || [];

      switch (this.config.mode) {
        case 'single':
          return pool.find(api => api.isActive) || pool[0] || null;

        case 'active_only':
          const activeApis = pool.filter(api => api.isActive && api.isHealthy);
          return activeApis.length > 0 ? activeApis[0] : null;

        case 'round_robin':
          return this.selectRoundRobin(provider);

        default:
          return null;
      }
    }

    // 轮询选择逻辑
    private selectRoundRobin(provider: string): ApiConfig | null {
      const pool = this.config.pools[provider] || [];
      const healthyApis = pool.filter(api => api.isActive && api.isHealthy);

      if (healthyApis.length === 0) return null;

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
    markApiError(apiId: string) {
      Object.values(this.config.pools).forEach(pool => {
        const api = pool.find(a => a.id === apiId);
        if (api) {
          api.errorCount++;
          // 连续3次错误就标记为不健康
          if (api.errorCount >= 3) {
            api.isHealthy = false;
          }
        }
      });
      this.saveConfig();
    }

    // 标记API成功
    markApiSuccess(apiId: string) {
      Object.values(this.config.pools).forEach(pool => {
        const api = pool.find(a => a.id === apiId);
        if (api) {
          api.errorCount = 0;
          api.isHealthy = true;
          api.lastUsedAt = Date.now();
        }
      });
      this.saveConfig();
    }

}

export const apiSelector = new ApiSelector();

Step 3.2: 聊天 API 重构
// app/api/chat/route.ts - 重构以支持 API 轮询
export async function POST(request: Request) {
try {
const { model, systemPrompt, messages, sessionId, userMessage } = await request.json();

      // 解析provider
      const provider = model.split('-')[0]; // 如 'gemini-3-pro-preview' -> 'gemini'

      // 选择API
      const selectedApi = apiSelector.selectApi(provider);

      if (!selectedApi) {
        return Response.json(
          { error: `没有可用的${provider} API` },
          { status: 400 }
        );
      }

      console.log(`🔄 使用API: ${selectedApi.name} (ID: ${selectedApi.id})`);

      try {
        // 调用AI API
        const response = await callAiApi({
          apiConfig: selectedApi,
          model,
          messages,
          systemPrompt
        });

        // 标记成功
        apiSelector.markApiSuccess(selectedApi.id);

        return Response.json({
          content: response.content,
          apiUsed: selectedApi.name // 返回使用的API信息
        });

      } catch (apiError) {
        console.error(`❌ API ${selectedApi.name} 调用失败:`, apiError);

        // 标记错误
        apiSelector.markApiError(selectedApi.id);

        // 在轮询模式下，尝试使用下一个API
        if (apiSelector.getMode() === 'round_robin') {
          const fallbackApi = apiSelector.selectApi(provider);
          if (fallbackApi && fallbackApi.id !== selectedApi.id) {
            console.log(`🔄 回退到API: ${fallbackApi.name}`);

            try {
              const fallbackResponse = await callAiApi({
                apiConfig: fallbackApi,
                model,
                messages,
                systemPrompt
              });

              apiSelector.markApiSuccess(fallbackApi.id);
              return Response.json({
                content: fallbackResponse.content,
                apiUsed: fallbackApi.name,
                fallbackUsed: true
              });
            } catch (fallbackError) {
              apiSelector.markApiError(fallbackApi.id);
            }
          }
        }

        throw apiError;
      }

    } catch (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

}

Phase 4: 健康监控与故障恢复 (Health Monitoring)

Step 4.1: 健康检查服务
// lib/healthChecker.ts
class HealthChecker {
private checkInterval: NodeJS.Timeout | null = null;

    startMonitoring() {
      this.checkInterval = setInterval(() => {
        this.performHealthChecks();
      }, 15 * 60 * 1000); // 每15分钟检查一次
    }

    stopMonitoring() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }

    private async performHealthChecks() {
      const config = apiSelector.getConfig();

      for (const [provider, pool] of Object.entries(config.pools)) {
        for (const api of pool) {
          if (!api.isHealthy && api.errorCount >= 3) {
            // 对不健康的API进行恢复测试
            const isHealthy = await this.testApiHealth(api);
            if (isHealthy) {
              api.isHealthy = true;
              api.errorCount = 0;
              console.log(`✅ API ${api.name} 已恢复健康`);
            }
          }
        }
      }

      apiSelector.saveConfig();
    }

    private async testApiHealth(api: ApiConfig): Promise<boolean> {
      try {
        // 发送一个简单的测试请求
        const testResponse = await fetch('/api/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: api.provider,
            apiKey: api.apiKey,
            baseUrl: api.baseUrl
          })
        });

        return testResponse.ok;
      } catch {
        return false;
      }
    }

}

export const healthChecker = new HealthChecker();

Phase 5: 用户体验优化 (UX Enhancement)

Step 5.1: 聊天界面状态显示
// 在聊天页面显示当前使用的 API 信息
const ApiStatusIndicator = () => {
const [currentApi, setCurrentApi] = useState<string>('');
const [apiMode, setApiMode] = useState<string>('single');

    return (
      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>使用: {currentApi || '默认API'}</span>
        </div>

        {apiMode === 'round_robin' && (
          <Badge variant="outline" className="text-xs">
            轮询模式
          </Badge>
        )}
      </div>
    );

};

Step 5.2: 实时通知系统
// 当 API 切换或出现错误时显示 toast 通知
const useApiNotifications = () => {
useEffect(() => {
const handleApiSwitch = (event: CustomEvent) => {
toast.success(`已切换到: ${event.detail.apiName}`);
};

      const handleApiError = (event: CustomEvent) => {
        toast.error(`API错误: ${event.detail.apiName}, 正在尝试备用API`);
      };

      window.addEventListener('apiSwitch', handleApiSwitch);
      window.addEventListener('apiError', handleApiError);

      return () => {
        window.removeEventListener('apiSwitch', handleApiSwitch);
        window.removeEventListener('apiError', handleApiError);
      };
    }, []);

};

Phase 6: 测试与部署 (Testing & Deployment)

Step 6.1: 单元测试
// **tests**/apiSelector.test.ts
describe('ApiSelector', () => {
test('single mode selects first active API', () => {
// 测试单 API 模式
});

    test('round_robin mode rotates through APIs', () => {
      // 测试轮询模式
    });

    test('handles API failures gracefully', () => {
      // 测试错误处理
    });

});

Step 6.2: 渐进式部署

1. 先部署数据迁移逻辑，确保现有用户无感知
2. 逐步开放新功能，默认保持单 API 模式
3. 提供用户引导，介绍新功能的使用方法

📊 预期效果

- 速度提升: 轮询模式可以避开 API 限流，理论提升 30-50%响应速度
- 可靠性: 故障自动切换，可用性从 95%提升到 99%+
- 成本优化: 分散请求到多个账户，避免单账户配额限制
- 用户体验: 透明的 API 管理，无感知的故障恢复
