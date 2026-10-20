-- 创建 Supabase Storage 存储桶
-- 这个脚本需要在 Supabase Dashboard 的 SQL Editor 中执行

-- 1. 创建 avatars 存储桶（如果不存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. 创建 character-assets 存储桶（用于角色相关资源和用户banner）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-assets',
  'character-assets',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. 设置 avatars 存储桶的访问策略
-- 允许认证用户上传自己的头像
CREATE POLICY "用户可以上传自己的头像" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 允许所有人查看头像
CREATE POLICY "所有人可以查看头像" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 允许用户删除自己的头像
CREATE POLICY "用户可以删除自己的头像" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 允许用户更新自己的头像
CREATE POLICY "用户可以更新自己的头像" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. 设置 character-assets 存储桶的访问策略
-- 允许认证用户上传角色资源和banner
CREATE POLICY "用户可以上传角色资源" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'character-assets' 
  AND auth.uid() IS NOT NULL
);

-- 允许所有人查看角色资源
CREATE POLICY "所有人可以查看角色资源" ON storage.objects
FOR SELECT USING (bucket_id = 'character-assets');

-- 允许用户删除自己的角色资源
CREATE POLICY "用户可以删除自己的角色资源" ON storage.objects
FOR DELETE USING (
  bucket_id = 'character-assets' 
  AND auth.uid() IS NOT NULL
);

-- 允许用户更新自己的角色资源
CREATE POLICY "用户可以更新自己的角色资源" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'character-assets' 
  AND auth.uid() IS NOT NULL
);

-- 5. 启用 RLS（Row Level Security）
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 验证存储桶是否创建成功
SELECT * FROM storage.buckets WHERE id IN ('avatars', 'character-assets');
