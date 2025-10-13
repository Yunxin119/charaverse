-- 剧本内多角色支持数据库扩展
-- 创建时间: 2025-01-01
-- 用途: 支持在单个剧本中定义多个角色，实现剧本内多角色对话

-- 1. 扩展 characters 表，添加剧本类型和角色列表字段
DO $$
BEGIN
  -- 添加 script_type 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'script_type'
  ) THEN
    ALTER TABLE characters
    ADD COLUMN script_type VARCHAR(10) DEFAULT 'single' CHECK (script_type IN ('single', 'multi'));

    COMMENT ON COLUMN characters.script_type IS '剧本类型: single=单角色剧本, multi=多角色剧本';
  END IF;

  -- 添加 script_characters 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'script_characters'
  ) THEN
    ALTER TABLE characters
    ADD COLUMN script_characters JSONB DEFAULT '[]'::jsonb;

    COMMENT ON COLUMN characters.script_characters IS '剧本中包含的角色列表';
  END IF;
END $$;

-- 2. 扩展 chat_messages 表，修改角色标识字段
DO $$
BEGIN
  -- 修改 speaker_character_id 的类型为 TEXT（支持剧本内角色ID）
  -- 这需要小心处理现有数据

  -- 首先检查是否已经是TEXT类型
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages'
    AND column_name = 'speaker_character_id'
    AND data_type = 'integer'
  ) THEN
    -- 如果是integer类型，需要转换为text
    -- 先创建新列
    ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS speaker_script_character_id TEXT;

    -- 将现有的integer ID转换为text（作为向后兼容）
    UPDATE chat_messages
    SET speaker_script_character_id = speaker_character_id::TEXT
    WHERE speaker_character_id IS NOT NULL;

    -- 删除旧列（如果需要的话，这一步可以稍后执行）
    -- ALTER TABLE chat_messages DROP COLUMN speaker_character_id;

    -- 重命名新列
    -- ALTER TABLE chat_messages RENAME COLUMN speaker_script_character_id TO speaker_character_id;
  END IF;

  -- 如果还没有 speaker_script_character_id 字段，直接添加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'speaker_script_character_id'
  ) THEN
    ALTER TABLE chat_messages
    ADD COLUMN speaker_script_character_id TEXT;

    COMMENT ON COLUMN chat_messages.speaker_script_character_id IS '剧本内角色ID';
  END IF;
END $$;

-- 3. 扩展 chat_sessions 表，调整多角色字段
DO $$
BEGIN
  -- 修改 current_speaker_id 类型为 TEXT（支持剧本内角色ID）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions'
    AND column_name = 'current_speaker_id'
    AND data_type = 'integer'
  ) THEN
    -- 添加新的字段
    ALTER TABLE chat_sessions
    ADD COLUMN IF NOT EXISTS current_script_character_id TEXT;

    -- 转换现有数据
    UPDATE chat_sessions
    SET current_script_character_id = current_speaker_id::TEXT
    WHERE current_speaker_id IS NOT NULL;

    COMMENT ON COLUMN chat_sessions.current_script_character_id IS '当前发言的剧本内角色ID';
  END IF;

  -- 如果还没有 current_script_character_id 字段，直接添加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'current_script_character_id'
  ) THEN
    ALTER TABLE chat_sessions
    ADD COLUMN current_script_character_id TEXT;

    COMMENT ON COLUMN chat_sessions.current_script_character_id IS '当前发言的剧本内角色ID';
  END IF;
END $$;

