-- Step 3.2 & 3.3 数据库升级脚本
-- 为角色评论功能添加必要的表结构

-- 1. 角色评论表
CREATE TABLE IF NOT EXISTS character_comments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  character_id BIGINT REFERENCES characters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_character_comments_character_id ON character_comments(character_id);
CREATE INDEX IF NOT EXISTS idx_character_comments_user_id ON character_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_character_comments_created_at ON character_comments(created_at DESC);

-- 3. 启用行级安全策略 (Row Level Security)
ALTER TABLE character_comments ENABLE ROW LEVEL SECURITY;

-- 4. 创建安全策略
-- 所有人都可以查看公开角色的评论
CREATE POLICY "用户可以查看公开角色的评论" ON character_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM characters 
      WHERE characters.id = character_comments.character_id 
      AND characters.is_public = true
    )
  );

-- 用户可以添加评论到公开角色
CREATE POLICY "用户可以评论公开角色" ON character_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM characters 
      WHERE characters.id = character_comments.character_id 
      AND characters.is_public = true
    )
  );

-- 用户只能更新自己的评论
CREATE POLICY "用户只能更新自己的评论" ON character_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的评论
CREATE POLICY "用户只能删除自己的评论" ON character_comments
  FOR DELETE USING (auth.uid() = user_id);

-- 5. 创建更新触发器
CREATE TRIGGER update_character_comments_updated_at 
  BEFORE UPDATE ON character_comments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. 确保 characters 表有 likes_count 字段（如果还没有的话）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' AND column_name = 'likes_count'
    ) THEN
        ALTER TABLE characters ADD COLUMN likes_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 7. 为 likes_count 创建索引（如果还没有的话）
CREATE INDEX IF NOT EXISTS idx_characters_likes_count ON characters(likes_count DESC);
