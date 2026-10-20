-- Phase 2.3.1: 高级玩法实现 - 数据库结构调整（修复版本）
-- 在 Supabase SQL Editor 中执行此脚本
-- 目标：支持日记和论坛帖子生成功能

-- 1. 为 chat_messages 表添加 type 字段
-- 这个字段用于区分不同类型的消息：'message'(普通聊天), 'diary'(日记), 'forum_post'(论坛帖子)
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'message' 
CHECK (type IN ('message', 'diary', 'forum_post'));

-- 2. 为 chat_sessions 表添加截止点字段
-- 这些字段用于追踪每种内容类型的生成进度，确保增量生成
ALTER TABLE chat_sessions  
ADD COLUMN IF NOT EXISTS last_diary_cutoff_message_id BIGINT REFERENCES chat_messages(id);

ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS last_forum_cutoff_message_id BIGINT REFERENCES chat_messages(id);

-- 3. 为新增字段创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_type ON chat_messages(session_id, type);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_diary_cutoff ON chat_sessions(last_diary_cutoff_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_forum_cutoff ON chat_sessions(last_forum_cutoff_message_id);

-- 4. 更新现有的 RLS 策略以包含新的 type 字段
-- 注意：现有的策略已经足够，因为 type 字段不影响访问控制逻辑

-- 5. 创建辅助函数来获取增量消息
-- 这个函数将用于获取指定会话中从某个截止点之后的所有聊天消息
CREATE OR REPLACE FUNCTION get_incremental_messages(
  p_session_id UUID,
  p_cutoff_message_id BIGINT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  session_id UUID,
  role TEXT,
  content TEXT,
  type TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.session_id,
    cm.role,
    cm.content,
    cm.type,
    cm.created_at
  FROM chat_messages cm
  WHERE cm.session_id = p_session_id
    AND cm.type = 'message'  -- 只获取普通聊天消息作为生成内容的基础
    AND cm.id > p_cutoff_message_id
  ORDER BY cm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 创建函数来更新截止点
-- 这个函数将用于安全地更新会话的截止点
CREATE OR REPLACE FUNCTION update_session_cutoff(
  p_session_id UUID,
  p_content_type TEXT,
  p_new_cutoff_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 验证内容类型
  IF p_content_type NOT IN ('diary', 'forum_post') THEN
    RAISE EXCEPTION 'Invalid content type: %', p_content_type;
  END IF;
  
  -- 验证会话所有权
  IF NOT EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE id = p_session_id 
    AND user_id = auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- 更新对应的截止点
  IF p_content_type = 'diary' THEN
    UPDATE chat_sessions 
    SET last_diary_cutoff_message_id = p_new_cutoff_id
    WHERE id = p_session_id;
  ELSE
    UPDATE chat_sessions 
    SET last_forum_cutoff_message_id = p_new_cutoff_id
    WHERE id = p_session_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建视图来简化查询
-- 这个视图将提供会话的生成状态概览
CREATE OR REPLACE VIEW session_generation_status AS
SELECT 
  cs.id as session_id,
  cs.user_id,
  cs.character_id,
  cs.title,
  cs.last_diary_cutoff_message_id,
  cs.last_forum_cutoff_message_id,
  -- 计算每种类型的未处理消息数量
  (SELECT COUNT(*) FROM chat_messages cm 
   WHERE cm.session_id = cs.id 
   AND cm.type = 'message' 
   AND cm.id > COALESCE(cs.last_diary_cutoff_message_id, 0)) as unprocessed_diary_messages,
  (SELECT COUNT(*) FROM chat_messages cm 
   WHERE cm.session_id = cs.id 
   AND cm.type = 'message' 
   AND cm.id > COALESCE(cs.last_forum_cutoff_message_id, 0)) as unprocessed_forum_messages
FROM chat_sessions cs;

-- 注意：视图会自动继承 chat_sessions 表的 RLS 策略，无需单独创建策略

-- 完成！数据库结构调整已完成
-- 
-- 现在你的数据库支持：
-- 1. 在 chat_messages 表中存储不同类型的消息（聊天、日记、论坛帖子）
-- 2. 在 chat_sessions 表中追踪每种内容类型的生成进度
-- 3. 通过辅助函数和视图简化增量生成逻辑
-- 4. 保持了原有的安全策略和性能优化

