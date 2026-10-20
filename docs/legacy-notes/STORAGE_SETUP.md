# Supabase Storage 设置指南

## 问题

用户尝试上传 Banner 时出现错误：`Bucket not found`

## 解决方案

需要在 Supabase 中创建必要的存储桶（buckets）。

## 步骤

### 方法 1：使用 Supabase Dashboard

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 在左侧菜单中点击 "Storage"
4. 点击 "Create bucket" 创建以下存储桶：

#### 创建 avatars 存储桶

- **Name**: `avatars`
- **Public**: ✅ 启用
- **File size limit**: 10 MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

#### 创建 character-assets 存储桶

- **Name**: `character-assets`
- **Public**: ✅ 启用
- **File size limit**: 10 MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

### 方法 2：使用 SQL 脚本

1. 在 Supabase Dashboard 中，点击左侧菜单的 "SQL Editor"
2. 创建新查询并粘贴以下内容之一：

#### 简化版本（推荐）

```sql
-- 执行 setup_storage_buckets_simple.sql 中的内容
```

#### 完整版本（包含访问策略）

```sql
-- 执行 setup_storage_buckets.sql 中的内容
```

3. 点击 "Run" 执行脚本

## 验证设置

执行以下 SQL 查询来验证存储桶是否创建成功：

```sql
SELECT id, name, public FROM storage.buckets WHERE id IN ('avatars', 'character-assets');
```

应该返回两行记录：

- avatars
- character-assets

## 文件说明

### 存储桶用途

- **avatars**: 存储用户头像和角色头像
- **character-assets**: 存储用户 Banner 和其他角色相关资源

### 文件结构

```
avatars/
  users/           # 用户头像
    {user_id}-{timestamp}.jpg
  characters/      # 角色头像
    {user_id}-{timestamp}.jpg

character-assets/
  banners/         # 用户 Banner
    banner-{user_id}-{timestamp}.jpg
  characters/      # 角色相关资源
    ...
```

## 故障排除

如果仍然遇到问题：

1. 确认存储桶已创建并设置为 public
2. 检查 Supabase 项目的存储配额
3. 确认用户已登录并有适当权限
4. 检查网络连接和防火墙设置

## 注意事项

- 存储桶名称必须全局唯一
- 建议启用 Row Level Security (RLS) 以增强安全性
- 定期清理不再使用的文件以节省存储空间
