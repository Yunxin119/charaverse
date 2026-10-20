# CharaVerse 项目逻辑与功能详解 (移动端重构指南)

这份文档基于现有的 Next.js Web 项目 (`charaverse`)，详细解析了应用的核心逻辑、功能模块实现细节、数据结构以及状态管理机制，旨在为移动端重构提供详尽的参考。

## 1. 项目概览

- **核心目标**: 提供一个沉浸式的 AI 角色扮演聊天平台，用户可以创建具有独特设定（Prompt）的 AI 角色，与其进行深度对话，并拥有记忆管理、日记生成等辅助功能。
- **技术栈 (Web 版参考)**:
  - **框架**: Next.js (App Router)
  - **状态管理**: Redux Toolkit (全局 UI/Auth/Chat 状态) + Context API (主题)
  - **数据/后端**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
  - **AI 集成**: 支持 DeepSeek, Gemini, OpenAI 以及兼容 OpenAI 格式的中转 API。
  - **API 管理**: 自研 API 连接池 (`ApiManager`)，支持负载均衡和故障切换。

## 2. 核心功能模块详解

### 2.1 认证与路由 (Authentication & Routing)

- **实现逻辑**:
  - **全局守卫**: 使用 `AuthCheck` 组件 (`src/app/components/auth/AuthCheck.tsx`) 包裹根布局。它监听 Supabase 的 `onAuthStateChange` 事件。
  - **状态同步**: 登录状态不仅存在于 Supabase SDK 内部，还通过 Redux 的 `authSlice` 同步到全局 Store (`state.auth.user`)。
  - **路由保护**:
    - 根路径 `/` 会根据 `state.auth.loading` 和 `state.auth.user` 决定渲染加载动画或执行跳转。
    - 未登录 -> 重定向至 `/login`。
    - 已登录 -> 重定向至 `/chat`。
- **移动端建议**:
  - 使用移动端原生的持久化存储 (如 React Native 的 `AsyncStorage` 或 Flutter 的 `SecureStore`) 存储 Session Token，配合 Supabase 移动端 SDK 实现自动登录。

### 2.2 角色系统 (Character System)

- **功能**: 核心资产。用户创建的角色本质上是一组复杂的 Prompt 配置。
- **数据模型 (`characters` 表)**:
  - `id` (int8): 唯一标识。
  - `user_id` (uuid): 所有者。
  - `name`, `avatar_url`: 基本展示信息。
  - `is_public` (bool): 是否公开到发现页。
  - **核心字段 `prompt_template` (JSONB)**:
    - 这是一个灵活的 JSON 结构，用于动态构建 System Prompt。
    - 结构示例:
      ```json
      {
        "basic_info": {
          "name": "...",
          "description": "...",
          "introduction": "...", // 公开展示的简介
          "initialMessage": "...", // 开场白
          "tags": ["..."]
        },
        "modules": [
          // 模块化 Prompt
          { "type": "用户角色设定", "userRoleName": "...", "content": "..." },
          { "type": "特殊要求", "content": "..." },
          { "type": "环境设定", "content": "..." }
        ]
      }
      ```
- **逻辑细节**:
  - **模块化构建**: `TemplateManager` 组件允许用户通过添加不同类型的“模块”来拼装角色的设定。在发送消息时，这些模块会被解析并拼接成最终发给 LLM 的 System Prompt。
  - **开场白**: `initialMessage` 是一个特殊字段。如果设置了，新会话创建时会直接插入一条 `role: assistant` 的消息到数据库，而不需要调用 LLM 生成。

### 2.3 聊天系统 (Chat System) - 核心引擎

这是应用最复杂的部分，涉及消息流转、上下文构建、API 调用和状态更新。

#### 2.3.1 消息发送流程 (完整链路)

1.  **用户输入**: 用户点击发送。
2.  **Redux Action**: 触发 `sendMessageWithContext` (在 `src/app/lib/enhancedChatSlice.ts`)。
3.  **乐观更新 (Optimistic UI)**: UI 可能会先展示用户消息（Web 版目前是等待 API 返回后存库，移动端建议先展示 loading 态）。
4.  **上下文构建 (`ContextManager`)**:
    - **目的**: 将庞大的聊天记录压缩到 LLM 的 Token 限制内（如 4k/8k/32k），同时保留关键信息。
    - **输入**: System Prompt (角色设定) + 完整消息历史 + 记忆/摘要。
    - **处理 (`src/app/lib/contextManager.ts`)**:
      - `estimateTokens()`: 估算文本 Token 数 (简单算法：中文\*1.5 + 英文单词)。
      - **策略**: 优先保留 System Prompt 和最新的 N 条消息。如果 Token 超出 `maxContextTokens - reservedTokens`，则从旧消息开始丢弃（截断）。
    - **增强上下文**: 自动注入“记忆表格”和“对话摘要”到 System Prompt 的末尾（详见 2.4 记忆系统）。
