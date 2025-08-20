-- Phase 5: 高级交互模式数据库升级
-- 执行时间：请在 Supabase SQL Editor 中执行此脚本

-- 1. 为会话表添加模式控制字段
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS current_mode TEXT NOT NULL DEFAULT 'story', -- 'story' (剧情模式) 或 'casual' (闲聊模式)
ADD COLUMN IF NOT EXISTS is_inner_thoughts_enabled BOOLEAN NOT NULL DEFAULT false; -- 是否启用内心想法

-- 2. 为消息表添加元数据字段
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS metadata JSONB; -- 存储消息的额外元数据

-- 3. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_chat_sessions_current_mode ON chat_sessions(current_mode);
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata ON chat_messages USING GIN(metadata);

-- 4. 添加约束确保数据完整性
ALTER TABLE chat_sessions
ADD CONSTRAINT check_current_mode 
CHECK (current_mode IN ('story', 'casual'));

-- 5. 验证迁移成功的查询
-- 执行完上述脚本后，可以运行以下查询验证：
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name IN ('chat_sessions', 'chat_messages') 
-- AND column_name IN ('current_mode', 'is_inner_thoughts_enabled', 'metadata');