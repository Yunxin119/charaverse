# 记忆系统 - 用户人设支持

## 更新时间
2025-01-XX

## 问题背景

用户反馈：记忆总结部分没有传输用户的人设信息。如果剧本中设置了"用户角色设定"，这些信息应该传输给 AI，以便 AI 能够更好地理解对话上下文和生成更准确的记忆。

## 用户人设的存储位置

用户人设存储在 `characters` 表的 `prompt_template` 字段中：

```typescript
prompt_template: {
  basic_info: { ... },
  modules: [
    {
      id: '1',
      type: '用户角色设定',
      content: '...',
      userRoleName: '张三',
      userRoleAge: '25',
      userRoleGender: 'male',
      userRoleDetails: '详细的用户背景设定...'
    },
    // ... 其他模块
  ],
  script_characters: [ ... ]
}
```

## 实现方案

### 1. 提取用户人设信息

在 `src/app/api/chat/summary/route.ts` 中，从 `prompt_template.modules` 提取类型为 `'用户角色设定'` 的模块：

```typescript
// 提取用户角色设定
let userPersonaContext = ''

if (prompt.modules && Array.isArray(prompt.modules)) {
  const userPersonaModule = prompt.modules.find((m: any) => m.type === '用户角色设定')
  if (userPersonaModule) {
    userPersonaContext += '\n【用户角色设定】\n'
    if (userPersonaModule.userRoleName) {
      userPersonaContext += `用户角色姓名: ${userPersonaModule.userRoleName}\n`
    }
    if (userPersonaModule.userRoleAge) {
      userPersonaContext += `用户角色年龄: ${userPersonaModule.userRoleAge}\n`
    }
    if (userPersonaModule.userRoleGender) {
      const genderMap: Record<string, string> = {
        'male': '男',
        'female': '女',
        'none': '无性别',
        'other': '其他'
      }
      userPersonaContext += `用户角色性别: ${genderMap[userPersonaModule.userRoleGender] || userPersonaModule.userRoleGender}\n`
    }
    if (userPersonaModule.userRoleDetails) {
      userPersonaContext += `用户角色详细设定: ${userPersonaModule.userRoleDetails}\n`
    }
  }
}
```

**位置**: `src/app/api/chat/summary/route.ts:164-196`

### 2. 传输到 AI Prompt

将用户人设信息添加到两种摘要模式的 prompt 中：

#### 记忆表格模式
```typescript
summaryPrompt = `你正在为一个角色扮演对话生成/更新记忆表格。务必基于角色设定和现有记忆来理解对话。
${characterContext ? `${characterContext}\n` : ''}${userPersonaContext ? `${userPersonaContext}\n` : ''}${previousContext ? `${previousContext}\n` : ''}
【核心原则：记忆深化而非碎片化】
...`
```

**位置**: `src/app/api/chat/summary/route.ts:282-283`

#### 普通摘要模式
```typescript
summaryPrompt = `请为以下对话生成一个简洁的摘要，参考角色设定、之前的摘要和重要记忆。
${characterContext ? `${characterContext}\n` : ''}${userPersonaContext ? `${userPersonaContext}\n` : ''}${previousContext ? `${previousContext}\n` : ''}
摘要要求：
...`
```

**位置**: `src/app/api/chat/summary/route.ts:418-419`

### 3. 调试日志

添加 console.log 输出用户人设信息：

```typescript
console.log('👤 找到用户角色设定:', {
  name: userPersonaModule.userRoleName,
  age: userPersonaModule.userRoleAge,
  gender: userPersonaModule.userRoleGender,
  hasDetails: !!userPersonaModule.userRoleDetails
})
```

如果没有找到用户人设模块：
```typescript
console.log('ℹ️ 未找到用户角色设定模块')
```

**位置**: `src/app/api/chat/summary/route.ts:187-195`

## 效果

### Before (旧系统)
```
【角色设定信息】
角色名称: 小美
年龄: 18岁
性格特点: 温柔、善良

【现有记忆表格】
...

当前对话内容：
用户: 我今天很开心
小美: 真好呀！
```

AI 只知道角色的设定，不知道用户是谁，可能会生成泛泛的记忆。

### After (新系统)
```
【角色设定信息】
角色名称: 小美
年龄: 18岁
性格特点: 温柔、善良

【用户角色设定】
用户角色姓名: 张三
用户角色年龄: 25
用户角色性别: 男
用户角色详细设定: 是一名程序员，性格内向但善良...

【现有记忆表格】
...

当前对话内容：
用户: 我今天很开心
小美: 真好呀！
```

