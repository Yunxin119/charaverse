-- 创建摘要表
-- 在 Supabase SQL Editor 中执行此脚本

CREATE TABLE IF NOT EXISTS chat_summaries (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 记录摘要覆盖的消息范围
  start_message_id BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
  end_message_id BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
  
  -- 摘要的元数据
  original_message_count INTEGER DEFAULT 0,
  summary_method VARCHAR(50) DEFAULT 'ai_generated',
  
  -- 约束条件
  CONSTRAINT chat_summaries_session_user_check CHECK (session_id IS NOT NULL AND user_id IS NOT NULL)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_chat_summaries_session_id ON chat_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_user_id ON chat_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON chat_summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_session_created ON chat_summaries(session_id, created_at DESC);

-- 创建RLS策略
ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

-- 用户只能看到自己的摘要
CREATE POLICY "Users can view their own summaries" ON chat_summaries
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能创建自己的摘要
CREATE POLICY "Users can create their own summaries" ON chat_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的摘要
CREATE POLICY "Users can update their own summaries" ON chat_summaries
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的摘要
CREATE POLICY "Users can delete their own summaries" ON chat_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- 更新 updated_at 字段的触发器
CREATE OR REPLACE FUNCTION update_chat_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_summaries_updated_at
  BEFORE UPDATE ON chat_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_summaries_updated_at();