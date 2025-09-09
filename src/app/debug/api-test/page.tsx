'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiConfig } from '../../lib/useApiConfig';

export default function ApiTestPage() {
  const {
    config,
    availableModels,
    getModelConfig,
    getModelDisplayName,
    hasAnyApiConfig,
    getModeDisplayText,
    getHealthStats,
    getProviderMode,
    setProviderMode,
    addApi,
    testApiConnection
  } = useApiConfig();
  
  const [testModel, setTestModel] = useState('');
  const [testResults, setTestResults] = useState<any>(null);
  
  const handleTestModelConfig = () => {
    if (!testModel) return;
    
    const modelConfig = getModelConfig(testModel);
    setTestResults({
      model: testModel,
      config: modelConfig,
      displayName: getModelDisplayName(testModel)
    });
  };
  
  const handleAddTestApi = () => {
    const apiId = addApi('gemini', {
      name: '测试Gemini API',
      provider: 'gemini',
      apiKey: 'test-key-' + Date.now(),
      isActive: true,
      priority: 5,
      lastUsedAt: 0,
      errorCount: 0,
      isHealthy: true
    });
    
    console.log('添加测试API成功，ID:', apiId);
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">API配置系统测试页面</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 基础信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <strong>有API配置:</strong> {hasAnyApiConfig() ? '是' : '否'}
            </div>
            <div>
              <strong>当前模式:</strong> {getModeDisplayText()}
            </div>
            <div>
              <strong>健康统计:</strong> {(() => {
                const stats = getHealthStats();
                return `${stats.healthy}/${stats.total} 健康`;
              })()}
            </div>
            <div>
              <strong>可用模型数量:</strong> {availableModels.length}
            </div>
          </CardContent>
        </Card>
        
        {/* 可用模型列表 */}
        <Card>
          <CardHeader>
            <CardTitle>可用模型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableModels.map((model) => (
                <div key={model} className="text-sm p-2 bg-slate-100 dark:bg-slate-700 rounded">
                  <div className="font-medium">{getModelDisplayName(model)}</div>
                  <div className="text-xs text-slate-500">{model}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* 模型配置测试 */}
        <Card>
          <CardHeader>
            <CardTitle>测试模型配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex space-x-2">
              <Input
                placeholder="输入模型名称"
                value={testModel}
                onChange={(e) => setTestModel(e.target.value)}
              />
              <Button onClick={handleTestModelConfig}>
                测试
              </Button>
            </div>
            
            {testResults && (
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* 快速操作 */}
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => {
              // 为所有provider设置单API模式
              ['deepseek', 'gemini', 'openai', 'custom'].forEach(provider => {
                setProviderMode(provider, 'single');
              });
            }} variant="outline" className="w-full">
              切换到单API模式
            </Button>
            <Button onClick={() => {
              // 为所有provider设置轮询模式
              ['deepseek', 'gemini', 'openai', 'custom'].forEach(provider => {
                setProviderMode(provider, 'round_robin');
              });
            }} variant="outline" className="w-full">
              切换到轮询模式
            </Button>
            <Button onClick={handleAddTestApi} variant="outline" className="w-full">
              添加测试API
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* 配置详情 */}
      <Card>
        <CardHeader>
          <CardTitle>完整配置</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-x-auto bg-slate-100 dark:bg-slate-800 p-4 rounded">
            {JSON.stringify(config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}