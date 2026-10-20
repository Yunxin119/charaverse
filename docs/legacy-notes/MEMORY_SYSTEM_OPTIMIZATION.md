# 记忆系统优化说明

## 优化内容

### 1. 角色设定信息融合 ✅

**问题**: 之前的记忆系统在生成摘要时会根据对话推断角色身份，导致角色背景和前情提要丢失。

**解决方案**:
- 修改了 `/api/chat/summary/route.ts` 中的摘要生成prompt
- 强调必须基于角色设定信息理解对话
- 在prompt中明确指出"不要凭空推断角色身份，而是使用已提供的角色设定信息"
- 角色的人设、背景、世界观、关系网等都被纳入记忆理解的参考框架

**位置**: `src/app/api/chat/summary/route.ts:233-239`

### 2. 记忆表格传输优化 ✅

**优化点**:

#### 2.1 添加启用/禁用功能
- 新增 `is_enabled` 字段控制记忆是否在生成时被使用
- 记忆可以被禁用而不是删除，保留历史数据
- 只有启用的记忆才会被注入到prompt中

**数据库迁移**: `database/add_memory_enabled_field.sql`

#### 2.2 优化记忆呈现格式
参考SillyTavern的实现，改进记忆在prompt中的呈现：

- **分类优先级**: relationship > character > task > event > spacetime > emotion > setting > item
- **结构化展示**: 每种类型的记忆都有清晰的图标和标签
- **紧凑格式**: 使用内联metadata展示，减少token消耗
- **状态标识**: 任务类型记忆显示状态emoji (✅已完成 / 🔄进行中 / ⏳待处理)

**位置**: `src/app/lib/enhancedChatSlice.ts:60-230`

**示例输出**:
```
【重要记忆表格】
记忆按重要度排序，仅展示启用且重要度≥5的记忆。

🤝 关系状态:
• 与用户的关系发展 (重要度9)
  关系逐渐从陌生走向亲密，建立了深厚的信任
  [角色:用户 | 关系:朋友 | 态度:亲密 | 好感:9/10 | 信任:8/10]

📋 任务约定:
• ✅ 周末一起看电影 (重要度8)
  约定在周末一起去看新上映的电影
  [类型:appointment | 时间:周六晚上7点 | 状态:completed | 优先级:high]
```

### 3. 记忆编辑和状态管理 ✅

#### 3.1 新增API端点
创建了 `/api/chat/memory` 端点用于更新和删除记忆:
- `PATCH`: 更新记忆内容、重要度、metadata、启用状态
- `DELETE`: 删除记忆

**位置**: `src/app/api/chat/memory/route.ts`

#### 3.2 前端功能增强

**记忆卡片操作**:
- 编辑按钮 (蓝色铅笔图标): 修改记忆标题、内容、重要度
- 启用/禁用按钮 (眼睛图标):
  - 绿色眼睛 = 已启用
  - 灰色斜线眼睛 = 已禁用
- 删除按钮 (红色垃圾桶图标): 永久删除记忆

**任务状态管理**:
- task类型记忆可以直接在卡片上切换状态
- 三个状态按钮: ⏳待处理 / 🔄进行中 / ✅已完成
- 当前状态高亮显示

**位置**: `src/app/chat/[sessionId]/memory/page.tsx:507-621` (处理函数)
**位置**: `src/app/chat/[sessionId]/memory/page.tsx:1595-1623` (UI按钮)
**位置**: `src/app/chat/[sessionId]/memory/page.tsx:1696-1744` (任务状态切换)

### 4. 记忆注入到Prompt的优化 ✅

**改进**:
1. **智能筛选**: 只获取 `is_enabled=true` 且 `importance>=5` 的记忆
2. **数量增加**: 从20条增加到30条记忆
3. **优先级排序**: 按重要度降序排列
4. **分类展示**: 按类型分组，使用统一的图标和标签
5. **紧凑格式**: 减少换行和空白，节省token

**位置**: `src/app/lib/enhancedChatSlice.ts:61-230`

## 使用说明

### 数据库迁移

首先需要运行数据库迁移脚本添加 `is_enabled` 字段:

```bash
# 在Supabase SQL编辑器中执行
cat database/add_memory_enabled_field.sql
```

或者手动执行以下SQL:
```sql
ALTER TABLE chat_memories
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_chat_memories_enabled
ON chat_memories(session_id, user_id, is_enabled)
WHERE is_enabled = true;

UPDATE chat_memories
SET is_enabled = true
WHERE is_enabled IS NULL;
```

### 使用新功能

1. **编辑记忆**:
   - 进入记忆管理页面
   - 悬停在记忆卡片上
   - 点击蓝色编辑按钮
   - 修改内容后点击"保存"

2. **禁用/启用记忆**:
   - 悬停在记忆卡片上
   - 点击眼睛图标切换状态
   - 禁用的记忆不会被注入到prompt中，但仍然保留在数据库中

3. **管理任务状态**:
   - 对于task类型的记忆，卡片底部会显示三个状态按钮
   - 直接点击按钮切换任务状态
   - 已完成的任务会显示✅标记

## 与SillyTavern的对比

参考了SillyTavern的以下设计:
1. ✅ 记忆的启用/禁用功能
2. ✅ 任务状态标记和管理
3. ✅ 优先级排序和分类展示
4. ✅ 紧凑的metadata展示格式

改进点:
- 更丰富的记忆类型 (8种 vs SillyTavern的4种)
- 更灵活的metadata结构
- 与角色设定的深度集成

## 效果预期

1. **角色一致性提升**: 记忆生成时会严格遵循角色设定，不会出现角色身份错乱
2. **Token效率提高**: 紧凑的格式减少约30%的记忆token消耗
3. **管理灵活性**: 可以编辑和禁用记忆，而不必删除
4. **状态跟踪**: 任务和约定可以标记完成状态，避免AI重复提及

## 注意事项

1. 运行数据库迁移脚本后，所有现有记忆默认为启用状态
2. 编辑记忆时无法修改类型（type字段）
3. 记忆的 `is_enabled` 状态存储在数据库的独立字段中，而非metadata
4. 任务状态 (`status`) 存储在metadata中，有四种值: pending/in_progress/completed/cancelled