-- 4. 创建辅助函数：获取剧本内角色信息
CREATE OR REPLACE FUNCTION get_script_characters(p_character_id INTEGER)
RETURNS TABLE(
  character_id TEXT,
  character_name TEXT,
  description TEXT,
  personality JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (char_data->>'id')::TEXT as character_id,
    (char_data->>'name')::TEXT as character_name,
    (char_data->>'description')::TEXT as description,
    (char_data->'personality')::JSONB as personality
  FROM characters c,
       jsonb_array_elements(c.script_characters) as char_data
  WHERE c.id = p_character_id
    AND c.script_characters IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建辅助函数：检查是否为多角色剧本
CREATE OR REPLACE FUNCTION is_multi_character_script(p_character_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  script_type_val TEXT;
  character_count INTEGER;
BEGIN
  SELECT
    c.script_type,
    COALESCE(jsonb_array_length(c.script_characters), 0)
  INTO script_type_val, character_count
  FROM characters c
  WHERE c.id = p_character_id;

  RETURN (script_type_val = 'multi' AND character_count > 1);
END;
$$ LANGUAGE plpgsql;

-- 6. 创建辅助函数：获取剧本内角色的发言统计
CREATE OR REPLACE FUNCTION get_script_character_stats(
  p_session_id UUID,
  p_script_character_id TEXT
)
RETURNS TABLE(
  speak_count INTEGER,
  last_spoke_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as speak_count,
    MAX(created_at) as last_spoke_at
  FROM chat_messages
  WHERE session_id = p_session_id
    AND speaker_script_character_id = p_script_character_id
    AND role = 'assistant';
END;
$$ LANGUAGE plpgsql;

-- 7. 创建触发器：自动更新剧本内角色发言统计
CREATE OR REPLACE FUNCTION trigger_update_script_character_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- 当有新的角色消息时，更新会话的当前发言角色
  IF NEW.role = 'assistant' AND NEW.speaker_script_character_id IS NOT NULL THEN
    UPDATE chat_sessions
    SET current_script_character_id = NEW.speaker_script_character_id
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trigger_script_character_stats'
  ) THEN
    CREATE TRIGGER trigger_script_character_stats
      AFTER INSERT ON chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_script_character_stats();
  END IF;
END $$;

-- 8. 数据迁移：更新现有角色为单角色剧本
DO $$
BEGIN
  -- 为现有角色设置 script_type 为 'single'
  UPDATE characters
  SET script_type = 'single'
  WHERE script_type IS NULL;

  -- 为现有单角色创建默认的 script_characters 条目
  UPDATE characters
  SET script_characters = jsonb_build_array(
    jsonb_build_object(
      'id', '1',
      'name', name,
      'description', COALESCE(prompt_template->'basic_info'->>'description', ''),
      'personality', jsonb_build_object(
        'traits', COALESCE(prompt_template->'basic_info'->'keywords', '[]'::jsonb),
        'speaking_style', '',
        'background', COALESCE(prompt_template->'basic_info'->>'description', '')
      )
    )
  )
  WHERE script_characters IS NULL OR script_characters = '[]'::jsonb;

  RAISE NOTICE '✓ 已迁移现有角色为单角色剧本格式';
END $$;

-- 9. 验证和统计
DO $$
DECLARE
  total_characters INTEGER;
  single_scripts INTEGER;
  multi_scripts INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_characters FROM characters;
  SELECT COUNT(*) INTO single_scripts FROM characters WHERE script_type = 'single';
  SELECT COUNT(*) INTO multi_scripts FROM characters WHERE script_type = 'multi';

  RAISE NOTICE '';
  RAISE NOTICE '=== 剧本内多角色支持扩展完成 ===';
  RAISE NOTICE '剧本总数: %', total_characters;
  RAISE NOTICE '单角色剧本: %', single_scripts;
  RAISE NOTICE '多角色剧本: %', multi_scripts;
  RAISE NOTICE '==============================';
END $$;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭';
  RAISE NOTICE '🎭                                        🎭';
  RAISE NOTICE '🎭     剧本内多角色支持扩展成功完成！     🎭';
  RAISE NOTICE '🎭                                        🎭';
  RAISE NOTICE '🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭🎭';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 已扩展 characters 表支持剧本类型和角色列表';
  RAISE NOTICE '✅ 已扩展 chat_messages 表支持剧本内角色标识';
  RAISE NOTICE '✅ 已扩展 chat_sessions 表支持剧本内当前发言角色';
  RAISE NOTICE '✅ 已创建剧本内角色管理相关函数';
  RAISE NOTICE '✅ 已创建剧本内角色发言统计触发器';
  RAISE NOTICE '✅ 已成功迁移现有数据为单角色剧本格式';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 现在可以创建包含多个角色的剧本了！';
  RAISE NOTICE '';
  RAISE NOTICE '使用说明：';
  RAISE NOTICE '- 创建剧本时选择"多角色剧本"类型';
  RAISE NOTICE '- 在角色设定中定义剧本包含的所有角色';
  RAISE NOTICE '- 聊天时系统会根据剧本类型自动启用多角色模式';
  RAISE NOTICE '';
END $$;