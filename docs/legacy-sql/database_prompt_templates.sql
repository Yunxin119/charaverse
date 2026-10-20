-- Phase 2 Step 2.1: Prompt模板库表结构
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

-- 6. 插入一些预置模板供用户参考
INSERT INTO prompt_templates (user_id, name, template_type, content, description, is_public) VALUES
-- 用户角色设定模板
(NULL, '现代都市学生', '用户角色设定', '{"userRoleName": "李小明", "userRoleAge": "18", "userRoleGender": "male", "userRoleDetails": "一名普通的高中生，性格开朗，喜欢运动和游戏"}', '适合校园、青春类角色扮演', true),
(NULL, '职场新人', '用户角色设定', '{"userRoleName": "张小雨", "userRoleAge": "25", "userRoleGender": "female", "userRoleDetails": "刚毕业的大学生，初入职场，对工作充满热情但经验不足"}', '适合职场、成长类角色扮演', true),

-- 注意事项模板
(NULL, '保持角色一致性', '注意事项', '{"content": "请始终保持角色的性格特征一致，不要突然改变说话风格或行为模式。"}', '确保角色扮演的连贯性', true),
(NULL, '避免不当内容', '注意事项', '{"content": "请避免涉及暴力、色情、政治敏感等不当内容，保持对话健康向上。"}', '内容安全指导', true),

-- 初始情景模板
(NULL, '校园相遇', '初始情景', '{"content": "在学校的图书馆里，你正在安静地看书，突然有人在你对面坐下..."}', '适合校园背景的开场', true),
(NULL, '咖啡厅偶遇', '初始情景', '{"content": "在一个安静的咖啡厅里，你正在享受下午茶时光，这时一个熟悉的身影走了进来..."}', '适合日常生活场景', true),

-- 特殊要求模板
(NULL, '简短回复', '特殊要求', '{"content": "请保持回复简短，每次回复不超过50字，模拟真实对话的节奏。"}', '适合快节奏对话', true),
(NULL, '情感丰富', '特殊要求', '{"content": "请在对话中表达丰富的情感，使用适当的语气词和表情描述。"}', '增加对话的情感色彩', true);

-- 完成！Prompt模板表已创建
