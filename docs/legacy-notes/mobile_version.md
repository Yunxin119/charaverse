# 📱 手机聊天模式开发计划

## 🎯 项目概述

参考 Silly Tavern 的手机模式，为应用增加一个全新的聊天体验：人物像真人一样发送多条短消息，支持表情包、图片、模拟转账等功能。与现有剧情模式分割但共享记忆，避免记忆污染。

## 🚀 开发阶段

### 第一阶段：基础 UI 框架 (2-3 天)

#### 1.1 创建手机聊天模式入口

**文件**: `src/app/chat/[sessionId]/page.tsx`

- [ ] 在聊天页面顶部添加模式切换按钮（剧情模式 / 手机模式）
- [ ] 创建状态管理：`isMobileMode`
- [ ] 根据模式显示不同的 UI 布局
- **成果**: 可以在两种模式间切换，看到不同的界面

#### 1.2 创建手机聊天 UI 组件

**文件**: `src/components/MobileChatUI.tsx`

- [ ] 仿制手机微信/短信的聊天界面
- [ ] 更紧凑的消息气泡设计
- [ ] 右侧用户消息（蓝色），左侧 AI 消息（灰白色）
- [ ] 时间戳显示（智能分组）
- [ ] 在线状态指示器
- **成果**: 具有手机聊天外观的基础界面

#### 1.3 响应式布局优化

- [ ] 手机端全屏体验
- [ ] 桌面端模拟手机聊天窗口
- [ ] 适配不同屏幕尺寸
- **成果**: 在各种设备上都有良好的视觉效果

### 第二阶段：多条短消息功能 (3-4 天)

#### 2.1 智能消息分割系统

**文件**: `src/lib/messageSplitter.ts`

- [ ] 创建消息分割算法：
  - 按照{pause}字符分割，知道 AI 使用 pause 字符对消息进行自然的拆分
  - 智能识别对话节奏
  - 控制每条消息长度（20-80 字符）
  - 保持语义完整性
- **成果**: AI 能够自动将长回复分解为多条短消息

#### 2.2 打字效果和时序控制

**文件**: `src/components/TypingEffect.tsx`

- [ ] 模拟真人打字速度（可配置）
- [ ] Header 中的"对方正在输入..."指示器
- [ ] 消息间隔时序（0.5-3 秒随机）
- [ ] 消息发送音效
- **成果**: AI 发送消息时有真实的打字感

#### 2.3 消息发送行为模拟

**文件**: `src/lib/humanBehavior.ts`

- [ ] 模拟修改消息（偶尔撤回重发）
- [ ] 情绪化发送节奏（兴奋时快速连发）

- **成果**: AI 的发送行为更像真人

### 第三阶段：表情包系统 (4-5 天)

#### 3.1 表情包数据库设计

**文件**: 新增 Supabase 表 `sticker_packs` 和 `stickers`

- [ ] 设计数据库结构：
  - `sticker_packs`: 表情包合集
  - `stickers`: 单个表情包
  - 支持分类、标签、使用频率
- [ ] 创建默认表情包（通用、可爱、搞笑等类别）
- **成果**: 完整的表情包存储系统

#### 3.2 表情包上传管理系统

**文件**: `src/app/admin/stickers/page.tsx`

- [ ] 管理员界面上传表情包
- [ ] 支持批量上传
- [ ] 自动生成缩略图
- [ ] 表情包分类管理
- **成果**: 可以轻松管理和添加新表情包

#### 3.3 表情包选择器

**文件**: `src/components/StickerPicker.tsx`

- [ ] 弹出式表情包选择面板
- [ ] 按分类浏览
- [ ] 搜索功能
- [ ] 最近使用和常用表情包
- [ ] 表情包预览
- **成果**: 用户和 AI 都能方便地选择表情包

#### 3.4 AI 智能表情包选择

**文件**: `src/lib/aiStickerSelection.ts`

- [ ] 根据对话内容自动选择合适表情包
- [ ] 情绪识别（开心、生气、惊讶等）
- [ ] 角色个性化表情包偏好
- [ ] 表情包使用概率控制
- **成果**: AI 能智能地使用表情包回应

### 第四阶段：图片发送功能 (2-3 天)

#### 4.1 图片上传和存储

**文件**: `src/lib/imageUpload.ts`

- [ ] 集成图片上传功能
- [ ] 自动压缩和格式转换
- [ ] 生成缩略图
- [ ] CDN 存储支持
- **成果**: 用户可以发送图片

#### 4.2 AI 图片生成集成

**文件**: `src/lib/aiImageGeneration.ts`

