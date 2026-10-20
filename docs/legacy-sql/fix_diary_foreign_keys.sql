-- 修复日记表外键约束问题
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 删除现有的外键约束
ALTER TABLE diaries 
DROP CONSTRAINT IF EXISTS diaries_source_message_id_start_fkey;

ALTER TABLE diaries 
DROP CONSTRAINT IF EXISTS diaries_source_message_id_end_fkey;

-- 2. 重新添加外键约束，设置为 ON DELETE SET NULL
-- 这样当消息被删除时，日记的 source_message_id 字段会被设置为 NULL，而不是阻止删除
ALTER TABLE diaries 
ADD CONSTRAINT diaries_source_message_id_start_fkey 
FOREIGN KEY (source_message_id_start) 
REFERENCES chat_messages(id) 
ON DELETE SET NULL;

ALTER TABLE diaries 
ADD CONSTRAINT diaries_source_message_id_end_fkey 
FOREIGN KEY (source_message_id_end) 
REFERENCES chat_messages(id) 
ON DELETE SET NULL;

-- 验证修复结果
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'diaries'
    AND kcu.column_name LIKE '%message_id%';