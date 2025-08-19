-- Phase 2.3.1 数据库升级测试脚本
-- 在 Supabase SQL Editor 中执行此脚本来验证升级是否成功

-- 1. 检查 chat_messages 表是否包含 type 字段
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
  AND column_name = 'type';

-- 2. 检查 chat_sessions 表是否包含截止点字段
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'chat_sessions' 
  AND column_name IN ('last_diary_cutoff_message_id', 'last_forum_cutoff_message_id');

-- 3. 检查约束是否正确设置
SELECT 
  constraint_name, 
  constraint_type, 
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%chat_messages%';

-- 4. 检查索引是否创建成功
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'chat_messages' 
  AND indexname LIKE '%type%';

SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'chat_sessions' 
  AND indexname LIKE '%cutoff%';

-- 5. 检查函数是否创建成功
SELECT 
  proname, 
  prosrc
FROM pg_proc 
WHERE proname IN ('get_incremental_messages', 'update_session_cutoff');

-- 6. 检查视图是否创建成功
SELECT 
  viewname, 
  definition
FROM pg_views 
WHERE viewname = 'session_generation_status';

-- 注意：视图不能直接应用 RLS 策略，但会继承底层表的安全策略

-- 7. 测试数据插入（如果有现有数据）
-- 注意：这个测试需要实际的会话ID，请根据你的数据调整

-- 测试插入不同类型的消息
-- INSERT INTO chat_messages (session_id, role, content, type) 
-- VALUES ('your-session-id-here', 'assistant', '这是一条测试消息', 'message');

-- 8. 测试辅助函数（需要实际的会话ID）
-- SELECT * FROM get_incremental_messages('your-session-id-here', 0);

-- 9. 查看会话生成状态视图
SELECT * FROM session_generation_status LIMIT 5;

-- 完成！如果所有查询都返回预期的结果，说明升级成功