- [ ] 集成 DALL-E 或 Stable Diffusion
- [ ] 根据对话情境自动生成图片
- [ ] 图片描述生成
- [ ] 生成图片的缓存机制
- **成果**: AI 能够生成和发送图片

#### 4.3 图片查看器

**文件**: `src/components/ImageViewer.tsx`

- [ ] 图片全屏查看
- [ ] 缩放和滑动
- [ ] 保存到本地
- [ ] 图片信息显示
- **成果**: 完整的图片浏览体验

### 第五阶段：模拟转账功能 (2-3 天)

#### 5.1 转账 UI 组件

**文件**: `src/components/TransferUI.tsx`

- [ ] 仿微信/支付宝转账界面
- [ ] 金额输入和确认
- [ ] 转账动画效果
- [ ] 转账记录显示
- **成果**: 逼真的转账模拟界面

#### 5.2 虚拟货币系统

**文件**: `src/lib/virtualCurrency.ts`

- [ ] 虚拟货币余额管理
- [ ] 转账记录存储
- [ ] 角色个性化货币偏好
- [ ] 转账原因和场景生成
- **成果**: 完整的虚拟转账生态

#### 5.3 AI 转账行为

**文件**: `src/lib/aiTransferBehavior.ts`

- [ ] AI 主动发起转账的场景
- [ ] 转账金额的智能决策
- [ ] 转账时的对话生成
- [ ] 角色经济状况模拟
- **成果**: AI 会在合适时机主动转账

### 第六阶段：记忆管理系统 (3-4 天)

#### 6.1 双模式记忆存储

**文件**: `src/lib/memoryManager.ts`

- [ ] 分离手机模式和剧情模式的消息存储
- [ ] 共享核心记忆（角色设定、重要事件）
- [ ] 记忆权重系统（重要度分级）
- [ ] 记忆检索和关联
- **成果**: 两种模式的记忆完全独立但共享关键信息

#### 6.2 记忆污染防护

**文件**: `src/lib/memoryPrevention.ts`

- [ ] 模式切换时的记忆隔离
- [ ] 自动检测和过滤不当记忆
- [ ] 记忆标签系统（正剧、日常、娱乐）
- [ ] 用户手动记忆管理界面
- **成果**: 确保剧情模式的严肃性不被影响

#### 6.3 智能记忆摘要

**文件**: `src/lib/memorySummarizer.ts`

- [ ] 自动生成对话摘要
- [ ] 重要信息提取和保存
- [ ] 长期记忆和短期记忆管理
- [ ] 记忆检索优化
- **成果**: AI 能记住长期对话中的重要信息

### 第七阶段：人物卡增强 (2-3 天)

#### 7.1 手机模式专属设定

**文件**: `src/app/characters/new/page.tsx` 增强

- [ ] 添加手机聊天行为配置：
  - 发消息频率偏好
  - 表情包使用习惯
  - 打字速度设定
  - 在线时间模拟
- [ ] 生活化设定模块：
  - 日常作息
  - 兴趣爱好
  - 经济状况
  - 社交习惯
- **成果**: 角色在手机模式下有独特的行为特征

#### 7.2 双模式个性化

**文件**: `src/lib/personalityAdapter.ts`

- [ ] 同一角色在不同模式下的人格调整
- [ ] 正式度和随意度的自动切换
- [ ] 话题适应性调整
- [ ] 互动方式差异化
- **成果**: 同一角色在两种模式下有自然的表现差异

### 第八阶段：高级功能和优化 (3-4 天)

#### 8.1 群聊模拟

**文件**: `src/components/GroupChatSimulator.tsx`

- [ ] 多角色同时在线
- [ ] 模拟群聊互动
- [ ] 角色间关系动态
- [ ] 群聊话题引导
- **成果**: 更丰富的多人聊天体验

#### 8.2 生活化场景模拟

**文件**: `src/lib/lifeScenarios.ts`

- [ ] 日常生活事件触发
- [ ] 节日和特殊日期响应
- [ ] 天气、时间敏感互动
- [ ] 突发事件模拟
- **成果**: 更真实的生活化聊天体验

#### 8.3 性能优化和缓存

**文件**: 各个核心模块

- [ ] 消息加载优化
- [ ] 表情包缓存机制
- [ ] 内存使用优化
- [ ] 网络请求优化
- **成果**: 流畅的用户体验

### 第九阶段：测试和完善 (2-3 天)

#### 9.1 全面测试

- [ ] 功能测试（所有特性）
- [ ] 性能测试（大量消息处理）
- [ ] 兼容性测试（不同设备）
- [ ] 用户体验测试
- **成果**: 稳定可靠的产品

#### 9.2 UI/UX 优化

