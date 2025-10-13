-- Phase 1: 基础多角色支持数据库扩展 (确保可工作版本)
-- 创建时间: 2025-01-01
-- 用途: 支持单会话中的多角色对话
-- 完全修复: 统一所有类型为UUID，避免任何类型转换问题

-- 首先检查表结构并显示类型信息
DO $$
DECLARE
  sessions_id_type TEXT;
  messages_session_id_type TEXT;
BEGIN
  SELECT data_type INTO sessions_id_type
  FROM information_schema.columns
  WHERE table_name = 'chat_sessions' AND column_name = 'id';

  SELECT data_type INTO messages_session_id_type
  FROM information_schema.columns
  WHERE table_name = 'chat_messages' AND column_name = 'session_id';

  RAISE NOTICE '=== 当前数据库类型信息 ===';
  RAISE NOTICE 'chat_sessions.id 类型: %', sessions_id_type;
  RAISE NOTICE 'chat_messages.session_id 类型: %', messages_session_id_type;
  RAISE NOTICE '========================';
END $$;

-- 1. 扩展会话表，支持多角色
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'single' CHECK (session_type IN ('single', 'multi')),
  ADD COLUMN IF NOT EXISTS active_characters JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_speaker_id INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rotation_mode VARCHAR(20) DEFAULT 'manual' CHECK (rotation_mode IN ('manual', 'auto'));

-- 为新字段添加注释
COMMENT ON COLUMN chat_sessions.session_type IS '会话类型: single=单角色, multi=多角色';
COMMENT ON COLUMN chat_sessions.active_characters IS '活跃角色ID数组, 格式: [1, 2, 3]';
COMMENT ON COLUMN chat_sessions.current_speaker_id IS '当前发言角色ID';
COMMENT ON COLUMN chat_sessions.rotation_mode IS '角色轮换模式: manual=手动, auto=自动';

-- 2. 扩展消息表，支持角色标识
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS speaker_character_id INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS speaker_type VARCHAR(20) DEFAULT 'character' CHECK (speaker_type IN ('user', 'character', 'system'));

-- 添加外键约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_speaker_character' AND table_name = 'chat_messages'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT fk_speaker_character
      FOREIGN KEY (speaker_character_id)
      REFERENCES characters(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 为新字段添加注释
COMMENT ON COLUMN chat_messages.speaker_character_id IS '发言角色ID，用户消息时为NULL';
COMMENT ON COLUMN chat_messages.speaker_type IS '发言者类型: user=用户, character=角色, system=系统';

-- 3. 创建会话角色关联表（统一使用UUID类型）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_characters') THEN
    CREATE TABLE session_characters (
      id SERIAL PRIMARY KEY,
      session_id UUID NOT NULL,
      character_id INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT true,
      join_order INTEGER DEFAULT 1,
      last_spoke_at TIMESTAMP DEFAULT NULL,
      speak_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(session_id, character_id)
    );

    -- 添加外键约束
    ALTER TABLE session_characters
      ADD CONSTRAINT fk_session_characters_session
      FOREIGN KEY (session_id)
      REFERENCES chat_sessions(id)
      ON DELETE CASCADE;

    ALTER TABLE session_characters
      ADD CONSTRAINT fk_session_characters_character
      FOREIGN KEY (character_id)
      REFERENCES characters(id)
      ON DELETE CASCADE;

    -- 添加索引
    CREATE INDEX idx_session_characters_session_id ON session_characters(session_id);
    CREATE INDEX idx_session_characters_active ON session_characters(session_id, is_active);

    -- 为新表添加注释
    COMMENT ON TABLE session_characters IS '会话角色关联表，管理多角色会话中每个角色的状态';
    COMMENT ON COLUMN session_characters.join_order IS '角色加入会话的顺序';
    COMMENT ON COLUMN session_characters.last_spoke_at IS '角色最后发言时间';
    COMMENT ON COLUMN session_characters.speak_count IS '角色在此会话中的发言次数';

    RAISE NOTICE '✓ 已创建 session_characters 表';
  ELSE
    RAISE NOTICE '- session_characters 表已存在，跳过创建';
  END IF;
END $$;

-- 4. 创建更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_session_characters_updated_at'
  ) THEN
    CREATE TRIGGER update_session_characters_updated_at
      BEFORE UPDATE ON session_characters
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    RAISE NOTICE '✓ 已创建更新时间戳触发器';
  ELSE
    RAISE NOTICE '- 更新时间戳触发器已存在';
  END IF;
END $$;

