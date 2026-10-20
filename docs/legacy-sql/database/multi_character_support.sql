-- Phase 1: 基础多角色支持数据库扩展
-- 创建时间: 2025-01-01
-- 用途: 支持单会话中的多角色对话

-- 1. 扩展会话表，支持多角色
ALTER TABLE chat_sessions
  ADD COLUMN session_type VARCHAR(20) DEFAULT 'single' CHECK (session_type IN ('single', 'multi')),
  ADD COLUMN active_characters JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN current_speaker_id INTEGER DEFAULT NULL,
  ADD COLUMN rotation_mode VARCHAR(20) DEFAULT 'manual' CHECK (rotation_mode IN ('manual', 'auto'));

-- 为新字段添加注释
COMMENT ON COLUMN chat_sessions.session_type IS '会话类型: single=单角色, multi=多角色';
COMMENT ON COLUMN chat_sessions.active_characters IS '活跃角色ID数组, 格式: [1, 2, 3]';
COMMENT ON COLUMN chat_sessions.current_speaker_id IS '当前发言角色ID';
COMMENT ON COLUMN chat_sessions.rotation_mode IS '角色轮换模式: manual=手动, auto=自动';

-- 2. 扩展消息表，支持角色标识
ALTER TABLE chat_messages
  ADD COLUMN speaker_character_id INTEGER DEFAULT NULL,
  ADD COLUMN speaker_type VARCHAR(20) DEFAULT 'character' CHECK (speaker_type IN ('user', 'character', 'system'));

-- 添加外键约束
ALTER TABLE chat_messages
  ADD CONSTRAINT fk_speaker_character
  FOREIGN KEY (speaker_character_id)
  REFERENCES characters(id)
  ON DELETE SET NULL;

-- 为新字段添加注释
COMMENT ON COLUMN chat_messages.speaker_character_id IS '发言角色ID，用户消息时为NULL';
COMMENT ON COLUMN chat_messages.speaker_type IS '发言者类型: user=用户, character=角色, system=系统';

-- 3. 创建会话角色关联表（用于管理多角色会话中的角色状态）
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

  -- 确保同一会话中同一角色只有一条记录
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

-- 4. 创建更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_characters_updated_at
  BEFORE UPDATE ON session_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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
    PERFORM update_character_speak_stats(NEW.session_id, NEW.speaker_character_id);

    -- 同时更新会话的当前发言角色
    UPDATE chat_sessions
    SET current_speaker_id = NEW.speaker_character_id
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chat_message_character_stats
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_character_stats();

-- 8. 数据迁移：将现有单角色会话标记为single类型
UPDATE chat_sessions
SET
  session_type = 'single',
  active_characters = jsonb_build_array(character_id),
  current_speaker_id = character_id
WHERE session_type IS NULL;

-- 为现有会话创建session_characters记录
INSERT INTO session_characters (session_id, character_id, is_active, join_order, speak_count)
SELECT
  cs.id as session_id,
  cs.character_id,
  true as is_active,
  1 as join_order,
  COALESCE(msg_count.count, 0) as speak_count
FROM chat_sessions cs
LEFT JOIN (
  SELECT session_id, COUNT(*) as count
  FROM chat_messages
  WHERE role = 'assistant'
  GROUP BY session_id
) msg_count ON msg_count.session_id = cs.id
ON CONFLICT (session_id, character_id) DO NOTHING;

-- 9. 更新现有消息的角色信息
UPDATE chat_messages
SET
  speaker_character_id = cs.character_id,
  speaker_type = CASE
    WHEN role = 'user' THEN 'user'
    WHEN role = 'assistant' THEN 'character'
    ELSE 'system'
  END
FROM chat_sessions cs
WHERE chat_messages.session_id = cs.id
  AND chat_messages.speaker_character_id IS NULL;