-- 创建记忆版本历史表
-- 用于保存记忆的每次更新版本，支持删除摘要时回退

-- 1. 创建记忆版本表
CREATE TABLE IF NOT EXISTS chat_memory_versions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  version INTEGER NOT NULL,

  -- 记忆内容快照
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  importance INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 版本关联信息
  summary_id INTEGER NOT NULL,
  created_by_summary_id INTEGER NOT NULL,  -- 创建此版本的摘要ID
  start_message_id INTEGER,
  end_message_id INTEGER,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),

  -- 外键约束
  CONSTRAINT fk_memory_versions_memory
    FOREIGN KEY (memory_id)
    REFERENCES chat_memories(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_memory_versions_summary
    FOREIGN KEY (summary_id)
    REFERENCES chat_summaries(id)
    ON DELETE CASCADE,

  -- 唯一约束：同一记忆的版本号不重复
  UNIQUE(memory_id, version)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_memory_versions_memory_id
ON chat_memory_versions(memory_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_memory_versions_summary_id
ON chat_memory_versions(summary_id);

CREATE INDEX IF NOT EXISTS idx_memory_versions_created_at
ON chat_memory_versions(created_at DESC);

-- 3. 添加注释
COMMENT ON TABLE chat_memory_versions IS '记忆版本历史表，记录每次更新的完整快照';
COMMENT ON COLUMN chat_memory_versions.memory_id IS '关联的记忆ID';
COMMENT ON COLUMN chat_memory_versions.version IS '版本号，从1开始递增';
COMMENT ON COLUMN chat_memory_versions.created_by_summary_id IS '创建此版本的摘要ID';
COMMENT ON COLUMN chat_memory_versions.summary_id IS '此版本所属的摘要ID（用于回退）';

-- 4. 为现有记忆添加 current_version 字段
ALTER TABLE chat_memories
ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

COMMENT ON COLUMN chat_memories.current_version IS '当前版本号，对应 chat_memory_versions.version';

-- 5. 创建触发器：自动保存版本（可选）
-- 注：我们在应用层手动控制版本保存，所以这里不创建触发器
-- 但保留此注释以说明可选方案

-- 验证表结构
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_memory_versions'
ORDER BY ordinal_position;
