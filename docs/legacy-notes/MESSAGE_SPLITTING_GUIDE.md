# 📱 消息分割系统使用指南

## 🎯 功能概述

消息分割系统是手机聊天模式的核心功能，能够将 AI 的长回复自动分解为多条短消息，模拟真人聊天的自然节奏。

## 🔧 核心特性

### ✅ 已实现功能

1. **{pause} 标记分割**

   - AI 可以在回复中使用 `{pause}` 标记来指示分割点
   - 系统会自动在标记处分割消息

2. **智能长度控制**

   - 自动检测过长片段并进一步分割
   - 默认最大片段长度：60 字符（手机模式优化）
   - 保持语义完整性，优先在句号、问号等处分割

3. **真实打字模拟**

   - 随机延迟时间（0.6-2.1 秒）
   - 智能打字效果（短消息必显示，长消息 70%概率）
   - 可配置的打字速度（默认 12 字符/秒）

4. **消息优先级系统**

   - 高优先级：包含重要词汇、第一条/最后一条消息
   - 普通优先级：常规消息
   - 低优先级：很短的消息

5. **情绪检测**
   - 自动识别消息中的情绪标记
   - 支持：开心、难过、生气、惊讶、思考、爱意

## 📝 使用方法

### 在 AI Prompt 中使用

为了让 AI 使用消息分割功能，你可以在角色设定中添加类似的指导：

```
【特殊要求】
在手机聊天模式下，请使用 {pause} 来分割你的回复，让对话更自然：
- 在话题转换处使用 {pause}
- 在情绪变化处使用 {pause}
- 避免单条消息过长，适当分割

示例：
"你好！{pause}今天天气不错呢。{pause}我们来聊聊天吧！"
```

### 在代码中使用

```typescript
import {
  createMessageSplitter,
  needsSplitting,
  cleanPauseMarkers,
} from "@/lib/messageSplitter";

// 创建分割器
const splitter = createMessageSplitter({
  typingSpeed: 12,
  baseDelay: 600,
  randomDelayRange: 1500,
  maxSegmentLength: 60,
});

// 检查是否需要分割
const message = "你好！{pause}今天天气不错。{pause}聊聊天吧！";
if (needsSplitting(message)) {
  const segments = splitter.splitMessage(message);
  // 处理分割后的片段...
}

// 清理显示用的消息
const cleanMessage = cleanPauseMarkers(message); // "你好！今天天气不错。聊聊天吧！"
```

## 🎨 配置选项

```typescript
interface MessageSplitterConfig {
  minSegmentLength: number; // 最小片段长度 (默认: 20)
  maxSegmentLength: number; // 最大片段长度 (默认: 80, 手机模式: 60)
  typingSpeed: number; // 打字速度 字符/秒 (默认: 15, 手机模式: 12)
  baseDelay: number; // 基础延迟 毫秒 (默认: 800, 手机模式: 600)
  randomDelayRange: number; // 随机延迟范围 (默认: 2000, 手机模式: 1500)
  enableSmartSplit: boolean; // 启用智能分割 (默认: true)
  preserveFormatting: boolean; // 保持格式化 (默认: true)
}
```

## 🧪 测试功能

访问 `/test-split` 页面可以测试消息分割功能：

1. **实时预览**: 输入包含 `{pause}` 的消息，查看分割效果
2. **预设案例**: 提供多种测试场景
3. **详细信息**: 显示每个片段的长度、延迟、优先级等信息

## 🔄 工作流程

1. **消息检测**: MobileChatUI 检测到新的 AI 消息
2. **分割判断**: 检查消息是否包含 `{pause}` 标记
3. **消息分割**: 使用 MessageSplitter 分割消息
4. **状态管理**: 管理每个片段的显示状态
5. **逐步显示**: 按延迟时间逐个显示片段
6. **打字效果**: 在指定片段显示打字动画
7. **完成标记**: 显示"已送达"状态

## 🎯 最佳实践

### AI 回复示例

**❌ 不好的回复（太长，无分割）**

```
你好！我是你的AI助手，今天天气不错呢，我们来聊聊天吧！有什么我可以帮助你的吗？我可以回答各种问题，也可以陪你闲聊。
```

**✅ 好的回复（合理分割）**

```
你好！{pause}我是你的AI助手。{pause}今天天气不错呢，我们来聊聊天吧！{pause}有什么我可以帮助你的吗？
```

### 分割策略

1. **话题转换处分割**

   ```
   好的，我明白了。{pause}那么我们来谈谈另一个话题吧。
   ```

2. **情绪变化处分割**

   ```
   哈哈，这真有趣！{pause}不过说真的，这确实是个复杂的问题。
   ```

3. **问答分离**
   ```
   让我想想...{pause}我觉得答案是这样的：{pause}你觉得怎么样？
   ```

## 🚀 性能优化

- 使用 `Map` 管理分割状态，避免重复处理
- 异步处理分割逻辑，不阻塞 UI
- 智能检测，只处理包含 `{pause}` 的消息
- 内存清理：完成的分割状态会被保留用于显示

## 🐛 调试信息

系统会输出详细的调试日志：

```
🔪 开始分割消息: originalLength: 45, hasPauseMarkers: true
✂️ 初步分割结果: 3 个片段
✅ 最终分割结果: totalSegments: 3, segments: [...]
🆕 检测到需要分割的新AI消息: 123
✅ AI消息分割处理完成: 123
```

## 📋 下一步计划

- [ ] 实现 2.2 打字效果和时序控制增强
- [ ] 实现 2.3 消息发送行为模拟
- [ ] 添加音效支持
- [ ] 优化移动端体验
- [ ] 添加更多情绪检测模式

---

**开发状态**: ✅ 2.1 智能消息分割系统 - 已完成  
**测试页面**: `/test-split`  
**主要文件**: `src/lib/messageSplitter.ts`, `src/components/MobileChatUI.tsx`