AI 现在知道用户的完整设定，能够生成更准确的记忆，例如：
- 记忆类型：relationship
- 标题：与张三的日常互动
- 内容：张三今天很开心。结合他内向的性格，主动分享好心情说明他对我比较信任...
- 重要度：7

## 支持场景

1. **单人角色扮演**: 用户设定自己的角色背景、性格等
2. **情景对话**: 用户作为特定角色（如学生、患者、客户）与 AI 互动
3. **关系深化**: AI 基于用户人设生成更个性化的记忆
4. **背景理解**: AI 理解对话时考虑用户的背景和设定

## 兼容性

- ✅ **向后兼容**: 如果没有用户人设模块，`userPersonaContext` 为空字符串，不影响现有功能
- ✅ **可选功能**: 用户可以选择是否添加"用户角色设定"模块
- ✅ **多模块支持**: 支持剧本中有多个不同类型的模块

## 技术要点

### 1. 条件渲染
使用三元运算符确保在没有用户人设时不添加额外的换行：
```typescript
${userPersonaContext ? `${userPersonaContext}\n` : ''}
```

### 2. 性别映射
将英文性别值映射为中文，方便 AI 理解：
```typescript
const genderMap: Record<string, string> = {
  'male': '男',
  'female': '女',
  'none': '无性别',
  'other': '其他'
}
```

### 3. 模块查找
使用 `Array.find()` 查找特定类型的模块：
```typescript
const userPersonaModule = prompt.modules.find((m: any) => m.type === '用户角色设定')
```

### 4. 安全检查
在访问深层属性前检查存在性：
```typescript
if (prompt.modules && Array.isArray(prompt.modules)) {
  // 安全访问
}
```

## 相关文件

- `src/app/api/chat/summary/route.ts` - 核心实现（3处修改）
  - 用户人设提取 (行164-196)
  - 记忆表格模式传输 (行282-283)
  - 普通摘要模式传输 (行418-419)
- `src/app/characters/new/page.tsx` - 用户人设的创建界面
- `MEMORY_DEEPENING_SYSTEM.md` - 记忆深化系统文档
- `MEMORY_SYSTEM_OPTIMIZATION.md` - 记忆系统优化文档

## 使用示例

### 示例1: 创建带用户人设的剧本

在创建剧本时，在"其他设定"标签页添加"用户角色设定"模块：

```
用户角色姓名: 李华
用户角色年龄: 30
用户角色性别: 男
用户角色详细设定:
  是一名高中老师，教授数学课程。性格温和但原则性强，
  对学生要求严格但关心学生成长。已婚，有一个5岁的女儿。
  平时喜欢阅读和跑步。
```

### 示例2: AI 生成的记忆示例

**对话**:
```
用户(李华): 今天班上有个学生考试作弊被我抓到了，我很失望。
角色(小美): 这种事确实让人难过。你打算怎么处理呢？
用户(李华): 我想和他谈谈，了解背后的原因。
```

**AI 生成的记忆**:
```json
{
  "action": "create",
  "type": "event",
  "title": "李华遇到学生作弊事件",
  "content": "李华今天在班上抓到学生考试作弊，表现出失望的情绪。作为一名原则性强的老师，这件事让他感到难过。他决定不急于惩罚，而是选择与学生谈话，了解背后的原因。这体现了他严格但关心学生的教育理念。",
  "importance": 7,
  "metadata": {
    "event_type": "工作事件",
    "participants": "李华、学生",
    "location": "班级",
    "emotion": "失望、关心",
    "decision": "谈话了解原因"
  }
}
```

可以看到，AI 结合了用户人设中的信息（"原则性强"、"关心学生成长"），生成了更准确、更有深度的记忆。

## 未来改进方向

### 1. 用户人设更新
允许在对话过程中动态更新用户人设（如用户透露新信息）

### 2. 多用户支持
在多人对话场景中，支持多个用户角色设定

### 3. 人设一致性检查
AI 检测对话是否与用户人设矛盾，提醒用户

### 4. 人设驱动的记忆推荐
基于用户人设，智能推荐应该记录的对话片段

---

## 版本信息
- 实现日期: 2025-01-XX
- 相关功能: 记忆系统、摘要生成、用户角色设定
