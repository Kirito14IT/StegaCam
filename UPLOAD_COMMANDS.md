# 🚀 GitHub 上传完整指令（可直接复制执行）

## ⚡ 快速版本（推荐）

```powershell
# 1. 进入项目目录
cd E:\github\trae_projects\image-process-model

# 2. 检查状态
git status

# 3. 添加所有更改（包括删除的文件）
git add -A

# 4. 提交更改
git commit -m "Update: 更新项目文件并添加上传指南"

# 5. 推送到 GitHub
git push origin main
```

## 📋 详细步骤版本

### 步骤 1: 进入项目目录
```powershell
cd E:\github\trae_projects\image-process-model
```

### 步骤 2: 检查当前状态
```powershell
git status
```

### 步骤 3: 添加所有更改
```powershell
# 添加所有更改（包括删除的文件）
git add -A

# 或者只添加新文件和修改的文件
git add .
```

### 步骤 4: 查看将要提交的内容
```powershell
git status
```

### 步骤 5: 提交更改
```powershell
git commit -m "Update: 更新项目文件并添加上传指南"
```

### 步骤 6: 推送到 GitHub
```powershell
git push origin main
```

**如果是首次推送**：
```powershell
git push -u origin main
```

## 🔄 如果远程仓库已有新内容

```powershell
# 先拉取远程更改
git pull origin main

# 解决冲突后（如果有）
git add .
git commit -m "Merge remote changes"

# 推送
git push origin main
```

## ✅ 验证上传成功

```powershell
# 检查状态
git status
# 应该显示: "Your branch is up to date with 'origin/main'"

# 查看远程仓库
git remote -v
```

然后访问：https://github.com/Kirito14IT/StegaCam

## 🛠️ 故障排除

### 如果推送失败（网络问题）

**方法 1: 使用 SSH**
```powershell
git remote set-url origin git@github.com:Kirito14IT/StegaCam.git
git push -u origin main
```

**方法 2: 配置代理**
```powershell
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
git push origin main
```

### 如果需要认证
推送时会提示输入用户名和密码：
- **用户名**: 你的 GitHub 用户名
- **密码**: 使用 Personal Access Token（不是 GitHub 密码）
  - 生成 Token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

## 📝 完整命令序列（复制粘贴执行）

```powershell
cd E:\github\trae_projects\image-process-model
git add -A
git commit -m "Update: 更新项目文件并添加上传指南"
git push origin main
```

---

**注意**: 
- 确保 `.gitignore` 已正确配置，避免上传敏感文件
- 大文件（>100MB）会被 GitHub 拒绝
- 如果遇到问题，查看 `GITHUB_UPLOAD_GUIDE.md` 获取详细帮助

