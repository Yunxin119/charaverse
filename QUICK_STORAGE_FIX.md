# 🚀 快速解决 Storage 问题

## 最简单的解决方案

如果你遇到 "Bucket not found" 错误，只需要以下几步：

### 步骤 1: 创建 Public Bucket（最重要！）

1. **登录 Supabase Dashboard**
2. **点击左侧 Storage**
3. **点击 "New bucket" 按钮**
4. **填写信息**：
   - Bucket name: `avatars`
   - **Public bucket: ✅ 必须勾选！**
5. **点击 Save**

### 步骤 2: 测试（无需额外 SQL）

由于 bucket 设置为 Public，应该可以直接使用了：

1. 重启应用：`npm run dev`
2. 访问角色创建页面
3. 点击 banner 中的头像上传

## ❌ 如果仍然有问题

### 选项 A: 检查 bucket 设置

- 确保 bucket 名称确实是 `avatars`
- 确保 "Public bucket" 已勾选

### 选项 B: 手动添加策略（如果需要）

在 SQL Editor 中执行（忽略 "already exists" 错误）：

```sql
-- 只执行这一个最重要的策略
CREATE POLICY "Users can upload avatar images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);
```

### 选项 C: 重新创建 bucket

如果上述都不行：

1. 删除现有的 `avatars` bucket
2. 重新创建，确保勾选 "Public bucket"

## 🎯 预期结果

配置正确后，你应该能够：

- ✅ 点击 banner 中的头像
- ✅ 选择图片文件
- ✅ 看到头像立即更新
- ✅ 没有控制台错误

## 📞 还是不行？

如果问题持续存在，可能的原因：

1. **网络问题**: 检查网络连接
2. **认证问题**: 确保用户已登录
3. **环境变量**: 检查 `.env.local` 中的 Supabase 配置是否正确

大多数情况下，只需要正确创建 Public bucket 就能解决问题！
