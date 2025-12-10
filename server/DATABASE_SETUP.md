# 数据库设置说明

## 1. 创建数据库

使用 Navicat 或 MySQL 命令行创建数据库：

```sql
CREATE DATABASE stegacam_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. 配置环境变量

在 `server` 目录下创建 `.env` 文件（参考 `env.example`）：

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3308
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=stegacam_db

# JWT Configuration
JWT_SECRET_KEY=your_secret_key_here_change_in_production
JWT_EXPIRE_MINUTES=10080

# Model Configuration (optional)
# MODEL_DIR=server/saved_models/stega

# Debug (optional)
# DEBUG_SAVE=false
```

**重要提示：**
- `JWT_SECRET_KEY` 应该是一个随机生成的密钥，生产环境必须修改
- `DB_PASSWORD` 填写你的 MySQL 密码
- `DB_PORT` 默认是 3308（根据你的配置修改）

## 3. 安装依赖

```bash
pip install -r requirements.txt
```

## 4. 初始化数据库表

运行初始化脚本：

```bash
python server/init_db.py
```

或者直接启动服务器，表会在启动时自动创建（如果不存在）。

## 5. 验证

启动服务器后，可以通过以下方式验证：

1. 访问 `GET /api/v1/ping` 应该返回 `{"ok": true}`
2. 尝试注册新用户：`POST /api/v1/auth/register`
3. 尝试登录：`POST /api/v1/auth/login`

## 数据库表结构

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| email | VARCHAR(255) | 邮箱地址（唯一） |
| username | VARCHAR(100) | 用户名（可选） |
| password_hash | VARCHAR(255) | 密码哈希 |
| short_id | VARCHAR(7) | 唯一短ID（唯一） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

## 故障排查

### 连接失败

1. 检查 MySQL 服务是否运行
2. 检查端口号是否正确（默认 3308）
3. 检查用户名和密码是否正确
4. 检查数据库是否已创建

### 表创建失败

1. 确保数据库用户有 CREATE TABLE 权限
2. 检查数据库字符集是否为 utf8mb4

### 认证失败

1. 检查 JWT_SECRET_KEY 是否设置
2. 检查 token 是否过期（默认7天）

