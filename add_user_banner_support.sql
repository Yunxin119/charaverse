-- 为用户资料表添加banner支持
-- 为profiles表添加banner_url字段

-- 添加banner_url列
ALTER TABLE profiles 
ADD COLUMN banner_url TEXT;

-- 添加索引以提高查询性能（如果需要）
CREATE INDEX idx_profiles_banner_url ON profiles (banner_url);

-- 添加注释
COMMENT ON COLUMN profiles.banner_url IS '用户个人页面横幅图片URL';

-- 示例查询：获取有banner的用户
-- SELECT id, username, avatar_url, banner_url FROM profiles WHERE banner_url IS NOT NULL;