5.  **API 请求**:
    - 调用后端 API `/api/chat` (POST)。
    - Payload 包含: `messages` (处理后的上下文), `systemPrompt`, `apiKey`, `model`, `thinkingBudget` (针对推理模型)。
6.  **后端处理 (`src/app/api/chat/route.ts`)**:
    - **API 池选择**: `apiManager` 根据策略（轮询/单选）选择一个可用的 API Key 配置。
    - **请求转发**:
      - **DeepSeek**: 直接调用官方 API。
      - **Gemini**: 调用 Google API，包含特殊的 `safetySettings` 和 `thinkingConfig` (针对 2.5/Pro 模型)。
      - **OpenAI**: 标准调用。
      - **Relay (中转)**: 支持自定义 `baseUrl`，适配 OpenAI 格式接口。
    - **错误处理与故障切换 (Failover)**:
      - 如果首选 API 失败，`ApiPoolManager` 会标记其为不健康，并自动重试池中的下一个可用 API。
7.  **响应处理**:
    - 后端收到 LLM 响应，提取文本内容。
    - 如果内容被安全过滤 (Safety Filter) 或为空，后端会尝试返回友好的错误提示或 fallback 文本。
8.  **数据持久化**:
    - 前端接收到响应后，调用 Supabase 将 User 消息和 Assistant 消息写入 `chat_messages` 表。
9.  **UI 更新**: Redux Store 更新消息列表，触发页面滚动到底部。

#### 2.3.2 关键功能实现

- **重新生成 (Regenerate)**:
  - 逻辑: 删除最后一条 Assistant 消息（或在内存中替换），使用相同的上下文（排除该条消息）重新调用 LLM。
  - 函数: `regenerateMessageWithContext`。
- **分支/续写 (Send New From Here)**:
  - 逻辑: 基于历史中的某条消息作为起点，丢弃之后的所有消息，重新发起对话。这在数据库层面通常意味着删除后续消息（软删除或硬删除）。
- **编辑 (Edit)**:
  - 允许用户修改自己或 AI 的历史消息内容。修改后直接更新数据库 `content` 字段。这会影响后续的上下文生成（AI 会基于修改后的内容继续对话）。

### 2.4 记忆与摘要系统 (Memory & Summary)

为了解决长对话遗忘问题，系统实现了一套双层记忆机制。

#### 2.4.1 自动摘要 (Auto-Summary)

- **触发机制**: 在 `src/app/lib/enhancedChatSlice.ts` 中，每次发送消息前检查 `shouldGenerateSummary`。
- **阈值**: 当未被摘要的消息数量超过阈值（如 50 条）时触发。
- **流程**:
  1.  提取最近 N 条未摘要的消息。
  2.  调用 LLM (通常使用便宜的模型如 `gpt-4o-mini` 或 `flash` 模型) 生成一段 150-300 字的第三人称摘要。
  3.  存入 `chat_summaries` 表，记录覆盖的消息 ID 范围 (`start_message_id`, `end_message_id`)。
- **使用**: 在构建上下文时，较早期的原始消息被丢弃，取而代之的是将这些摘要文本注入到 System Prompt 中。

#### 2.4.2 结构化记忆 (Structured Memory)

- **数据源**: `chat_memories` 表。
- **类型**: 包含 `relationship` (关系), `character` (人物), `event` (事件) 等类型。
- **获取逻辑**: `getMemoryTableData` 函数查询该会话下 `importance >= 5` 且 `is_enabled = true` 的记忆条目。
- **注入方式**: 将这些记忆格式化为一个文本表格（Markdown 格式），追加到 System Prompt 后面。
  - 示例:
    ```text
    【重要记忆表格】
    🤝 关系状态:
    • 信任建立 (重要度8): 用户帮助角色解决了...
    ```

### 2.5 日记系统 (Diary System)

让角色以第一人称视角记录“内心独白”。

