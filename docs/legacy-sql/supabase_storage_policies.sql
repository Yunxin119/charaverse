-- Supabase Storage 策略配置（兼容版本）
-- 在创建 avatars bucket 后，在 SQL Editor 中执行此脚本

-- 注意：如果策略已存在会报错，这是正常的，可以忽略重复创建的错误

-- 1. 允许所有人查看头像（因为bucket是public，这个策略可能不是必需的）
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 2. 允许认证用户上传头像
CREATE POLICY "Users can upload avatar images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 3. 允许用户更新自己的头像
CREATE POLICY "Users can update their own avatar images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 4. 允许用户删除自己的头像
CREATE POLICY "Users can delete their own avatar images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 如果上面的策略创建时报"already exists"错误，可以先删除再重新创建：
-- DROP POLICY "Avatar images are publicly accessible" ON storage.objects;
-- DROP POLICY "Users can upload avatar images" ON storage.objects;
-- DROP POLICY "Users can update their own avatar images" ON storage.objects;
-- DROP POLICY "Users can delete their own avatar images" ON storage.objects;
