# 🔐 解决 Storage RLS 策略问题

## 问题诊断

你遇到的错误 "new row violates row-level security policy" 表示：

- ✅ `avatars` bucket 已经创建成功
- ❌ RLS 策略阻止了文件上传
- 🔍 需要配置正确的 RLS 策略

## 🎯 解决步骤

### 步骤 1: 诊断当前状态

在 Supabase SQL Editor 中执行：

```sql
-- 检查当前用户和bucket状态
SELECT auth.uid(), auth.role();
SELECT * FROM storage.buckets WHERE id = 'avatars';
```

### 步骤 2: 清理现有策略

```sql
-- 删除可能冲突的策略
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
```

### 步骤 3: 创建正确的策略

```sql
-- 1. 允许公开访问avatars bucket中的文件
CREATE POLICY "avatars_public_access" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 2. 允许认证用户上传到avatars bucket
CREATE POLICY "avatars_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated'
  );

-- 3. 允许认证用户更新文件
CREATE POLICY "avatars_authenticated_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated'
  );

-- 4. 允许认证用户删除文件
CREATE POLICY "avatars_authenticated_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated'
  );
```

### 步骤 4: 确保 bucket 配置正确

```sql
-- 确保bucket是public的
UPDATE storage.buckets SET public = true WHERE id = 'avatars';
```

## 🧪 测试验证

### 1. 检查策略是否创建成功

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%avatars%';
```

### 2. 测试用户认证状态

在浏览器控制台中执行：

```javascript
// 检查用户是否已登录
console.log("当前用户:", await supabase.auth.getUser());
```

### 3. 测试文件上传

- 重启应用：`npm run dev`
- 确保已登录
- 访问角色创建页面
- 点击 banner 中的头像上传图片

## 🚨 常见问题

### 问题 1: 用户未登录

**症状**: 即使执行了策略，仍然报 RLS 错误
**解决**: 确保在上传前已经登录

### 问题 2: 策略冲突

**症状**: 策略创建失败或不生效
**解决**: 完全删除旧策略后重新创建

### 问题 3: Bucket 配置错误

**症状**: 策略正确但仍无法访问
**解决**: 确保 bucket 的 public 设置为 true

## 💡 快速修复

如果上述步骤太复杂，可以尝试这个最简单的方案：

```sql
-- 删除所有avatars相关策略
DROP POLICY IF EXISTS "avatars_public_access" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_delete" ON storage.objects;

-- 创建最宽松的策略（仅用于测试）
CREATE POLICY "avatars_allow_all" ON storage.objects
  FOR ALL USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');
```

⚠️ **注意**: 最后这个策略非常宽松，仅用于测试。生产环境建议使用更严格的策略。

## ✅ 成功标志

配置成功后，你应该能够：

- ✅ 登录应用
- ✅ 访问角色创建页面
- ✅ 点击 banner 中的头像
- ✅ 选择并上传图片
- ✅ 看到头像立即更新
- ✅ 控制台没有 RLS 错误
