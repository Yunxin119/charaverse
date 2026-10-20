-- 更新记忆表格类型约束，支持新增的记忆类型
-- 需要在Supabase SQL编辑器中执行此脚本

-- 1. 删除旧的类型约束
ALTER TABLE public.chat_memories 
DROP CONSTRAINT IF EXISTS chat_memories_type_check;

-- 2. 添加新的类型约束，包含所有8种记忆类型
ALTER TABLE public.chat_memories 
ADD CONSTRAINT chat_memories_type_check 
CHECK (type IN ('character', 'event', 'setting', 'emotion', 'spacetime', 'relationship', 'task', 'item'));

-- 3. 更新记忆格式化函数，支持新的记忆类型
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
    spacetime_memories TEXT := '';
    relationship_memories TEXT := '';
    task_memories TEXT := '';
    item_memories TEXT := '';
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

    -- 获取时空记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO spacetime_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'spacetime'
      AND importance >= 3;

    -- 获取关系记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO relationship_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'relationship'
      AND importance >= 3;

    -- 获取任务记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO task_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'task'
      AND importance >= 3;

    -- 获取物品记忆
    SELECT STRING_AGG(
        format('• %s: %s', title, content),
        E'\n'
        ORDER BY importance DESC, created_at DESC
    ) INTO item_memories
    FROM public.chat_memories
    WHERE session_id = p_session_id
      AND user_id = p_user_id
      AND type = 'item'
      AND importance >= 3;

    -- 格式化输出
    result := '【结构化记忆摘要】' || E'\n\n';

    IF character_memories IS NOT NULL THEN
        result := result || '👤 人物记忆：' || E'\n' || character_memories || E'\n\n';
    END IF;

    IF event_memories IS NOT NULL THEN
        result := result || '📅 事件记忆：' || E'\n' || event_memories || E'\n\n';
    END IF;

    IF setting_memories IS NOT NULL THEN
        result := result || '🏛️ 设定记忆：' || E'\n' || setting_memories || E'\n\n';
    END IF;

    IF emotion_memories IS NOT NULL THEN
        result := result || '💭 情感记忆：' || E'\n' || emotion_memories || E'\n\n';
    END IF;

    IF spacetime_memories IS NOT NULL THEN
        result := result || '⏰ 时空记忆：' || E'\n' || spacetime_memories || E'\n\n';
    END IF;

    IF relationship_memories IS NOT NULL THEN
        result := result || '🤝 关系记忆：' || E'\n' || relationship_memories || E'\n\n';
    END IF;

    IF task_memories IS NOT NULL THEN
        result := result || '📋 任务约定：' || E'\n' || task_memories || E'\n\n';
    END IF;

    IF item_memories IS NOT NULL THEN
        result := result || '📦 重要物品：' || E'\n' || item_memories || E'\n\n';
    END IF;

    IF result = '【结构化记忆摘要】' || E'\n\n' THEN
        RETURN '暂无重要记忆数据';
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 验证更新结果
SELECT 
    conname as constraint_name,
    consrc as constraint_definition
FROM pg_constraint 
WHERE conname = 'chat_memories_type_check';
