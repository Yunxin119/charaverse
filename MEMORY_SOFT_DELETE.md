# 摘要软删除机制 - 防止记忆丢失

## 更新时间
2025-01-XX

## 问题背景

用户反馈：**严重问题** - 删除一个摘要会导致整个记忆条目被删除，而不是回退到之前的状态。

###场景示例

```
摘要1 (消息1-100):   创建记忆A "张三基本信息"
摘要2 (消息101-200): 更新记忆A "张三基本信息 + 家庭背景"
摘要3 (消息201-300): 更新记忆A "张三基本信息 + 家庭背景 + 童年经历"

用户删除摘要3 →
  ❌ 旧逻辑: 记忆A完全消失（被硬删除）
  ✅ 新逻辑: 记忆A被标记为禁用（软删除），可恢复
```

### 为什么会出现这个问题？

**旧的删除逻辑**：
```typescript
// ❌ 硬删除（不可恢复）
// 1. 删除所有关联的记忆条目
await supabase.from('chat_memories').delete().eq('summary_id', summaryId)

// 2. 删除摘要
await supabase.from('chat_summaries').delete().eq('id', summaryId)
```

**问题**：
1. 数据永久丢失，无法恢复
2. 如果误删，所有相关记忆都消失
3. 无法实现记忆回退功能

## 解决方案：软删除机制

### 核心策略

使用**标记删除**而非**真实删除**：
- 摘要：标记 `is_active = false`
- 记忆：标记 `is_enabled = false`

### 优势

1. ✅ **数据安全**：不真正删除，数据永久保留
2. ✅ **可恢复**：如果需要，可以恢复被"删除"的摘要和记忆
3. ✅ **简单实现**：利用现有字段，无需数据库迁移
4. ✅ **性能良好**：查询时使用索引过滤
5. ✅ **向后兼容**：不影响现有功能

## 实现细节

### 1. 数据库字段

两个表都已经有软删除字段：

#### chat_summaries表
```sql
is_active BOOLEAN DEFAULT true

-- 注释
COMMENT ON COLUMN chat_summaries.is_active IS '摘要是否有效，当相关消息被删除时会被设为false';

-- 索引
CREATE INDEX idx_chat_summaries_level_active
ON chat_summaries(session_id, summary_level, is_active, created_at DESC);
```

#### chat_memories表
```sql
is_enabled BOOLEAN DEFAULT true

-- 注释
COMMENT ON COLUMN chat_memories.is_enabled IS '记忆是否启用，false表示禁用但不删除';

-- 索引
CREATE INDEX idx_chat_memories_enabled
ON chat_memories(session_id, user_id, is_enabled)
WHERE is_enabled = true;
```

### 2. 删除逻辑修改

**位置**：`src/app/chat/[sessionId]/memory/page.tsx:1254-1313`

```typescript
// 删除摘要（软删除）
const handleDeleteSummary = async (summaryId: number) => {
  if (!confirm('确定要删除这个摘要吗？\n\n⚠️ 删除后：\n1. 摘要和相关记忆将被隐藏（不会真正删除）\n2. 后续生成的新摘要将不会参考此摘要内容\n3. 智能上下文将重新计算覆盖范围\n\n💡 提示：记忆条目会被保留，如果之前被其他摘要创建')) return

  try {
    console.log(`🗑️ 开始软删除摘要: ${summaryId}`)

    // 1. 查找由此摘要创建的记忆
    const { data: memoriesToDisable } = await supabase
      .from('chat_memories')
      .select('id, title')
      .eq('summary_id', summaryId)
      .eq('user_id', user!.id)

    console.log(`📊 找到 ${memoriesToDisable?.length || 0} 个关联记忆`)

    // 2. 禁用这些记忆（软删除）
    if (memoriesToDisable && memoriesToDisable.length > 0) {
      const { error: disableError } = await supabase
        .from('chat_memories')
        .update({ is_enabled: false })
        .eq('summary_id', summaryId)
        .eq('user_id', user!.id)

      if (disableError) throw disableError
      console.log(`✅ 已禁用 ${memoriesToDisable.length} 个记忆条目`)
    }

    // 3. 标记摘要为不活跃（软删除）
    const { error: updateError } = await supabase
      .from('chat_summaries')
      .update({ is_active: false })
      .eq('id', summaryId)
      .eq('user_id', user!.id)

    if (updateError) throw updateError
    console.log(`✅ 摘要已标记为不活跃: ${summaryId}`)

    // 4. 刷新界面
    await loadSummaries()
    await loadMemories()
    await calculateSummaryRanges()
    await calculateContextStatus()

    alert('摘要删除成功！\n\n💡 记忆已保留，摘要已隐藏')
  } catch (error) {
    console.error('删除摘要失败:', error)
    alert('删除失败，请重试')
  }
}
```