- **API**: `/api/diary/generate`
- **实现逻辑**:

  1.  **查询范围**: 查找上一篇日记的 `source_message_id_end`。如果不存在，则从头开始。
  2.  **获取增量**: 查询此 ID 之后的所有新消息。至少需要 3 条新消息才允许生成。
  3.  **Prompt 构建**:
      - System: "你是{角色名}，性格{...}。请根据以下对话写一篇日记，体现内心活动，不要流水账..."
      - User: [增量对话文本]
  4.  **生成与存储**: LLM 生成内容后，存入 `diaries` 表，并记录本次覆盖的消息 ID 范围，以便下次增量生成。

  ### 2.6 API 连接池管理 (ApiPoolManager)

  这是一个高可用性的 API 管理方案，特别适合移动端这种网络环境复杂或依赖多个免费/低配 API 额度的场景。

  - **核心类**: `ApiManager` (单例模式, `src/app/lib/apiManager.ts`)。
  - **配置结构**:
    ```typescript
    interface ApiConfig {
      id: string;
      provider: "deepseek" | "gemini" | "openai" | "custom";
      apiKey: string;
      baseUrl?: string; // 用于中转/自定义
      isActive: boolean;
      isHealthy: boolean; // 健康状态自动标记
      priority: number; // 优先级 (0-10)
      errorCount: number;
    }
    ```
  - **调度模式**:
    1.  **Single**: 强制使用指定的某一个 Key。
    2.  **Active Only**: 从所有 `isActive=true` 的 Key 中随机/按权重选择。
    3.  **Round Robin**: 轮询模式，在多个 Key 之间循环使用，分摊负载。
  - **健康检查与熔断**:
    - 如果一次 API 调用失败（网络错误或 5xx），`markApiError` 会增加错误计数。
    - 当错误计数超过阈值，`isHealthy` 被置为 `false`，该 Key 暂时被移出轮询队列。
    - 提供 `testApiConnection` 方法主动探测连通性。
  - **持久化**: 配置通过 `localStorage` 保存（移动端需适配为本地文件或 KV 存储）。

  ### 2.7 社交与分享系统 (Social & Sharing)

  为了增强用户粘性，应用内置了一个轻量级的社区系统，围绕“公开角色”进行互动。

  - **公开展示页 (`src/app/character/public/[id]/page.tsx`)**:
    - 任何用户可以将自己的角色设为 `is_public = true`。
    - 详情页展示角色的头像、名称、简介、标签以及部分 Prompt 设定（为了保护创作者，通常只展示非敏感的设定模块）。
  - **互动机制**:
    - **点赞 (Like)**: 简单的计数器机制，更新 `characters` 表的 `likes_count` 字段。
    - **复制 (Fork/Clone)**:
      - **逻辑**: 这是社区的核心功能。允许用户将别人的公开角色“复制”一份到自己的库中。
      - **实现**: 读取源角色的所有数据 -> 创建新记录 -> 设置 `user_id` 为当前用户 -> 重置 `is_public=false`, `likes_count=0` -> 写入数据库。
      - **意义**: 降低了创作门槛，用户可以基于别人的优秀设定进行微调。
    - **评论系统 (Comments)**:
      - **数据表**: `character_comments`。
      - **功能**: 支持纯文本评论和图片评论。
      - **图片处理**: 评论图片上传至 Supabase Storage 的 `comment-images` bucket，数据库只存 URL 数组。
  - **移动端建议**:
    - 增加“关注”机制，订阅创作者更新。
    - 增加“分享海报”生成功能，利用 Canvas 生成包含角色二维码的图片，便于在微信/推特传播。

  ### 2.8 设置与配置系统 (Settings & Configuration)

  系统采用了多层级的配置管理策略：全局设置 vs 会话级设置。

  #### 2.8.1 全局设置 (`src/app/settings/page.tsx`)

  - **个人资料**: 管理 `profiles` 表中的头像、昵称、简介。
  - **API 密钥与中转配置**:
    - **本地存储**: 出于隐私考虑，所有 API Key 和自定义 Host 配置均存储在浏览器 `localStorage` 中，**不上传服务器**。
    - **命名中转配置 (Named Relay)**: 允许用户添加多个 OpenAI 兼容接口（如 OneAPI, NewAPI 分发的接口），每个配置包含 `baseUrl`, `key`, `modelName`。
  - **外观**: 主题切换 (Light/Dark/System)。

  #### 2.8.2 会话级设置 (`src/app/chat/[sessionId]/settings/page.tsx`)

  - **独立性**: 每个聊天会话可以有独立的配置，覆盖全局默认值。
  - **模型选择**: 用户可以为特定角色指定使用特定的模型（例如：逻辑类角色用 Claude-3.5，闲聊类角色用 Gemini-Flash）。
  - **聊天背景**: 支持上传自定义背景图，以 Base64 或 Blob URL 形式存储在本地（移动端建议存文件路径）。
  - **上下文高级配置**:
    - **Max Context Tokens**: 手动限制发送给 LLM 的历史记录长度。
    - **保留条数**: 强制保留最近 N 条消息不被截断。
    - **智能模式开关**: 决定是否启用自动摘要和记忆注入。

  ### 2.9 模块化 Prompt 管理 (Module Management)

  为了方便用户复用优秀的 Prompt 片段，系统实现了模块保存与加载功能。

  - **组件**: `TemplateManager` (`src/app/components/TemplateManager.tsx`)。
  - **功能**:
    - **保存为模板**: 用户可以将当前编辑的某个模块（如“用户角色设定”、“特殊要求”）保存为模板。
    - **加载模板**: 在编辑角色时，可以从模板库中搜索并加载已保存的模块内容。
    - **范围**: 支持设为“公开模板”（所有人可见）或“私有模板”。
  - **数据流**:
    - 通过 `prompt_templates` 表存储（推测表名，基于代码逻辑）。
    - 加载时增加 `usage_count`，用于热门模板排序。

  ## 3. 数据库 Schema 参考 (Supabase)

