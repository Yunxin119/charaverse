-- Supabase Storage 配置脚本（简化版）
-- 请按以下步骤在 Supabase Dashboard 中操作：

-- 步骤 1: 在 Supabase Dashboard > Storage 中手动创建 bucket
-- 1. 访问 Supabase Dashboard > Storage
-- 2. 点击 "New bucket"
-- 3. Bucket name: avatars
-- 4. Public bucket: 勾选 ✅
-- 5. 点击 "Save"

-- 步骤 2: 在 SQL Editor 中执行以下策略（可选，因为设置为 public bucket 后默认可访问）

-- 允许所有人查看头像（public bucket 已经允许）
CREATE POLICY IF NOT EXISTS "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 允许认证用户上传头像
CREATE POLICY IF NOT EXISTS "Users can upload avatar images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 允许用户更新自己的头像
CREATE POLICY IF NOT EXISTS "Users can update their own avatar images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 允许用户删除自己的头像
CREATE POLICY IF NOT EXISTS "Users can delete their own avatar images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 注意：如果上述策略创建失败，可以尝试先删除现有策略：
-- DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can upload avatar images" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update their own avatar images" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete their own avatar images" ON storage.objects;

-- 完成！现在可以上传头像了
