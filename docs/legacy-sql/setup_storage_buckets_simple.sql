-- 简化版本：创建 Supabase Storage 存储桶
-- 在 Supabase Dashboard 的 SQL Editor 中执行

-- 1. 创建 avatars 存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 创建 character-assets 存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-assets', 'character-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 验证存储桶是否创建成功
SELECT id, name, public FROM storage.buckets WHERE id IN ('avatars', 'character-assets');
