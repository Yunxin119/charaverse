-- 表情包系统数据库结构
-- 执行顺序：先执行sticker_packs，再执行stickers

-- 1. 表情包合集表
CREATE TABLE IF NOT EXISTS public.sticker_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'general', -- 分类：general, cute, funny, angry, sad, love, etc.
  is_public BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- 是否为系统默认表情包
  sort_order INTEGER DEFAULT 0, -- 排序权重
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. 表情包表
CREATE TABLE IF NOT EXISTS public.stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  filename VARCHAR(200) NOT NULL, -- 原始文件名
  image_url TEXT NOT NULL, -- Supabase Storage URL
  thumbnail_url TEXT, -- 缩略图URL（可选）
  file_size INTEGER, -- 文件大小（字节）
  width INTEGER, -- 图片宽度
  height INTEGER, -- 图片高度
  tags TEXT[], -- 标签数组，如：['happy', 'smile', 'joy']
  emotions TEXT[], -- 情绪标签，如：['happy', 'excited']
  keywords TEXT[], -- 关键词，用于搜索，如：['开心', '笑', '高兴']
  usage_count INTEGER DEFAULT 0, -- 使用次数
  sort_order INTEGER DEFAULT 0, -- 在包内的排序
  is_active BOOLEAN DEFAULT true, -- 是否激活
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 用户表情包使用记录表（用于统计最近使用和常用表情包）
CREATE TABLE IF NOT EXISTS public.user_sticker_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  usage_count INTEGER DEFAULT 1, -- 该用户使用此表情包的次数
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sticker_id)
);

-- 4. 表情包收藏表
CREATE TABLE IF NOT EXISTS public.user_sticker_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sticker_id)
);

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_sticker_packs_category ON public.sticker_packs(category);
CREATE INDEX IF NOT EXISTS idx_sticker_packs_public ON public.sticker_packs(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_sticker_packs_default ON public.sticker_packs(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_stickers_pack_id ON public.stickers(pack_id);
CREATE INDEX IF NOT EXISTS idx_stickers_emotions ON public.stickers USING GIN(emotions);
CREATE INDEX IF NOT EXISTS idx_stickers_tags ON public.stickers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_stickers_keywords ON public.stickers USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_stickers_active ON public.stickers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sticker_usage_user_id ON public.user_sticker_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sticker_usage_last_used ON public.user_sticker_usage(user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sticker_usage_count ON public.user_sticker_usage(user_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_sticker_favorites_user_id ON public.user_sticker_favorites(user_id);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sticker_packs_updated_at 
  BEFORE UPDATE ON public.sticker_packs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stickers_updated_at 
  BEFORE UPDATE ON public.stickers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认表情包数据
INSERT INTO public.sticker_packs (name, description, category, is_public, is_default, sort_order) VALUES
  ('基础表情', '基础的表情符号集合', 'general', true, true, 100),
  ('可爱表情', '可爱风格的表情包', 'cute', true, true, 90),
  ('搞笑表情', '幽默搞笑的表情包', 'funny', true, true, 80),
  ('开心表情', '表达开心情绪的表情包', 'happy', true, true, 70),
  ('悲伤表情', '表达悲伤情绪的表情包', 'sad', true, true, 60),
  ('愤怒表情', '表达愤怒情绪的表情包', 'angry', true, true, 50),
  ('爱心表情', '表达爱意的表情包', 'love', true, true, 40),
  ('惊讶表情', '表达惊讶的表情包', 'surprised', true, true, 30);

-- 启用行级安全策略（RLS）
ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sticker_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sticker_favorites ENABLE ROW LEVEL SECURITY;

-- 表情包合集的RLS策略
-- 所有用户都可以查看公开的表情包合集
CREATE POLICY "Anyone can view public sticker packs" ON public.sticker_packs
  FOR SELECT USING (is_public = true);

-- 创建者可以管理自己创建的表情包合集
CREATE POLICY "Users can manage own sticker packs" ON public.sticker_packs
  FOR ALL USING (auth.uid() = created_by);

-- 表情包的RLS策略
-- 所有用户都可以查看属于公开合集的活跃表情包
CREATE POLICY "Anyone can view active stickers from public packs" ON public.stickers
  FOR SELECT USING (
    is_active = true AND 
    pack_id IN (SELECT id FROM public.sticker_packs WHERE is_public = true)
  );

-- 表情包合集的创建者可以管理其中的表情包
CREATE POLICY "Pack creators can manage stickers" ON public.stickers
  FOR ALL USING (
    pack_id IN (SELECT id FROM public.sticker_packs WHERE created_by = auth.uid())
  );

-- 用户表情包使用记录的RLS策略
CREATE POLICY "Users can manage own sticker usage" ON public.user_sticker_usage
  FOR ALL USING (auth.uid() = user_id);

-- 用户表情包收藏的RLS策略
CREATE POLICY "Users can manage own sticker favorites" ON public.user_sticker_favorites
  FOR ALL USING (auth.uid() = user_id);

-- 创建存储桶（如果不存在）
-- 注意：这个需要在Supabase控制台中手动创建，或使用Supabase管理API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('stickers', 'stickers', true);

-- 存储桶的RLS策略（在Supabase控制台中设置）
-- 1. 允许任何人查看stickers桶中的文件
-- 2. 只允许管理员上传文件到stickers桶