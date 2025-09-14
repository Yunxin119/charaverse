# 表情包系统使用说明

## 概述

这是一个完整的表情包系统实现，包含了数据库设计、管理界面、选择器组件和AI智能推荐功能。

## 主要组件

### 1. 数据层
- `database/sticker_system.sql` - 数据库表结构
- `src/types/sticker.ts` - TypeScript类型定义
- `src/lib/stickerService.ts` - 数据访问服务

### 2. 管理界面
- `src/app/admin/stickers/page.tsx` - 完整的管理员界面

### 3. 用户界面组件
- `src/components/StickerPicker.tsx` - 表情包选择器弹窗
- `src/components/StickerButton.tsx` - 表情包选择按钮
- `src/components/StickerMessage.tsx` - 表情包消息显示
- `src/components/StickerInput.tsx` - 综合输入组件

### 4. AI智能推荐
- `src/lib/aiStickerService.ts` - AI表情包推荐服务
- `src/components/AIStickerRecommendations.tsx` - AI推荐显示组件

### 5. 自定义Hooks
- `src/hooks/useStickerPicker.ts` - 表情包选择器状态管理
- `src/hooks/useAIStickers.ts` - AI推荐状态管理

## 使用方法

### 在聊天界面中集成表情包

```tsx
import StickerInput from '@/components/StickerInput'
import StickerMessage from '@/components/StickerMessage'

// 在输入区域添加表情包支持
<StickerInput
  userId={userId}
  onStickerSelect={(sticker) => {
    // 处理表情包选择，格式化为特殊字符串
    const stickerMessage = `[sticker:${sticker.id}:${sticker.image_url}:${sticker.name}]`
    // 发送消息
    sendMessage(stickerMessage)
  }}
  currentMessage={userInput}
  showStickerButton={true}
  showAIRecommendations={true}
/>

// 在消息显示中添加表情包支持
const renderMessage = (message) => {
  const stickerMatch = message.content.match(/^\[sticker:([^:]+):([^:]+):([^\]]+)\]$/)
  if (stickerMatch) {
    const stickerData = {
      id: stickerMatch[1],
      image_url: stickerMatch[2],
      name: stickerMatch[3]
    }
    return <StickerMessage sticker={stickerData} />
  }
  // 普通消息渲染...
}
```

### 表情包消息格式

表情包消息使用特殊格式字符串存储：
```
[sticker:id:image_url:name]
```

### AI推荐配置

```tsx
const aiConfig = {
  enabled: true,
  probability: 0.3, // 30%概率推荐表情包
  max_stickers_per_message: 1,
  emotion_weight: 0.4,
  keyword_weight: 0.3,
  usage_weight: 0.3,
  character_preferences: ['cute', 'happy']
}
```

## 数据库设置

1. 执行 `database/sticker_system.sql` 创建表结构
2. 在Supabase中创建 `stickers` 存储桶
3. 配置存储桶的访问策略

## 管理表情包

访问 `/admin/stickers` 页面来：
- 查看表情包统计
- 管理表情包合集
- 上传新表情包
- 批量操作

## 特性

- 🎯 **分类管理** - 14种预定义分类
- 🔍 **搜索功能** - 支持名称、标签、关键词搜索
- ❤️ **收藏系统** - 用户可收藏常用表情包
- 📊 **使用统计** - 记录使用频率和最近使用
- 🤖 **AI推荐** - 基于消息内容智能推荐
- 📱 **响应式设计** - 支持手机和桌面端
- 🌙 **暗色模式** - 完整的主题支持
- ⚡ **性能优化** - 懒加载和缓存机制

## 扩展功能

- 支持GIF动画表情包
- 表情包合集订阅
- 用户自定义表情包上传
- 表情包使用分析
- 多语言支持