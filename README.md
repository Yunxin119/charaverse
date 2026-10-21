# CharaVerse

AI 角色扮演聊天 Web 应用：自带 API key、流式回复、可导入通用格式的预设与主题、作者可做角色皮肤，并带长期记忆。

## 核心特性

- **BYOK（自带 key）**：API key 只存在浏览器 localStorage，每次请求随 `x-cv-connection` 请求头发给本站 `/api/*` 代理，服务端只做鉴权、校验、转发、限流，不落库、不打日志。
- **流式聊天**：基于 Vercel AI SDK `streamText`，支持发送 / 角色开场 / 重新生成（多候选 swipe）/ 续写 / 灵感 / 分支会话。
- **Prompt 预设**：Prompt 条目可排序、开关、占位条目；直接导入通用预设格式的 chat-completion 预设 JSON；用户级默认 + 会话级覆盖。
- **主题导入**：整站颜色、圆角、字体、玻璃参数都是 `--cv-*` token，一份 JSON 即可换肤；内置 Warm Glass Light / Dark、Carbon Neon、Sage Paper。
- **角色皮肤**：作者 CSS 经真正的 CSS 解析器清洗并限定在 `#cv_chat_root`；正则脚本（兼容通用格式）改写显示层；HTML 块在沙箱 iframe 里渲染（状态栏、手机壳这类美化卡可直接跑）。
- **任务提示词可编辑**：摘要 + 记忆提取的 prompt（system、模板、风格范例、采样）在「我的 → 任务提示词」里改，占位符填入角色卡 / 人设 / 上文 / 对话。
- **长期记忆**：自动摘要 + 8 类记忆表（人物 / 事件 / 设定 / 情感 / 时空 / 关系 / 任务约定 / 重要物品）+ 记忆版本与删除回滚（Postgres 函数单事务）。
- **世界书**：角色内嵌世界书 + 用户世界书库，关键词 / 常驻 / 次级关键词 / 概率 / 扫描深度 / 预算，直接导入通用的 world-info JSON，注入到预设的 `worldInfoBefore / After` 占位。
- **多开场白**：角色卡可写多个开场白，开新对话时第一条消息可左右切换。
- **导入导出**：角色卡导出为无损 JSON 或嵌入数据的 PNG 卡（通用角色卡 v2 格式，其他前端可读），导入支持 JSON 和 PNG（v1 / v2 / v3，含内嵌世界书与头像）；聊天记录导出 JSON / 通用 JSONL / Markdown，导入 JSON / JSONL 到任意角色下生成新对话。
- **发布即快照**：公开角色卡是作者点「发布」时冻结的副本，作者之后改稿不会实时作用到别人的聊天。

## 技术栈

| 层 | 选择 |
|---|---|
| 框架 | Next.js 16（App Router，`src/proxy.ts` 做路由守卫）+ React 19 |
| 样式 | Tailwind v4 `@theme` 映射 `--cv-*` token，设计系统「Warm Glass」（液态玻璃 + 新拟物 + 海报块），shadcn/Radix 原子组件已重做样式 |
| 后端 | Supabase：Auth（`@supabase/ssr` cookie session）、Postgres（所有表开 RLS）、Storage（`avatars` / `character-assets` / `chat-backgrounds`） |
| LLM | Vercel AI SDK 7（`ai` + `@ai-sdk/openai-compatible` / `openai` / `google` / `deepseek` / `anthropic`） |
| 状态 | TanStack Query（服务端数据）+ Zustand（API 连接等 UI 状态） |
| 校验 / 测试 | zod 4、vitest 5 |

## 快速开始

### 1. 环境变量

新建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

LLM key 不需要配置在服务端，用户在「我的 → API 连接」里自己填。

### 2. 安装依赖

```bash
npm install
```

### 3. 数据库

在 Supabase 控制台的 SQL editor 里**按顺序**执行（全部幂等，可重复跑）：