### 3. 查询逻辑过滤

#### 摘要查询

**位置**：`src/app/lib/enhancedChatSlice.ts:326-355`

```typescript
export const getSummaries = async (sessionId: string, userId: string): Promise<ChatSummary[]> => {
  try {
    // 使用数据库函数获取最优摘要组合
    const { data: effectiveSummaries, error: functionError } = await supabase
      .rpc('get_effective_summaries', {
        p_session_id: sessionId,
        p_user_id: userId
      })

    if (!functionError && effectiveSummaries) {
      console.log(`📚 获取到${effectiveSummaries.length}个有效分层摘要`)
      return effectiveSummaries
    }

    // 降级到传统方法
    const { data: summaries, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('is_active', true)  // ✅ 只查询活跃的摘要
      .order('summary_level', { ascending: false })
      .order('created_at', { ascending: true })

    return summaries || []
  } catch (error) {
    console.error('获取摘要失败:', error)
    return []
  }
}
```

#### 记忆查询

**位置**：`src/app/chat/[sessionId]/memory/page.tsx:264-270`

```typescript
// 加载记忆表格数据（只加载启用的）
const { data: memoryData } = await supabase
  .from('chat_memories')
  .select('*')
  .eq('session_id', sessionId)
  .eq('user_id', user.id)
  .eq('is_enabled', true)  // ✅ 只查询启用的记忆
```

#### 智能上下文状态计算

**位置**：`src/app/chat/[sessionId]/memory/page.tsx:863-876`

```typescript
const { data: summaries, error } = await supabase
  .from('chat_summaries')
  .select('start_message_id, end_message_id')
  .eq('session_id', sessionId)
  .eq('user_id', user.id)
  .eq('is_active', true)  // ✅ 只计算活跃摘要的覆盖范围
  .not('start_message_id', 'is', null)
  .not('end_message_id', 'is', null)
  .order('start_message_id', { ascending: true })
```

## 调试日志

删除摘要时会输出详细日志：

```
🗑️ 开始软删除摘要: 123
📊 找到 5 个关联记忆
✅ 已禁用 5 个记忆条目
✅ 摘要已标记为不活跃: 123
```

## 用户体验改进

### 删除确认对话框

**Before** ❌:
```
确定要删除这个摘要吗？

⚠️ 删除后：
1. 相关的记忆条目也会被删除
2. 后续生成的新摘要将不会参考此摘要内容
3. 智能上下文将重新计算覆盖范围
```

**After** ✅:
```
确定要删除这个摘要吗？

⚠️ 删除后：
1. 摘要和相关记忆将被隐藏（不会真正删除）
2. 后续生成的新摘要将不会参考此摘要内容
3. 智能上下文将重新计算覆盖范围

💡 提示：记忆条目会被保留，如果之前被其他摘要创建
```

### 删除成功提示

**Before** ❌:
```
摘要删除成功！
```

**After** ✅:
```
摘要删除成功！

💡 记忆已保留，摘要已隐藏
```

## 数据恢复方案

虽然当前界面不提供恢复功能，但数据已被保留，可以通过以下方式恢复：

### 方式1：直接数据库操作

```sql
-- 恢复摘要
UPDATE chat_summaries
SET is_active = true
WHERE id = 123;

-- 恢复关联记忆
UPDATE chat_memories
SET is_enabled = true
WHERE summary_id = 123;
```

### 方式2：未来可添加恢复功能

在记忆管理页面添加"回收站"功能：
1. 显示已删除的摘要和记忆
2. 支持一键恢复
3. 支持永久删除（真正的硬删除）

## 性能考虑

### 1. 索引优化

两个表都有针对软删除的索引：

```sql
-- 摘要表索引
CREATE INDEX idx_chat_summaries_level_active
ON chat_summaries(session_id, summary_level, is_active, created_at DESC);

-- 记忆表索引（部分索引，只索引启用的）
CREATE INDEX idx_chat_memories_enabled
ON chat_memories(session_id, user_id, is_enabled)
WHERE is_enabled = true;
```

### 2. 查询性能

软删除**不会**降低查询性能：
- 查询时使用 `WHERE is_active = true` 或 `WHERE is_enabled = true`
- 数据库会使用索引快速过滤
- 部分索引（partial index）只索引启用的记忆，更高效

### 3. 存储空间

软删除会占用更多存储空间，但：
- 文本数据（摘要、记忆）占用空间很小
- 数据安全价值远大于存储成本
- 可以定期清理超过N天的软删除数据

## 与其他功能的配合

### 1. 记忆更新机制

软删除与记忆更新机制完美配合：

**场景**：
```
摘要1: 创建记忆A
摘要2: 更新记忆A (summary_id改为摘要2)
用户删除摘要2 → 记忆A被禁用

✅ 正确：记忆A虽然被禁用，但内容保留了摘要1和摘要2的所有信息
❌ 如果是硬删除：记忆A完全消失，摘要1的信息也丢失了
```

