-- 创建记忆表格存储表
CREATE TABLE IF NOT EXISTS public.chat_memories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 记忆基础信息
    type TEXT NOT NULL CHECK (type IN ('character', 'event', 'setting', 'emotion')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),

    -- 记忆特定字段 (JSON格式存储，方便扩展)
    metadata JSONB DEFAULT '{}',

    -- 标记是否为AI自动生成还是用户手动添加
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),

    -- 关联的摘要ID（如果是从摘要中提取的）
    summary_id INTEGER REFERENCES public.chat_summaries(id) ON DELETE SET NULL,

    -- 关联的消息ID范围（从哪些消息中提取的）
    start_message_id INTEGER,
    end_message_id INTEGER,

    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_chat_memories_session_user
ON public.chat_memories(session_id, user_id);

CREATE INDEX IF NOT EXISTS idx_chat_memories_type
ON public.chat_memories(type);

CREATE INDEX IF NOT EXISTS idx_chat_memories_importance
ON public.chat_memories(importance DESC);

CREATE INDEX IF NOT EXISTS idx_chat_memories_created_at
ON public.chat_memories(created_at DESC);

-- 启用RLS (Row Level Security)
ALTER TABLE public.chat_memories ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能访问自己的记忆
CREATE POLICY "Users can view their own memories"
ON public.chat_memories FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own memories"
ON public.chat_memories FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own memories"
ON public.chat_memories FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own memories"
ON public.chat_memories FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 创建触发器自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_chat_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_memories_updated_at
    BEFORE UPDATE ON public.chat_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_memories_updated_at();

-- 为现有的 chat_summaries 表添加 memory_table 字段来存储结构化记忆数据
ALTER TABLE public.chat_summaries
ADD COLUMN IF NOT EXISTS memory_table JSONB DEFAULT NULL;

-- 创建一个函数来从记忆表格生成格式化的摘要文本
CREATE OR REPLACE FUNCTION format_memory_table_summary(
    p_session_id TEXT,
    p_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    character_memories TEXT := '';
    event_memories TEXT := '';
    setting_memories TEXT := '';
    emotion_memories TEXT := '';
    memory_record RECORD;
BEGIN
    -- 获取人物记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO character_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'character'
      AND importance >= 3;

    -- 获取事件记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO event_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'event'
      AND importance >= 3;

    -- 获取设定记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO setting_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'setting'
      AND importance >= 3;

    -- 获取情感记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO emotion_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'emotion'
      AND importance >= 3;

    -- 格式化输出
    result := '【结构化记忆摘要】' || E'\n\n';

    IF character_memories IS NOT NULL THEN
        result := result || '人物记忆：' || E'\n' || character_memories || E'\n\n';
    END IF;

    IF event_memories IS NOT NULL THEN
        result := result || '事件记忆：' || E'\n' || event_memories || E'\n\n';
    END IF;

    IF setting_memories IS NOT NULL THEN
        result := result || '设定记忆：' || E'\n' || setting_memories || E'\n\n';
    END IF;

    IF emotion_memories IS NOT NULL THEN
        result := result || '情感记忆：' || E'\n' || emotion_memories || E'\n\n';
    END IF;

    IF result = '【结构化记忆摘要】' || E'\n\n' THEN
        result := NULL; -- 如果没有任何记忆，返回NULL
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 创建一个函数来获取记忆增强的有效摘要
CREATE OR REPLACE FUNCTION get_memory_enhanced_summaries(
    p_session_id TEXT,
    p_user_id UUID
)
RETURNS TABLE (
    id INTEGER,
    session_id TEXT,
    user_id UUID,
    content TEXT,
    summary_level INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    memory_table JSONB,
    memory_summary TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.session_id,
        s.user_id,
        s.content,
        s.summary_level,
        s.is_active,
        s.created_at,
        s.updated_at,
        s.memory_table,
        format_memory_table_summary(p_session_id, p_user_id) as memory_summary
    FROM public.chat_summaries s
    WHERE s.session_id = p_session_id
      AND s.user_id = p_user_id
      AND s.is_active = true
    ORDER BY s.summary_level DESC, s.created_at ASC;
END;
$$ LANGUAGE plpgsql;