- **`profiles`**: 用户表扩展
  - `id` (uuid, PK, ref auth.users)
  - `username`, `avatar_url`
- **`characters`**: 角色表
  - `id`, `user_id`, `name`, `avatar_url`
  - `prompt_template` (jsonb): 核心设定
  - `is_public` (bool)
- **`chat_sessions`**: 会话表
  - `id` (uuid)
  - `user_id`, `character_id`
  - `title`
- **`chat_messages`**: 消息表
  - `id` (int8)
  - `session_id` (uuid)
  - `role` (text): 'user' | 'assistant'
  - `content` (text)
  - `created_at`
- **`chat_summaries`**: 摘要表

  - `id`, `session_id`
  - `content` (text): 摘要文本
  - `start_message_id`, `end_message_id`: 覆盖范围
  - **`chat_memories`**: 记忆表
    - `id`, `session_id`
    - `type` (text): 'event' | 'fact' | ...
    - `content`, `importance` (int)
  - **`diaries`**: 日记表
    - `id`, `session_id`
    - `content` (text)
    - `source_message_id_start`, `source_message_id_end`
  - **`character_comments`**: 评论表
    - `id` (int8)
    - `character_id` (int8, ref characters.id)
    - `user_id` (uuid, ref profiles.id)
    - `content` (text)
    - `images` (text[]): 图片 URL 数组
    - `created_at`

  ## 4. 移动端重构关键点

1.  **状态管理迁移**: Web 端使用了 Redux Toolkit。在移动端（如 Flutter/React Native）可以复用这一思想，但需注意持久化（Redux Persist）。
2.  **API 兼容**: `src/app/api/chat/route.ts` 是 Next.js 的服务端代码。移动端没有服务端路由，需要将这部分逻辑迁移到：
    - **方案 A (推荐)**: 部署一个独立的后端服务 (Node.js/Go/Python) 或使用 Supabase Edge Functions 来承载 API 调用逻辑，保护 API Key 不泄露。
    - **方案 B (本地)**: 在移动端本地直接请求 LLM API。这需要用户在 App 设置里填入自己的 API Key，或者将 Key 硬编码（极不推荐，有安全风险）。鉴于项目原本就有“API 设置”页面，方案 B 也是可行的，即让用户自带 Key (`BYOK` - Bring Your Own Key) 模式。
3.  **UI 适配**:
    - **流式输出**: 移动端需要处理 SSE (Server-Sent Events) 或分块读取，实现打字机效果。
    - **键盘交互**: 聊天界面的键盘弹起/收起、输入框高度自适应是移动端开发的难点。
4.  **Markdown 渲染**: 聊天气泡需要支持 Markdown (加粗、斜体) 渲染，这在 Web 上有 `react-markdown`，移动端需寻找对应的原生渲染库。
5.  **数据安全与版本控制 (重要)**:
    - **当前痛点**: Web 版目前采用“单记录模式”，即公开角色 (`is_public=true`) 直接指向用户的原始数据行。这意味着作者修改角色的私密设定（如在 Prompt 中加入个人隐私信息）会实时同步给所有从该角色 fork 或正在查看该角色的用户，存在严重隐私风险。
    - **重构方案 (Snapshot 机制)**:
      - **发布即快照**: 当用户点击“发布/公开”时，不应直接修改原记录的 `is_public` 字段，而是应该创建一个**新的不可变记录** (Snapshot) 或存入独立的 `published_characters` 表。
      - **版本分离**:
        - **原稿 (Draft)**: 作者在本地继续编辑、聊天，所有修改仅对自己可见。
        - **已发布版 (Published)**: 社区看到的是发布时的那一版快照。作者修改原稿后，需要手动再次点击“发布”来更新公开版本（生成新版本号）。
      - **意义**: 彻底隔离“开发环境”（作者私有）与“生产环境”（社区公开），保护作者隐私。