1. `supabase/hotfix/p0_rls_storage.sql` — 补 RLS、Storage 改成 owner-only、删泄露消息的 `get_incremental_messages`、新增 `character_likes` 表与 `toggle_character_like` RPC
2. `supabase/migrations/0002_chat_v2.sql` — 消息 `swipes` / `meta`、`chat_sessions.settings`、`user_presets` 表、`chat-backgrounds` bucket、两个 swipe RPC
3. `supabase/migrations/0003_skins_themes.sql` — `characters.skin`（回填旧 `custom_css`）、`user_themes` 表
4. `supabase/migrations/0004_publish_snapshot.sql` — `published_snapshot` / `published_at`（回填已公开角色）
5. `supabase/migrations/0005_memory_fixes.sql` — 记忆表列类型修正、`delete_summary_with_rollback` 函数
6. `supabase/migrations/0006_rate_limits.sql` — `rate_limits` 表 + `consume_rate_limit` 函数（没跑时服务端自动退到进程内计数）
7. `supabase/migrations/0007_drop_templates.sql` — 可选，删除已下线的模板表
8. `supabase/migrations/0008_lorebooks.sql` — `characters.lorebook` 列 + `lorebooks` 表
9. `supabase/migrations/0009_task_prompts.sql` — `user_task_prompts` 表（可编辑的摘要 / 记忆提取 prompt）
10. `supabase/migrations/0010_drop_diaries.sql` — 可选，删除已下线的日记表和列

跑 hotfix 前建议先导出一份现有策略对照：`select * from pg_policies order by schemaname, tablename, policyname;`

`0001_baseline.sql` 不在仓库里：它是 v1 时期线上 schema 的 dump，由你用 Supabase CLI 从自己的项目生成（新项目目前没有现成的 baseline 可用，需要先有一个带 v1 表结构的库）：

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db dump --schema public -f supabase/migrations/0001_baseline.sql
npx supabase gen types typescript --linked > src/types/database.ts   # 可选，尚未接入代码
```

### 4. 启动

```bash
npm run dev
```

打开 http://localhost:3000，注册账号（邮箱 + 密码）→ 我的 → API 连接 → 添加 key → 创建角色 → 开聊。

## 目录结构

```
src/
  app/                    路由与 layout；页面组件尽量薄
    api/chat/             流式聊天（唯一 LLM 出口）、branch、memory、summary
    api/connections/test  连接测试（8 token ping）
    chat/[sessionId]/     聊天页 + memory / history 子页
    characters/           我的角色、新建、[id]/edit、[id]/skin
    character/public/[id] 公开角色页（只读快照）
    explore/ user/[id]/   探索、作者主页
    settings/             资料 hub + connections / appearance / presets
    templates/ login/     提示词模板库、登录
    lib/                  旧的 Supabase 客户端导出与实体类型（仍在使用）
  components/
    chat/                 ChatView、MessageList/Bubble、Composer、Markdown、HtmlBlockFrame、SkinStyle
    presets/ skins/ theme/  预设编辑器、皮肤编辑器、主题导入
    memory/ history/      记忆表单（schema 驱动）、摘要时间线、历史
    character/            CharacterForm（新建/编辑合一）、发布、快照
    glass/ ui/ shell/     Glass/Neu/Poster 面、shadcn 原子、AppShell + 导航
  lib/
    llm/                  connection（请求头编解码）、providers（AI SDK 模型解析）、complete
    prompt/               presets（schema + 外部预设导入）、assemble（预设 × 角色卡 × 记忆 → messages）、macros、tokens
    skins/                sanitizeCss、regexScripts、htmlBlocks、schema、docs（选择器文档 + 预设）
    theme/                schema、builtin、applyTheme
    chat/ memory/         会话设置、上下文加载、记忆表格式、记忆类型 schema
    connections/          已保存连接的模型与旧配置迁移
    server/               auth（requireUser）、llmGuards（SSRF）、rateLimit
    supabase/             browser / server 客户端
  hooks/ queries/ stores/ useChatStream、useAutoSummary；TanStack Query hooks；Zustand 连接 store
  providers/ styles/      AuthProvider、QueryProvider；tokens.css
  proxy.ts                Next 16 路由守卫（未登录重定向 /login）
supabase/
  migrations/             0002–0006（0001 baseline 由你 dump）
  hotfix/                 p0_rls_storage.sql
docs/
  REFACTOR_PLAN.md        架构决策 A1–A16、设计系统、phase tracker
  design/tokens-preview.html  token 预览页
