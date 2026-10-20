-- 为 chat_summaries 表添加 memory_table 字段
-- 用于存储结构化记忆数据的 JSON 格式

-- 检查字段是否已存在，如果不存在则添加
DO $$
BEGIN
    -- 检查字段是否存在
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'chat_summaries'
        AND column_name = 'memory_table'
    ) THEN
        -- 添加字段
        ALTER TABLE public.chat_summaries
        ADD COLUMN memory_table JSONB DEFAULT NULL;

        -- 添加注释
        COMMENT ON COLUMN public.chat_summaries.memory_table IS '存储AI生成的结构化记忆数据，包含人物、事件、设定、情感等类型的记忆条目';

        RAISE NOTICE 'memory_table 字段已成功添加到 chat_summaries 表';
    ELSE
        RAISE NOTICE 'memory_table 字段已存在于 chat_summaries 表中';
    END IF;
END $$;

-- 验证字段添加
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'chat_summaries'
AND column_name = 'memory_table';