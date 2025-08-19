-- Supabase Storage 配置脚本
-- 在 Supabase Dashboard > Storage 中执行

-- 1. 创建 avatars bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 设置 avatars bucket 的访问策略

-- 允许所有人查看头像
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 允许认证用户上传头像
CREATE POLICY "Users can upload avatar images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('users', 'characters')
);

-- 允许用户更新自己的头像
CREATE POLICY "Users can update their own avatar images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (
    -- 用户头像：文件名包含用户ID
    ((storage.foldername(name))[1] = 'users' AND name LIKE '%' || auth.uid()::text || '%')
    OR
    -- 角色头像：检查角色所有权
    ((storage.foldername(name))[1] = 'characters' AND EXISTS (
      SELECT 1 FROM characters 
      WHERE user_id = auth.uid() 
      AND avatar_url LIKE '%' || name || '%'
    ))
  )
);

-- 允许用户删除自己的头像
CREATE POLICY "Users can delete their own avatar images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (
    -- 用户头像：文件名包含用户ID
    ((storage.foldername(name))[1] = 'users' AND name LIKE '%' || auth.uid()::text || '%')
    OR
    -- 角色头像：检查角色所有权
    ((storage.foldername(name))[1] = 'characters' AND EXISTS (
      SELECT 1 FROM characters 
      WHERE user_id = auth.uid() 
      AND avatar_url LIKE '%' || name || '%'
    ))
  )
);

-- 3. 设置文件大小和类型限制（可选，在应用层面也有验证）
-- 这些限制通过 RLS 策略实现

-- 完成！Storage bucket 和策略已配置
