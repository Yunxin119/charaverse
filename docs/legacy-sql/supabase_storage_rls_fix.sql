-- 修复Supabase Storage RLS策略
-- 在 SQL Editor 中执行此脚本

-- 首先，删除可能存在的冲突策略
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar images" ON storage.objects;

-- 1. 允许所有人查看 avatars bucket 中的文件
CREATE POLICY "Public Avatar Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 2. 允许认证用户上传到 avatars bucket
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
  );

-- 3. 允许认证用户更新自己上传的文件
CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
  );

-- 4. 允许认证用户删除自己上传的文件
CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
  );

-- 5. 确保bucket策略也正确设置
UPDATE storage.buckets 
SET public = true 
WHERE id = 'avatars';

-- 完成！现在应该可以上传头像了