```

## 安全模型

- **key 不入库**：连接信息只在浏览器 localStorage（`cv.connections`），服务端只在单次请求内持有，不写 DB、不进日志、不进 URL、不进错误信息。
- **`x-cv-connection` 请求头**：`base64url(JSON { kind, apiKey, baseUrl?, model, label? })`，服务端用 zod 解码校验；`/api/*` 另需 `Authorization: Bearer <Supabase JWT>`（`requireUser`），页面则由 `proxy.ts` 的 cookie session 守卫。
- **SSRF 守卫**：`assertSafeBaseUrl` 只放行 https、拒绝 IP 字面量 / localhost / `.local` / `.internal` / 云元数据 / 带账号密码或 `?#` 的 URL；模型名走白名单正则；上游错误体只摘取 `error.message` 并截断，不回显。
- **限流**：每用户固定窗口，chat 30 次/分、摘要 6、连接测试 12（`consume_rate_limit`，RPC 不可用时退到进程内计数）。
- **RLS**：每张表 owner-only；Storage 对象只能由上传者改删；点赞走 `toggle_character_like` RPC，客户端不能直接改别人的行。
- **CSS 作用域清洗**：css-tree 解析成 AST → 丢弃 `@import` / 危险属性 / `expression()` / `javascript:` → `url()` 只允许 Supabase Storage、少数图床与作者自填的 `allowedUrlHosts` → 每条选择器加 `#cv_chat_root` 前缀后再序列化。
- **iframe 沙箱**：作者 / 模型输出的 HTML 只在 `<iframe sandbox="allow-scripts">`（无 `allow-same-origin`）+ `srcdoc` 里渲染，带独立 meta CSP（`connect-src 'none'`、`form-action 'none'`），高度经 postMessage 回传；主文档从不插入作者 HTML。
- **快照发布**：探索页、公开角色页、他人开聊、复制角色只读 `published_snapshot`；作者草稿改动需重新发布才可见。
- **Markdown 白名单**：消息里的 `<img>` 只允许 Supabase Storage 与本站域名，其他来源不加载（防零点击外泄）；链接统一 `rel="noopener noreferrer nofollow"`；不启用 rehype-raw。
- **安全头**：`next.config.ts` 下发 CSP、HSTS（生产）、nosniff、`X-Frame-Options: DENY`、Referrer-Policy、Permissions-Policy。
- **记忆写回校验**：模型返回的记忆条目经 zod 校验、限制数量与长度后才入库，防投毒与膨胀。

## 定制

### 主题 JSON（我的 → 外观 → 导入）

schema 在 `src/lib/theme/schema.ts`，只需写要覆盖的键，其余回退到内置 Warm Glass：

```json
{
  "name": "My Theme",
  "version": 1,
  "mode": "dark",
  "tokens": { "bg": "#1c1410", "fg": "#f2dece", "primary": "#9c4233", "accent": "#e07a4c" },
  "glass": { "blur": 18, "saturate": 1.6 },
  "radius": { "sm": 10, "md": 16, "lg": 24, "xl": 32 },
  "fonts": { "body": "system-ui", "display": "Fraunces, serif", "mono": "SF Mono" },
  "chat": { "bubbleStyle": "glass", "density": "cozy", "customCss": "" }
}
```

可用 token 键：`bg` `bg-elevated` `bg-sunken` `fg` `fg-muted` `fg-subtle` `primary` `primary-hover` `primary-fg` `secondary` `secondary-fg` `accent` `accent-fg` `accent-2` `accent-3` `border` `border-strong` `ring` `success` `warning` `danger` `info` `glass-bg` `glass-bg-strong` `glass-border` `neu-light` `neu-dark` `ambient-1` `ambient-2`。颜色接受 hex / rgb(a) / hsl(a) / oklch / color-mix。

### 预设 JSON（我的 → 预设 → 导入）

schema 在 `src/lib/prompt/presets.ts`。通用预设格式的 chat-completion 预设会被自动识别并转换；本站格式的最小例子：

```json
{
  "name": "我的预设",
  "version": 1,
  "prompts": [
    { "id": "main", "name": "主提示", "role": "system", "content": "来玩角色扮演，你将完全成为{{char}}……", "enabled": true },
    { "id": "charDescription", "marker": true, "enabled": true },
    { "id": "personaDescription", "marker": true, "enabled": true },
    { "id": "summaries", "marker": true, "enabled": true },
    { "id": "memoryTable", "marker": true, "enabled": true },
    { "id": "chatHistory", "marker": true, "enabled": true },
    { "id": "jailbreak", "role": "system", "content": "…", "enabled": false,
      "injection": { "position": "absolute", "depth": 2, "role": "system" } }
  ],
  "sampling": { "temperature": 1, "top_p": 0.95, "max_tokens": 4096 },
  "formatting": { "assistantPrefill": "" }
}
```

- marker 条目由本站数据填充：`charDescription` `charPersonality` `scenario` `charModules` `personaDescription` `memoryTable` `summaries` `chatHistory` `worldInfoBefore` `worldInfoAfter` `dialogueExamples`（后三者预留）。
- 普通条目按顺序进入 messages；`injection.position: "absolute"` 的条目按 `depth` 插进聊天历史（in-chat 注入）。
- 支持宏 `{{char}}` `{{user}}` `{{date}}` `{{time}}` `{{newline}}` `{{trim}}` 等（`src/lib/prompt/macros.ts`）。
- 上限：200 条、单条 50k 字、整体 300k 字。

### 角色皮肤（角色 → 编辑 → 外观皮肤，或 `/characters/<id>/skin`）

`characters.skin` 结构：`{ version: 1, css, regexScripts[], renderHtml, allowedUrlHosts[] }`。

CSS 只作用于聊天页，常用选择器（完整列表见编辑器侧栏 / `src/lib/skins/docs.ts`）：

| 选择器 | 说明 |
|---|---|
| `#cv_chat_root` | 聊天页根容器，所有规则都会被限定在它里面 |
| `#cv_background_image` / `#cv_background_overlay` | 背景图层 / 遮罩 |
| `#cv_chat_header` / `#cv_chat_body` / `#cv_messages_container` | 顶部栏 / 滚动区 / 消息列表 |
| `.cv_message_row_ai` / `.cv_message_row_user` | AI / 用户消息行 |
| `.cv_ai_message_bubble` / `.cv_user_message_bubble` | 气泡 |
| `.cv_message_avatar` / `.cv-markdown` | 头像 / 气泡内 Markdown |
| `#cv_chat_input_box` / `#cv_chat_input_textarea` / `#cv_send_button` | 输入框 / 文本域 / 发送键 |

正则脚本字段（兼容通用格式，可直接导入外部 regex JSON）：

| 字段 | 说明 |
|---|---|
| `find` | 正则源码（不含两侧 `/`） |
| `flags` | `gimsuy` 子集，默认 `g` |
| `replace` | 替换串，支持 `$1…$9` `$&` `$<name>` `{{match}}` |
| `trimStrings` | 替换前先从匹配中剔除的子串 |
| `target` | `ai` / `user` / `both`，默认 `ai` |
| `renderAsHtml` | 输出视为 HTML，交给沙箱 iframe 渲染 |
| `enabled` | 开关 |

`renderHtml: true` 时，AI 回复里的 `<div>` / `<section>` / `<style>` 等块级原始 HTML 也会被切出送进沙箱。

### 世界书（角色 → 编辑 → 世界书；我的 → 世界书库）

两种来源：写在角色卡里的（随发布快照一起给别人）和你自己库里的（勾选「启用」就应用到所有对话）。每次生成前，服务端扫描最近 `scanDepth` 条消息（加上你正要发送的这句），命中关键词或标为「常驻」的条目按 `order` 排好，分别填进预设的 `worldInfoBefore` / `worldInfoAfter` 占位；每本书有 `tokenBudget`（字符数）上限。

```json
{ "name": "城市设定", "scanDepth": 6, "tokenBudget": 2000,
  "entries": [
    { "id": "rain", "name": "天气", "keys": ["雨夜", "/下.{0,2}雨/"], "content": "这座城市一年有二百天在下雨。", "position": "before", "order": 10 },
    { "id": "world", "name": "世界观", "constant": true, "content": "故事发生在 2031 年。" },
    { "id": "garage", "keys": ["车库"], "secondaryKeys": ["钥匙"], "selective": true, "content": "…", "probability": 100 }
  ] }
```

导入时也接受通用的 world-info JSON（`entries` 为对象映射，字段 `key / keysecondary / content / constant / selective / order / position / disable / probability / depth`）和角色卡内嵌的 `character_book` 数组格式。

## 开发

```bash
npm run dev         # next dev（turbopack）
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run（116 个用例：prompt 组装、预设导入、CSS 清洗、正则脚本、皮肤样本、SSRF 守卫等）
npm run build       # next build
```

**不要在 `next dev` 运行时跑 `next build`**：两者都会改写 `next-env.d.ts`，同时存在会让 Turbopack 反复重编译、浏览器无限刷新。先停掉 dev 再 build；已经进入循环就全部停掉，`rm -rf .next` 后重新 dev。

架构决策（A1–A16）、设计系统 token 表、每个 phase 的任务与验收都在 `docs/REFACTOR_PLAN.md`；约定见 `CLAUDE.md`。v1 代码、SQL 与设计笔记归档在 git tag `v1-archive`。

## 明确不做的事

- 手机 App / PWA / IM 式手机聊天：网页保持响应式即可（A13）。
- 多角色「剧本」模式 / 群聊（A15）。
- 贴纸系统（旧实现已删，若需要会重新设计）。
