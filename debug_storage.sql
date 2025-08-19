-- 调试Storage权限问题
-- 在 SQL Editor 中逐步执行以下查询来诊断问题

-- 1. 检查当前用户状态
SELECT auth.uid(), auth.role();

-- 2. 检查avatars bucket是否存在
SELECT * FROM storage.buckets WHERE id = 'avatars';

-- 3. 检查现有的storage.objects策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- 4. 如果需要，完全重置storage.objects的策略
-- （注意：这会删除所有storage.objects的策略，请谨慎使用）
-- DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can upload avatar images" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update their own avatar images" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete their own avatar images" ON storage.objects;
-- DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
-- DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

-- 5. 创建最简单的策略（如果上面删除了策略的话）
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'avatars' AND 
--     auth.role() = 'authenticated'
--   );

-- CREATE POLICY "Allow public access" ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');

-- 6. 确保bucket是public的
-- UPDATE storage.buckets SET public = true WHERE id = 'avatars';
