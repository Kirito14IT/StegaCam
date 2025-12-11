# GitHub 上传完整指令指南

## 📋 前置准备

1. **确保已安装 Git**
   ```powershell
   git --version
   ```

2. **配置 Git 用户信息**（如果还没配置）
   ```powershell
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

## 🚀 完整上传步骤

### 步骤 1: 进入项目目录

```powershell
cd E:\github\trae_projects\image-process-model
```

### 步骤 2: 检查 Git 仓库状态

```powershell
# 检查是否已初始化 Git 仓库
git status
```

**如果显示 "not a git repository"**，执行：
```powershell
git init
```

### 步骤 3: 检查远程仓库配置

```powershell
# 查看远程仓库
git remote -v
```

**如果没有配置远程仓库**，执行：
```powershell
git remote add origin https://github.com/Kirito14IT/StegaCam.git
```

**如果已存在但地址不对**，执行：
```powershell
git remote set-url origin https://github.com/Kirito14IT/StegaCam.git
```

### 步骤 4: 检查并更新 .gitignore

确保 `.gitignore` 文件存在且包含以下内容（已自动配置）：
- `node_modules/`
- `__pycache__/`
- `*.keystore`
- `.env`
- `server/saved_models/`
- `build/`, `tmp/` 等

### 步骤 5: 添加所有文件到暂存区

```powershell
# 添加所有文件（.gitignore 会自动过滤）
git add .
```

**或者选择性添加**：
```powershell
# 只添加特定文件
git add README.md
git add server/
git add client/
git add docs/
git add .gitignore
```

### 步骤 6: 检查将要提交的文件

```powershell
# 查看暂存区的文件
git status

# 查看详细的变更
git diff --cached
```

### 步骤 7: 提交更改

```powershell
# 提交所有更改
git commit -m "Initial commit: StegaCam - 隐溯盾图像版权与身份认证系统"

# 或者更详细的提交信息
git commit -m "feat: 初始提交 StegaCam 项目

- 添加后端 FastAPI 服务
- 添加 React Native 移动端应用
- 添加完整的用户认证系统
- 添加图像编码/解码功能
- 添加项目文档"
```

### 步骤 8: 设置主分支（如果需要）

```powershell
# 如果当前分支不是 main，重命名分支
git branch -M main
```

### 步骤 9: 拉取远程更改（如果远程已有内容）

```powershell
# 拉取并合并远程内容（如果远程仓库已有文件）
git pull origin main --allow-unrelated-histories --no-edit
```

**如果出现冲突**，解决冲突后：
```powershell
git add .
git commit -m "Merge remote-tracking branch 'origin/main'"
```

### 步骤 10: 推送到 GitHub

```powershell
# 推送到远程仓库
git push -u origin main
```

**首次推送**：
```powershell
git push -u origin main
```

**后续推送**：
```powershell
git push
```

## 🔧 常见问题处理

### 问题 1: 网络连接失败

**解决方案 A - 使用 SSH（推荐）**：
```powershell
# 1. 配置 SSH 密钥（如果还没有）
# 参考: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

# 2. 更改远程仓库地址为 SSH
git remote set-url origin git@github.com:Kirito14IT/StegaCam.git

# 3. 重新推送
git push -u origin main
```

**解决方案 B - 配置代理**：
```powershell
# 设置 HTTP 代理
git config --global http.proxy http://proxy.example.com:8080
git config --global https.proxy https://proxy.example.com:8080

# 推送
git push -u origin main

# 推送完成后，取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### 问题 2: 远程仓库已有内容

```powershell
# 拉取并合并
git pull origin main --allow-unrelated-histories

# 解决冲突后
git add .
git commit -m "Merge remote changes"

# 推送
git push -u origin main
```

### 问题 3: 认证失败

**使用 Personal Access Token**：
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 生成新 token（勾选 `repo` 权限）
3. 推送时使用 token 作为密码：
   ```powershell
   # 用户名：你的 GitHub 用户名
   # 密码：使用生成的 token
   git push -u origin main
   ```

### 问题 4: 文件太大

如果某些文件超过 100MB，GitHub 会拒绝：
```powershell
# 查看大文件
git ls-files | xargs ls -la | sort -k5 -rn | head -20

# 从 Git 中移除大文件（但保留本地文件）
git rm --cached <大文件路径>

# 更新 .gitignore
echo "<大文件路径>" >> .gitignore

# 重新提交
git add .gitignore
git commit -m "Remove large files"
git push -u origin main
```

## ✅ 验证上传成功

1. **检查推送状态**：
   ```powershell
   git status
   # 应该显示: "Your branch is up to date with 'origin/main'"
   ```

2. **访问 GitHub 仓库**：
   打开浏览器访问：https://github.com/Kirito14IT/StegaCam
   
   确认：
   - ✅ README.md 显示正常
   - ✅ 所有源代码文件都在
   - ✅ 文件结构正确

## 📝 完整命令序列（一键执行）

```powershell
# 进入项目目录
cd E:\github\trae_projects\image-process-model

# 初始化 Git（如果还没初始化）
git init

# 配置远程仓库
git remote add origin https://github.com/Kirito14IT/StegaCam.git
# 或更新已有远程仓库
git remote set-url origin https://github.com/Kirito14IT/StegaCam.git

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: StegaCam - 隐溯盾图像版权与身份认证系统"

# 设置主分支
git branch -M main

# 拉取远程更改（如果远程已有内容）
git pull origin main --allow-unrelated-histories --no-edit

# 推送到 GitHub
git push -u origin main
```

## 🎯 快速参考

| 操作 | 命令 |
|------|------|
| 查看状态 | `git status` |
| 添加文件 | `git add .` |
| 提交 | `git commit -m "message"` |
| 推送 | `git push -u origin main` |
| 拉取 | `git pull origin main` |
| 查看远程 | `git remote -v` |
| 查看日志 | `git log --oneline` |

---

**提示**：如果遇到任何问题，可以随时查看 Git 帮助：
```powershell
git help <command>
# 例如: git help push
```

