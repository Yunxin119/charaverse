-- Phase 2.3: 日记系统数据库表创建
-- 在 Supabase SQL Editor 中执行此脚本

CREATE TABLE IF NOT EXISTS diaries (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关键字段：记录这篇日记是基于哪些消息生成的
  source_message_id_start BIGINT REFERENCES chat_messages(id),
  source_message_id_end BIGINT REFERENCES chat_messages(id),
  
  -- 索引优化
  CONSTRAINT diaries_session_user_check CHECK (session_id IS NOT NULL AND user_id IS NOT NULL)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_diaries_session_id ON diaries(session_id);
CREATE INDEX IF NOT EXISTS idx_diaries_user_id ON diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_diaries_created_at ON diaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diaries_session_created ON diaries(session_id, created_at DESC);

-- 创建RLS（行级安全）策略
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;

-- 用户只能看到自己的日记
CREATE POLICY "Users can view their own diaries" ON diaries
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能创建自己的日记
CREATE POLICY "Users can create their own diaries" ON diaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的日记
CREATE POLICY "Users can update their own diaries" ON diaries
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的日记
CREATE POLICY "Users can delete their own diaries" ON diaries
  FOR DELETE USING (auth.uid() = user_id);

-- 更新 updated_at 字段的触发器
CREATE OR REPLACE FUNCTION update_diaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_diaries_updated_at
  BEFORE UPDATE ON diaries
  FOR EACH ROW
  EXECUTE FUNCTION update_diaries_updated_at();

-- 验证表结构的查询（可选，用于调试）
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'diaries' 
-- ORDER BY ordinal_position;