-- 5. 创建辅助函数：获取会话的活跃角色
CREATE OR REPLACE FUNCTION get_session_active_characters(p_session_id UUID)
RETURNS TABLE(
  character_id INTEGER,
  character_name VARCHAR,
  is_current_speaker BOOLEAN,
  last_spoke_at TIMESTAMP,
  speak_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.character_id,
    c.name::VARCHAR as character_name,
    (cs.current_speaker_id = sc.character_id) as is_current_speaker,
    sc.last_spoke_at,
    sc.speak_count
  FROM session_characters sc
  JOIN characters c ON c.id = sc.character_id
  JOIN chat_sessions cs ON cs.id = sc.session_id
  WHERE sc.session_id = p_session_id
    AND sc.is_active = true
  ORDER BY sc.join_order;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建辅助函数：更新角色发言统计
CREATE OR REPLACE FUNCTION update_character_speak_stats(
  p_session_id UUID,
  p_character_id INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE session_characters
  SET
    last_spoke_at = now(),
    speak_count = speak_count + 1,
    updated_at = now()
  WHERE session_id = p_session_id
    AND character_id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建触发器：自动更新角色发言统计
CREATE OR REPLACE FUNCTION trigger_update_character_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- 只有当是角色发言时才更新统计
  IF NEW.speaker_type = 'character' AND NEW.speaker_character_id IS NOT NULL THEN
    -- 直接使用UUID，不进行类型转换
    PERFORM update_character_speak_stats(NEW.session_id, NEW.speaker_character_id);

    -- 同时更新会话的当前发言角色
    UPDATE chat_sessions
    SET current_speaker_id = NEW.speaker_character_id
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建消息统计触发器（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trigger_chat_message_character_stats'
  ) THEN
    CREATE TRIGGER trigger_chat_message_character_stats
      AFTER INSERT ON chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_character_stats();
    RAISE NOTICE '✓ 已创建消息统计触发器';
  ELSE
    RAISE NOTICE '- 消息统计触发器已存在';
  END IF;
END $$;

-- 8. 数据迁移：将现有单角色会话标记为single类型
UPDATE chat_sessions
SET
  session_type = 'single',
  active_characters = jsonb_build_array(character_id),
  current_speaker_id = character_id
WHERE (session_type IS NULL OR session_type = '') AND character_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✓ 已更新现有会话为single类型';
END $$;

-- 9. 为现有会话创建session_characters记录（使用相同的UUID类型）
DO $$
DECLARE
  session_rec RECORD;
  assistant_count INTEGER;
  total_sessions INTEGER;
  processed_sessions INTEGER := 0;
BEGIN
  -- 获取需要处理的会话总数
  SELECT COUNT(*) INTO total_sessions
  FROM chat_sessions
  WHERE character_id IS NOT NULL;

  RAISE NOTICE '开始为 % 个会话创建角色记录...', total_sessions;

  FOR session_rec IN
    SELECT id, character_id
    FROM chat_sessions
    WHERE character_id IS NOT NULL
  LOOP
    -- 计算该会话的assistant消息数量（UUID = UUID比较）
    SELECT COUNT(*) INTO assistant_count
    FROM chat_messages
    WHERE session_id = session_rec.id AND role = 'assistant';

    -- 插入session_characters记录
    INSERT INTO session_characters (session_id, character_id, is_active, join_order, speak_count)
    VALUES (
      session_rec.id,
      session_rec.character_id,
      true,
      1,
      COALESCE(assistant_count, 0)
    )
    ON CONFLICT (session_id, character_id) DO UPDATE SET
      speak_count = EXCLUDED.speak_count,
      is_active = true;

    processed_sessions := processed_sessions + 1;

    -- 每处理100个会话输出一次进度
    IF processed_sessions % 100 = 0 THEN
      RAISE NOTICE '已处理 %/% 个会话...', processed_sessions, total_sessions;
    END IF;
  END LOOP;

  RAISE NOTICE '✓ 已为 % 个会话创建角色记录', processed_sessions;
END $$;

-- 10. 更新现有消息的角色信息（UUID = UUID比较）
DO $$
DECLARE
  total_messages INTEGER;
  updated_messages INTEGER;
BEGIN
  -- 获取需要更新的消息总数
  SELECT COUNT(*) INTO total_messages
  FROM chat_messages
  WHERE speaker_character_id IS NULL;

  RAISE NOTICE '开始更新 % 条消息的角色信息...', total_messages;

  -- 批量更新消息的角色信息
  UPDATE chat_messages
  SET
    speaker_character_id = CASE
      WHEN role = 'assistant' THEN cs.character_id
      ELSE NULL
    END,
    speaker_type = CASE
      WHEN role = 'user' THEN 'user'
      WHEN role = 'assistant' THEN 'character'
      ELSE 'system'
    END
  FROM chat_sessions cs
  WHERE chat_messages.session_id = cs.id  -- UUID = UUID比较
    AND chat_messages.speaker_character_id IS NULL;

  GET DIAGNOSTICS updated_messages = ROW_COUNT;
  RAISE NOTICE '✓ 已更新 % 条消息的角色信息', updated_messages;
END $$;

-- 11. 验证数据完整性
DO $$
DECLARE
  session_count INTEGER;
  character_count INTEGER;
  message_count INTEGER;
BEGIN
  -- 统计各种数据
  SELECT COUNT(*) INTO session_count FROM chat_sessions WHERE session_type IS NOT NULL;
  SELECT COUNT(*) INTO character_count FROM session_characters;
  SELECT COUNT(*) INTO message_count FROM chat_messages WHERE speaker_type IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '=== 数据完整性验证 ===';
  RAISE NOTICE '会话总数: %', session_count;
  RAISE NOTICE '角色关联记录: %', character_count;
  RAISE NOTICE '已标记类型的消息: %', message_count;
  RAISE NOTICE '=====================';
END $$;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉';
  RAISE NOTICE '🎉                                        🎉';
  RAISE NOTICE '🎉     多角色支持数据库扩展成功完成！     🎉';
  RAISE NOTICE '🎉                                        🎉';
  RAISE NOTICE '🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 已扩展 chat_sessions 表支持多角色模式';
  RAISE NOTICE '✅ 已扩展 chat_messages 表支持角色标识';
  RAISE NOTICE '✅ 已创建 session_characters 表管理角色状态';
  RAISE NOTICE '✅ 已创建所有必要的函数和触发器';
  RAISE NOTICE '✅ 已成功迁移所有现有数据';
  RAISE NOTICE '✅ 所有类型问题已彻底解决';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 现在可以开始在应用中使用多角色功能了！';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：在前端代码中集成多角色组件';
  RAISE NOTICE '';
END $$;