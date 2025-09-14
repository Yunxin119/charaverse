# 简化微信风格表情包系统

这是一个简化版的表情包系统，模仿微信的表情包功能，去除了复杂的AI推荐和数据库功能。

## ✨ 主要特性

### 😊 丰富的表情包
- **100+ Emoji表情** - 精心分类的emoji，涵盖各种情绪和场景
- **自定义表情包上传** - 支持用户上传个人表情包
- **智能分类** - 最近使用、系统表情、自定义贴图

### 🎯 简单易用
- 类似微信的表情包面板
- 点击表情包按钮弹出面板
- 点击表情包直接发送
- 新手引导说明

### 📱 响应式设计
- 固定高度的表情包面板 (320px)
- 8列网格布局
- 支持暗色主题
- 移动端优化

### 💾 本地存储
- 最近使用的表情包自动保存
- 自定义表情包永久存储
- 用户偏好记忆

## 组件结构

### 核心组件

1. **StickerPanel** - 表情包选择面板
   - 支持三个标签页：最近、表情、贴图
   - 网格布局显示表情包
   - 自动记录最近使用

2. **StickerButton** - 表情包按钮
   - 圆形按钮设计
   - 支持激活状态显示
   - Hover动画效果

3. **StickerInput** - 综合组件
   - 组合按钮和面板
   - 处理表情包选择和发送逻辑

### 自定义Hook

**useSimpleStickers** - 管理表情包面板状态
- 控制面板开关
- 处理表情包点击事件
- 自动关闭面板

## 表情包格式

### Emoji表情
- 直接发送emoji字符：`😊`、`😂`、`👍` 等
- 自动识别纯emoji消息并大尺寸显示

### 自定义表情包
- 格式：`[sticker:name:url]`
- 示例：`[sticker:开心:https://example.com/happy.png]`

## 使用方法

### 基础使用

```tsx
import StickerInput from '@/components/SimpleSticker/StickerInput'

<StickerInput 
  onSend={(content) => {
    // 处理发送逻辑
    setUserInput(content)
    sendMessage()
  }}
  disabled={false}
/>
```

### 手动控制

```tsx
import StickerButton from '@/components/SimpleSticker/StickerButton'
import StickerPanel from '@/components/SimpleSticker/StickerPanel'
import useSimpleStickers from '@/hooks/useSimpleStickers'

function MyComponent() {
  const { isPanelOpen, togglePanel, closePanel, onStickerClick } = useSimpleStickers()
  
  return (
    <>
      <StickerButton onClick={togglePanel} isActive={isPanelOpen} />
      <StickerPanel
        isOpen={isPanelOpen}
        onClose={closePanel}
        onStickerClick={(sticker) => onStickerClick(sticker, handleSend)}
      />
    </>
  )
}
```

## 🎨 自定义表情包上传

### 上传功能
- **文件格式支持**: JPG、PNG、GIF
- **文件大小限制**: 单个文件最大 5MB
- **批量上传**: 可同时选择多个文件
- **智能处理**: 自动转换为base64存储

### 管理功能
- **悬停删除**: 鼠标悬停显示删除按钮
- **预览显示**: 实时预览上传的表情包
- **自动分类**: 上传后自动切换到贴图标签

## 默认表情包

系统内置100+个分类emoji表情：
- **基础笑脸**: 😀 😁 😂 🤣 😊 😄 😆 😅
- **爱意表情**: 😍 😘 😗 🤩 🥰
- **调皮表情**: 😉 😋 😜 🤪 😝
- **酷炫表情**: 😎 🤓 🧐
- **思考中性**: 🤔 😐 😑 😶 😏
- **不开心**: 😒 🙄 😕 😟 🙁
- **悲伤表情**: 😢 😭 😞 😔
- **愤怒表情**: 😠 😡 🤬 😤
- **惊讶表情**: 😲 😧 😱 😮 😯
- **疲惫生病**: 😴 😪 🥱 🤒 🤢 🤮
- **特殊表情**: 😷 😵 🤯 🤠 🥳
- **手势符号**: 👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👋 👏 💪 🙏
- **心形符号**: ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💞 💓 💖
- **其他符号**: 🔥 ⭐ ✨ 💥 💫 💦 💨 💤 💋 💌

## 扩展功能

### 添加自定义表情包

可以修改 `StickerPanel.tsx` 中的 `stickers` 标签页逻辑，加载自定义表情包：

```tsx
// 在StickerPanel组件中
const [customStickers, setCustomStickers] = useState<SimpleSticker[]>([])

// 加载自定义表情包
useEffect(() => {
  // 从API或本地存储加载
  loadCustomStickers().then(setCustomStickers)
}, [])

// 在getCurrentStickers中添加
case 'stickers':
  return customStickers
```

### 表情包收藏功能

可以添加长按收藏功能：

```tsx
// 添加收藏状态
const [favoriteStickers, setFavoriteStickers] = useState<SimpleSticker[]>([])

// 长按处理
const handleLongPress = (sticker: SimpleSticker) => {
  // 添加到收藏
  setFavoriteStickers(prev => [...prev, sticker])
}
```

## 与之前复杂系统的对比

| 特性 | 复杂系统 | 简化系统 |
|------|----------|----------|
| 组件数量 | 8个组件 | 3个组件 |
| 数据库表 | 4个表 | 0个表 |
| AI功能 | ✅ | ❌ |
| 用户偏好 | ✅ | ❌ |
| 本地存储 | ✅ | ✅ |
| 响应式 | ✅ | ✅ |
| 暗色主题 | ✅ | ✅ |

简化后的系统更适合快速开发和维护，满足基本的表情包功能需求。