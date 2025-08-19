-- Phase 2 Step 2.1: Prompt模板库表结构（修复版本）
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 创建 prompt_templates 表
CREATE TABLE IF NOT EXISTS prompt_templates (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN (
    '用户角色设定', 
    '注意事项', 
    '初始情景', 
    '特殊要求', 
    '自定义模块'
  )),
  content JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_id ON prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_type ON prompt_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_public ON prompt_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_created_at ON prompt_templates(created_at DESC);

-- 3. 启用行级安全策略
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- 4. 创建安全策略
-- 用户可以查看公开模板和自己的模板
CREATE POLICY "用户可以查看公开模板和自己的模板" ON prompt_templates
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- 用户只能操作自己的模板
CREATE POLICY "用户只能操作自己的模板" ON prompt_templates
  FOR ALL USING (auth.uid() = user_id);

-- 5. 创建更新触发器
CREATE TRIGGER update_prompt_templates_updated_at 
  BEFORE UPDATE ON prompt_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 完成！Prompt模板表已创建
-- 注意：预置模板需要在有用户后手动创建，或者可以在应用中动态创建
