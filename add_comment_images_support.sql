-- 为评论表添加图片支持
-- 为character_comments表添加images字段，用于存储图片URL数组

-- 添加images列，使用JSONB类型存储字符串数组
ALTER TABLE character_comments 
ADD COLUMN images JSONB DEFAULT '[]'::JSONB;

-- 添加索引以提高查询性能（如果需要按图片进行查询）
CREATE INDEX idx_character_comments_images ON character_comments USING GIN (images);

-- 添加约束确保images是数组格式
ALTER TABLE character_comments 
ADD CONSTRAINT check_images_is_array 
CHECK (jsonb_typeof(images) = 'array');

-- 示例：插入带图片的评论
-- INSERT INTO character_comments (character_id, user_id, content, images) 
-- VALUES (1, 'user-uuid', '这是一个带图片的评论', '["https://example.com/image1.jpg", "https://example.com/image2.jpg"]'::JSONB);

-- 查询示例：
-- 查询有图片的评论
-- SELECT * FROM character_comments WHERE jsonb_array_length(images) > 0;

-- 查询包含特定图片的评论
-- SELECT * FROM character_comments WHERE images ? 'https://example.com/image1.jpg';

COMMENT ON COLUMN character_comments.images IS '评论图片URL数组，最多3张图片';