- [ ] 动画效果完善
- [ ] 交互细节打磨
- [ ] 响应式布局优化
- [ ] 无障碍访问支持
- **成果**: 精致的用户界面

## 🎨 技术架构

### 核心技术栈

- **前端**: Next.js, React, TypeScript, Framer Motion
- **后端**: Supabase (PostgreSQL, Storage, Auth)
- **AI 集成**: 现有的多模型支持系统
- **图片处理**: Sharp, Canvas API
- **状态管理**: Redux Toolkit

### 数据库设计

#### 新增表结构

```sql
-- 表情包合集
CREATE TABLE sticker_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 表情包
CREATE TABLE stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES sticker_packs(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[],
  emotion VARCHAR(50),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 手机聊天消息（扩展现有消息表）
ALTER TABLE chat_messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text';
ALTER TABLE chat_messages ADD COLUMN sticker_id UUID REFERENCES stickers(id);
ALTER TABLE chat_messages ADD COLUMN image_url TEXT;
ALTER TABLE chat_messages ADD COLUMN transfer_amount DECIMAL(10,2);
ALTER TABLE chat_messages ADD COLUMN chat_mode VARCHAR(20) DEFAULT 'story';

-- 虚拟转账记录
CREATE TABLE virtual_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id),
  from_user BOOLEAN, -- true: 用户转给AI, false: AI转给用户
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📋 文件结构

### 新增组件

```
src/
├── components/
│   ├── MobileChatUI.tsx           # 手机聊天主界面
│   ├── StickerPicker.tsx          # 表情包选择器
│   ├── TypingEffect.tsx           # 打字效果组件
│   ├── TransferUI.tsx             # 转账界面组件
│   ├── ImageViewer.tsx            # 图片查看器
│   └── GroupChatSimulator.tsx     # 群聊模拟器
├── lib/
│   ├── messageSplitter.ts         # 消息分割逻辑
│   ├── humanBehavior.ts           # 人类行为模拟
│   ├── aiStickerSelection.ts      # AI表情包选择
│   ├── imageUpload.ts             # 图片上传处理
│   ├── aiImageGeneration.ts       # AI图片生成
│   ├── virtualCurrency.ts         # 虚拟货币系统
│   ├── aiTransferBehavior.ts      # AI转账行为
│   ├── memoryManager.ts           # 记忆管理系统
│   ├── memoryPrevention.ts        # 记忆污染防护
│   ├── memorySummarizer.ts        # 记忆摘要生成
│   ├── personalityAdapter.ts      # 人格适配器
│   └── lifeScenarios.ts           # 生活化场景
└── app/
    └── admin/
        └── stickers/
            └── page.tsx           # 表情包管理界面
```

## 🔧 配置和环境变量

### 新增环境变量

```env
# 图片生成API (可选)
OPENAI_API_KEY=your_openai_api_key
STABILITY_API_KEY=your_stability_api_key

# 表情包存储
SUPABASE_STORAGE_BUCKET=stickers

# 虚拟货币设置
DEFAULT_VIRTUAL_BALANCE=1000
MAX_TRANSFER_AMOUNT=999
```

## 🎯 成功标准

### 用户体验目标

1. **真实感**: 聊天体验接近真人对话
2. **趣味性**: 表情包和转账功能增加互动乐趣
3. **个性化**: 每个角色有独特的聊天习惯
4. **稳定性**: 长时间使用不出现性能问题
5. **兼容性**: 在各种设备上都有良好体验

### 技术指标

- 消息发送响应时间 < 500ms
- 表情包加载时间 < 200ms
- 支持 100+并发用户
- 移动端加载时间 < 3 秒
- 99%可用性

## 🚦 风险和挑战

### 主要风险

1. **记忆污染**: 两种模式的记忆混合影响体验
2. **性能问题**: 大量动画和实时效果影响性能
3. **内容管理**: 表情包内容需要审核和管理
4. **AI 行为控制**: 确保 AI 的"人性化"行为不会失控

### 解决方案

1. 严格的记忆隔离机制和测试
2. 性能监控和优化策略
3. 建立内容审核流程
4. 行为边界设定和异常检测

## 📈 后续扩展可能

1. **语音消息**: 支持语音发送和 AI 语音回复
2. **视频通话**: 模拟视频通话界面
3. **位置分享**: 虚拟位置和地图功能
4. **朋友圈**: 角色动态发布功能
5. **多平台同步**: 跨设备聊天记录同步

---

**总预计开发时间**: 26-35 天  
**建议团队规模**: 2-3 名开发者  
**优先级**: 高（核心用户体验功能）

这个计划遵循循序渐进的原则，每个阶段都能看到具体成果，便于测试和迭代优化。
