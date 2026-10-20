-- 为chat_memories表添加is_enabled字段
-- 用于控制记忆条目是否在生成时被使用

ALTER TABLE chat_memories
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_chat_memories_enabled
ON chat_memories(session_id, user_id, is_enabled)
WHERE is_enabled = true;

-- 更新现有记忆条目为启用状态
UPDATE chat_memories
SET is_enabled = true
WHERE is_enabled IS NULL;

COMMENT ON COLUMN chat_memories.is_enabled IS '记忆是否启用，false表示禁用但不删除';
