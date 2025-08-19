# Supabase Storage 配置指南

## 🎯 目标

为 CharaVerse 应用配置头像上传功能，需要在 Supabase 中创建 Storage bucket。

## 📋 配置步骤

### 步骤 1: 创建 Storage Bucket

1. **登录 Supabase Dashboard**

   - 访问 [supabase.com](https://supabase.com)
   - 登录你的账号
   - 选择你的 CharaVerse 项目

2. **创建 avatars bucket**
   - 在左侧导航栏点击 **Storage**
   - 点击 **New bucket** 按钮
   - 填写以下信息：
     - **Bucket name**: `avatars`
     - **Public bucket**: ✅ **勾选**（重要！）
   - 点击 **Save** 按钮

### 步骤 2: 配置访问策略（可选）

如果你希望更细粒度的权限控制，可以在 SQL Editor 中执行以下策略：

1. **打开 SQL Editor**

   - 在左侧导航栏点击 **SQL Editor**
   - 点击 **New query**

2. **执行策略 SQL**

   ```sql
   -- 允许所有人查看头像
   CREATE POLICY IF NOT EXISTS "Avatar images are publicly accessible" ON storage.objects
   FOR SELECT USING (bucket_id = 'avatars');

   -- 允许认证用户上传头像
   CREATE POLICY IF NOT EXISTS "Users can upload avatar images" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'avatars'
     AND auth.role() = 'authenticated'
   );

   -- 允许用户更新自己的头像
   CREATE POLICY IF NOT EXISTS "Users can update their own avatar images" ON storage.objects
   FOR UPDATE USING (
     bucket_id = 'avatars'
     AND auth.role() = 'authenticated'
   );

   -- 允许用户删除自己的头像
   CREATE POLICY IF NOT EXISTS "Users can delete their own avatar images" ON storage.objects
   FOR DELETE USING (
     bucket_id = 'avatars'
     AND auth.role() = 'authenticated'
   );
   ```

3. **执行 SQL**
   - 点击 **Run** 按钮执行 SQL

## ✅ 验证配置

配置完成后，你可以通过以下方式验证：

1. **检查 bucket 是否创建成功**

   - 回到 Storage 页面
   - 应该能看到 `avatars` bucket
   - bucket 应该显示为 "Public"

2. **测试头像上传**
   - 启动 CharaVerse 应用：`npm run dev`
   - 访问角色创建页面
   - 点击 banner 中的头像尝试上传图片
   - 如果没有错误，说明配置成功！

## 🚨 常见问题

### 问题 1: "Bucket not found" 错误

**解决方案**: 确保在 Supabase Dashboard 中正确创建了名为 `avatars` 的 bucket

### 问题 2: 上传权限被拒绝

**解决方案**:

1. 确保 bucket 设置为 Public
2. 检查用户是否已登录
3. 如果问题持续，尝试删除并重新创建策略

### 问题 3: 策略创建失败

**解决方案**: 先删除现有策略，然后重新创建：

```sql
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar images" ON storage.objects;
```

## 📁 文件结构

配置完成后，上传的文件将按以下结构存储：

```
avatars/
├── users/           # 用户头像
│   └── {user_id}-{timestamp}.jpg
└── characters/      # 角色头像
    └── {user_id}-{timestamp}.jpg
```

## 🎉 完成！

配置完成后，用户就可以：

- ✅ 在角色创建页面上传头像
- ✅ 在角色编辑页面更换头像
- ✅ 在设置页面上传个人头像
- ✅ 头像会自动压缩和优化
- ✅ 支持 JPG、PNG 等常见格式