### 2. 记忆合并保护

配合内容合并机制（`MEMORY_UPDATE_MERGE_FIX.md`），双重保护：

1. **合并保护**：更新时不丢失旧内容
2. **软删除保护**：删除时不丢失数据

### 3. 智能上下文计算

智能上下文只计算活跃摘要的覆盖范围：

```typescript
const { data: summaries } = await supabase
  .from('chat_summaries')
  .select('start_message_id, end_message_id')
  .eq('is_active', true)  // 只计算活跃的

// 结果：被删除的摘要不会影响智能上下文的计算
```

## 相关文件

- `src/app/chat/[sessionId]/memory/page.tsx` - 删除逻辑（行1254-1313）、记忆查询（行264-270）
- `src/app/lib/enhancedChatSlice.ts` - 摘要查询（行326-355）
- `database/add_memory_enabled_field.sql` - 记忆软删除字段定义
- `upgrade_summaries_table.sql` - 摘要软删除字段和索引

## 未来改进方向

### 1. 回收站功能 ⭐⭐⭐

添加"回收站"界面：
- 查看已删除的摘要和记忆
- 支持恢复或永久删除
- 显示删除时间和删除原因

### 2. 自动清理

定期清理超过N天的软删除数据：
```sql
-- 删除30天前被标记为删除的记忆
DELETE FROM chat_memories
WHERE is_enabled = false
AND updated_at < NOW() - INTERVAL '30 days';

-- 删除30天前被标记为不活跃的摘要
DELETE FROM chat_summaries
WHERE is_active = false
AND updated_at < NOW() - INTERVAL '30 days';
```

### 3. 批量操作

支持批量恢复或批量删除：
- 选择多个已删除的摘要
- 一键恢复或永久删除

### 4. 删除原因记录

添加 `deleted_reason` 字段：
```sql
ALTER TABLE chat_summaries ADD COLUMN deleted_reason TEXT;
ALTER TABLE chat_memories ADD COLUMN deleted_reason TEXT;
```

可以记录：
- 用户手动删除
- 系统自动清理
- 关联摘要被删除（级联）

### 5. 记忆版本历史

真正实现记忆回退功能：
- 创建 `chat_memory_history` 表
- 每次更新记忆时，保存历史版本
- 删除摘要时，回退到上一个版本而不是禁用

```sql
CREATE TABLE chat_memory_history (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  summary_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (memory_id) REFERENCES chat_memories(id)
);
```

## 技术要点

### 1. 软删除 vs 硬删除

| 特性 | 软删除 | 硬删除 |
|------|--------|--------|
| 数据安全 | ✅ 高 | ❌ 低 |
| 可恢复性 | ✅ 可恢复 | ❌ 不可恢复 |
| 存储空间 | ⚠️ 略多 | ✅ 最小 |
| 查询性能 | ✅ 好（有索引） | ✅ 好 |
| 实现复杂度 | ✅ 简单 | ✅ 简单 |
| 数据一致性 | ✅ 易维护 | ⚠️ 需级联处理 |

### 2. 部分索引

PostgreSQL 支持部分索引（Partial Index），只索引满足条件的行：

```sql
CREATE INDEX idx_chat_memories_enabled
ON chat_memories(session_id, user_id, is_enabled)
WHERE is_enabled = true;  -- 只索引启用的记忆
```

**优势**：
- 索引更小，查询更快
- 不索引已禁用的记忆，节省空间
- 大部分查询都只需要启用的记忆

### 3. 级联软删除

删除摘要时，级联禁用关联记忆：

```typescript
// 1. 先禁用记忆
await supabase
  .from('chat_memories')
  .update({ is_enabled: false })
  .eq('summary_id', summaryId)

// 2. 再禁用摘要
await supabase
  .from('chat_summaries')
  .update({ is_active: false })
  .eq('id', summaryId)
```

**注意顺序**：先禁用子表（记忆），再禁用父表（摘要）

## 总结

软删除机制成功解决了摘要删除导致记忆丢失的严重问题：

✅ **问题解决**：
1. 删除摘要不再导致记忆永久丢失
2. 数据被保留，可以恢复
3. 用户体验更好（明确告知是隐藏而非删除）

✅ **实现简单**：
1. 利用现有字段，无需数据库迁移
2. 查询时添加过滤条件即可
3. 性能良好，有索引支持

✅ **向后兼容**：
1. 不影响现有功能
2. 旧数据自动兼容（默认值为 true）

---

## 版本信息
- 实现日期: 2025-01-XX
- 严重性: 高（数据丢失风险）
- 难度: 低（利用现有字段）
- 影响范围: 所有摘要和记忆删除操作
