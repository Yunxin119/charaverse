-- 升级摘要表以支持分层摘要系统
-- 在 Supabase SQL Editor 中执行此脚本

-- 添加摘要层级相关字段
ALTER TABLE chat_summaries
ADD COLUMN IF NOT EXISTS summary_level INTEGER DEFAULT 1,  -- 摘要层级：1=原始摘要，2=超级摘要
ADD COLUMN IF NOT EXISTS parent_summaries BIGINT[],       -- 父摘要ID数组（用于超级摘要）
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,   -- 摘要是否有效
ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,       -- 失效时间
ADD COLUMN IF NOT EXISTS compressed_at TIMESTAMPTZ;        -- 压缩时间（转换为父摘要的时间）

-- 创建新的索引
CREATE INDEX IF NOT EXISTS idx_chat_summaries_level_active ON chat_summaries(session_id, summary_level, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_message_range ON chat_summaries(session_id, start_message_id, end_message_id) WHERE is_active = true;

-- 创建检查约束
ALTER TABLE chat_summaries
ADD CONSTRAINT chat_summaries_level_check CHECK (summary_level >= 1 AND summary_level <= 3),
ADD CONSTRAINT chat_summaries_parent_check CHECK (
  (summary_level = 1 AND parent_summaries IS NULL) OR
  (summary_level > 1 AND parent_summaries IS NOT NULL AND array_length(parent_summaries, 1) > 0)
);

-- 创建函数来检测摘要失效
CREATE OR REPLACE FUNCTION detect_summary_invalidation()
RETURNS TRIGGER AS $$
BEGIN
  -- 当消息被删除时，检查是否有摘要需要失效
  IF TG_OP = 'DELETE' THEN
    -- 失效所有包含被删除消息的摘要
    UPDATE chat_summaries
    SET is_active = false,
        invalidated_at = NOW()
    WHERE session_id = OLD.session_id
      AND is_active = true
      AND (
        (start_message_id <= OLD.id AND end_message_id >= OLD.id) OR
        (start_message_id IS NULL OR end_message_id IS NULL)
      );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- 创建触发器来自动检测摘要失效
DROP TRIGGER IF EXISTS trigger_detect_summary_invalidation ON chat_messages;
CREATE TRIGGER trigger_detect_summary_invalidation
  AFTER DELETE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION detect_summary_invalidation();

-- 创建函数来获取有效摘要（按层级优先）
CREATE OR REPLACE FUNCTION get_effective_summaries(p_session_id UUID, p_user_id UUID)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  summary_level INTEGER,
  created_at TIMESTAMPTZ,
  start_message_id BIGINT,
  end_message_id BIGINT,
  original_message_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH active_summaries AS (
    SELECT s.*
    FROM chat_summaries s
    WHERE s.session_id = p_session_id 
      AND s.user_id = p_user_id 
      AND s.is_active = true
    ORDER BY s.summary_level DESC, s.created_at ASC
  ),
  covered_ranges AS (
    -- 计算每个高级摘要覆盖的范围
    SELECT 
      s.id,
      s.summary_level,
      COALESCE(
        (SELECT MIN(start_message_id) FROM chat_summaries 
         WHERE id = ANY(s.parent_summaries) AND is_active = true),
        s.start_message_id
      ) as effective_start,
      COALESCE(
        (SELECT MAX(end_message_id) FROM chat_summaries 
         WHERE id = ANY(s.parent_summaries) AND is_active = true),
        s.end_message_id
      ) as effective_end
    FROM active_summaries s
  )
  SELECT DISTINCT ON (COALESCE(cr.effective_start, -1), COALESCE(cr.effective_end, -1))
    s.id,
    s.content,
    s.summary_level,
    s.created_at,
    s.start_message_id,
    s.end_message_id,
    s.original_message_count
  FROM active_summaries s
  LEFT JOIN covered_ranges cr ON s.id = cr.id
  ORDER BY COALESCE(cr.effective_start, -1), COALESCE(cr.effective_end, -1), s.summary_level DESC, s.created_at ASC;
END;
$$ language 'plpgsql';

COMMENT ON TABLE chat_summaries IS '聊天摘要表，支持分层摘要系统';
COMMENT ON COLUMN chat_summaries.summary_level IS '摘要层级：1=原始摘要，2=超级摘要，3=超级超级摘要等';
COMMENT ON COLUMN chat_summaries.parent_summaries IS '父摘要ID数组，用于记录超级摘要是基于哪些摘要生成的';
COMMENT ON COLUMN chat_summaries.is_active IS '摘要是否有效，当相关消息被删除时会被设为false';
COMMENT ON FUNCTION get_effective_summaries IS '获取有效摘要，自动选择最优的摘要组合避免重复覆盖';