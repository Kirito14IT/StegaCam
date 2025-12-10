# 数据库接入实施总结

## ✅ 已完成的工作

### 1. 后端数据库接入

#### 创建的文件：
- `server/app/database.py` - 数据库连接和会话管理
- `server/app/models.py` - 用户数据模型
- `server/app/auth.py` - 认证工具（JWT、密码哈希、用户查询）

#### 修改的文件：
- `server/app/server.py` - 添加了认证路由和中间件
  - `POST /api/v1/auth/register` - 邮箱注册
  - `POST /api/v1/auth/login` - 邮箱/用户名登录
  - `GET /api/v1/auth/me` - 获取当前用户信息
  - `POST /api/v1/encode` - 现在需要认证
  - `POST /api/v1/decode` - 现在需要认证

#### 配置文件：
- `server/requirements.txt` - 添加了新依赖
- `server/env.example` - 环境变量配置示例
- `server/init_db.py` - 数据库初始化脚本
- `server/DATABASE_SETUP.md` - 数据库设置说明文档

### 2. 前端改造

#### 修改的文件：
- `client/src/screens/LoginScreen.tsx` - 改为邮箱注册/登录界面
  - 支持邮箱注册（用户名可选）
  - 支持邮箱/用户名登录
  - 调用后端API进行认证
- `client/src/api/client.ts` - 添加认证相关API调用
  - `apiRegister()` - 注册API
  - `apiLogin()` - 登录API
  - `apiGetMe()` - 获取用户信息API
  - `apiEncode()` 和 `apiDecode()` 现在自动添加认证token
- `client/src/utils/storage.ts` - 添加token存储功能
  - `getAuthToken()` / `setAuthToken()` / `removeAuthToken()`
  - `getUserEmail()` / `setUserEmail()`
- `client/App.tsx` - 改为检查token判断登录状态

## 📋 数据库表结构

### users 表
- `id` (INT, 主键, 自增)
- `email` (VARCHAR(255), 唯一索引)
- `username` (VARCHAR(100), 可选)
- `password_hash` (VARCHAR(255))
- `short_id` (VARCHAR(7), 唯一索引)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

## 🔧 配置步骤

### 1. 安装依赖

```bash
cd server
pip install -r requirements.txt
```

### 2. 创建数据库

使用 Navicat 或 MySQL 命令行：

```sql
CREATE DATABASE stegacam_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 配置环境变量

在 `server` 目录下创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3308
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=stegacam_db
JWT_SECRET_KEY=your_secret_key_here_change_in_production
JWT_EXPIRE_MINUTES=10080
```

### 4. 初始化数据库

```bash
python server/init_db.py
```

或者直接启动服务器，表会自动创建。

### 5. 启动服务器

```bash
uvicorn server.app.server:app --host 0.0.0.0 --port 8080 --reload
```

## 🔐 安全特性

1. **密码安全**：使用 bcrypt 进行密码哈希，不存储明文密码
2. **JWT认证**：使用 JWT token 进行身份验证
3. **Token过期**：默认7天过期（可通过环境变量配置）
4. **邮箱唯一性**：数据库层面保证邮箱唯一
5. **Short ID唯一性**：注册时自动生成并检查唯一性

## 📡 API端点

### 公开端点
- `GET /api/v1/ping` - 健康检查
- `GET /api/v1/models` - 获取模型列表
- `POST /api/v1/auth/register` - 注册（需要邮箱和密码）
- `POST /api/v1/auth/login` - 登录（支持邮箱或用户名）

### 需要认证的端点
- `GET /api/v1/auth/me` - 获取当前用户信息
- `POST /api/v1/encode` - 编码图片（需要Bearer token）
- `POST /api/v1/decode` - 解码图片（需要Bearer token）

## 🎯 功能特性

1. **邮箱注册**：支持邮箱注册，用户名可选
2. **灵活登录**：支持邮箱或用户名登录
3. **自动认证**：前端API调用自动添加认证token
4. **Token管理**：token存储在安全存储中
5. **向后兼容**：保留原有的存储键，不影响现有功能

## ⚠️ 注意事项

1. **环境变量**：必须正确配置数据库连接信息
2. **JWT密钥**：生产环境必须修改 `JWT_SECRET_KEY`
3. **数据库权限**：确保数据库用户有创建表的权限
4. **端口配置**：默认使用3308端口，根据实际情况修改
5. **首次启动**：首次启动时会自动创建数据库表

## 🐛 故障排查

如果遇到问题，请检查：
1. MySQL服务是否运行
2. 数据库连接信息是否正确
3. 依赖是否全部安装
4. 环境变量是否配置正确
5. 查看服务器日志获取详细错误信息

## 📝 下一步建议

1. 添加邮箱验证功能（可选）
2. 添加密码重置功能（可选）
3. 添加用户资料管理功能（可选）
4. 添加操作日志记录（可选）

