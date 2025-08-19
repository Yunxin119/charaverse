# 单角色单会话功能实现文档

## 功能概述

实现了每个角色只能同时存在一个聊天会话的功能。当用户尝试为已有会话的角色创建新会话时，系统会自动跳转到现有会话，而不是创建新的会话。

## 实现原理

### 1. 数据库层面

- 利用现有的 `chat_sessions` 表结构
- 通过 `user_id` 和 `character_id` 的组合来确保每个用户对每个角色只有一个会话
- 不需要修改数据库结构，完全通过应用逻辑实现

### 2. 应用逻辑层面

- 在创建新会话前，先检查数据库中是否已存在该用户和角色的会话
- 如果存在，返回现有会话的 ID
- 如果不存在，创建新会话
- 在 UI 层面，根据返回的会话 ID 决定是跳转到现有会话还是创建新会话

## 修改的文件

### 1. `src/app/store/chatSlice.ts`

**主要修改：**

- 修改了 `createChatSession` 函数，添加了检查现有会话的逻辑
- 添加了新的 `getExistingSession` 异步 thunk 函数
- 在 `extraReducers` 中添加了 `getExistingSession` 的处理逻辑

**关键代码：**

```typescript
// 创建新的聊天会话
export const createChatSession = createAsyncThunk(
  "chat/createSession",
  async ({
    characterId,
    title,
    userId,
  }: {
    characterId: number;
    title: string;
    userId: string;
  }) => {
    // 首先检查是否已存在该角色的会话
    const { data: existingSession, error: checkError } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("character_id", characterId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 是"没有找到行"的错误，这是正常的
      throw checkError;
    }

    // 如果已存在会话，返回现有会话
    if (existingSession) {
      return existingSession;
    }

    // 如果不存在，创建新会话
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: userId,
        character_id: characterId,
        title: title,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
);

// 获取角色现有会话
export const getExistingSession = createAsyncThunk(
  "chat/getExistingSession",
  async ({ characterId, userId }: { characterId: number; userId: string }) => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("character_id", characterId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data || null;
  }
);
```

### 2. `src/app/characters/page.tsx`

**主要修改：**

- 添加了 `useAppDispatch` 和 `getExistingSession` 的导入
- 添加了 `handleChatClick` 函数来处理聊天按钮点击
- 修改了聊天按钮，从 `Link` 组件改为 `Button` 组件并添加点击处理

**关键代码：**

```typescript
// 处理聊天按钮点击
const handleChatClick = async (characterId: number) => {
  if (!user) return;

  try {
    // 检查是否已有该角色的会话
    const existingSession = await dispatch(
      getExistingSession({
        characterId,
        userId: user.id,
      })
    ).unwrap();

    if (existingSession) {
      // 如果已有会话，跳转到现有会话
      router.push(`/chat/${existingSession.id}`);
    } else {
      // 如果没有会话，创建新会话
      router.push(`/chat/new?characterId=${characterId}`);
    }
  } catch (error) {
    console.error("检查会话失败:", error);
    // 如果检查失败，默认创建新会话
    router.push(`/chat/new?characterId=${characterId}`);
  }
};
```

### 3. `src/app/chat/[sessionId]/page.tsx`

**主要修改：**

- 修改了 `handleStartStory` 函数，在开始故事时检查是否是新创建的会话
- 添加了检查现有消息的逻辑来判断是否是新会话

**关键代码：**

```typescript
// 检查是否是新创建的会话（通过检查是否有消息来判断）
const { data: existingMessages } = await supabase
  .from("chat_messages")
  .select("id")
  .eq("session_id", session.id)
  .limit(1);

// 如果已有消息，说明是现有会话，直接跳转
if (existingMessages && existingMessages.length > 0) {
  router.replace(`/chat/${session.id}`);
  return;
}
```

### 4. `src/app/chat/page.tsx`

**主要修改：**

- 添加了 `useAppDispatch` 和 `getExistingSession` 的导入
- 添加了 `handleStartNewChat` 函数
- 修改了"开始新对话"按钮的处理逻辑

### 5. `src/app/page.tsx`

**主要修改：**

- 添加了 `useAppDispatch` 和 `getExistingSession` 的导入
- 添加了 `handleChatClick` 函数
- 修改了主页中角色列表的聊天按钮

## 用户体验流程

### 1. 首次聊天

1. 用户在角色页面点击"聊天"按钮
2. 系统检查该角色是否已有会话
3. 如果没有，跳转到新会话创建页面
4. 用户选择 AI 模型并开始对话

### 2. 再次聊天

1. 用户在角色页面点击"聊天"按钮
2. 系统检查该角色是否已有会话
3. 如果已有，直接跳转到现有会话
4. 用户可以看到之前的聊天记录

### 3. 错误处理

- 如果检查现有会话时出现错误，系统会默认创建新会话
- 这确保了用户体验的连续性，不会因为技术问题而无法开始聊天

## 技术特点

### 1. 无侵入性

- 不需要修改数据库结构
- 不需要修改现有的 API 接口
- 完全通过前端逻辑实现

### 2. 容错性

- 如果检查现有会话失败，会默认创建新会话
- 确保用户始终能够开始聊天

### 3. 性能优化

- 使用 `single()` 查询，只返回一条记录
- 在 UI 层面进行缓存，避免重复查询

### 4. 用户体验

- 无缝的跳转体验
- 保持聊天历史的连续性
- 避免创建重复的会话

## 测试建议

### 1. 功能测试

- 创建新角色并开始第一次聊天
- 返回角色页面，再次点击聊天按钮
- 验证是否跳转到现有会话而不是创建新会话

### 2. 边界测试

- 测试网络错误情况下的行为
- 测试数据库连接失败时的处理
- 测试并发访问的情况

### 3. 用户体验测试

- 验证跳转是否流畅
- 验证聊天历史是否正确保留
- 验证错误提示是否友好

## 注意事项

1. **数据一致性**: 确保在检查现有会话和创建新会话之间没有竞态条件
2. **错误处理**: 所有数据库操作都有适当的错误处理
3. **用户体验**: 在检查会话时可能需要显示加载状态
4. **性能**: 对于大量角色的用户，可能需要考虑分页或虚拟化

## 未来改进

1. **会话管理**: 可以添加会话列表页面，让用户管理多个会话
2. **会话切换**: 可以在聊天界面添加切换会话的功能
3. **会话合并**: 可以添加合并相似会话的功能
4. **会话导出**: 可以添加导出聊天记录的功能
