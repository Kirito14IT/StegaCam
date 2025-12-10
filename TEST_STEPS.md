# StegaCam 完整测试步骤

## 前置准备

### 1. 环境要求
- Python 3.8+
- MySQL 5.7+ (运行在3308端口)
- Node.js 和 npm (用于前端)
- PowerShell 5.0+ (用于启动脚本)

### 2. 数据库配置
确保 `server/.env` 文件已正确配置：
```env
DB_HOST=localhost
DB_PORT=3308
DB_USER=root
DB_PASSWORD=123456
DB_NAME=stegacam_db
JWT_SECRET_KEY=your_secret_key
```

### 3. 安装依赖

**后端依赖：**
```bash
cd server
pip install -r requirements.txt
```

**前端依赖：**
```bash
cd client
npm install
```

## 一键启动（推荐）

### Windows PowerShell
```powershell
.\start_dev.ps1
```

脚本会自动：
1. 检查端口占用（8080）
2. 检查并启动MySQL服务
3. 检查数据库连接
4. 初始化数据库表
5. 启动FastAPI服务器
6. 启动frpc内网穿透（如果配置存在）

## 手动启动步骤

### 1. 启动MySQL数据库

**方式一：使用服务**
```powershell
# 检查MySQL服务状态
Get-Service -Name "MySQL*"

# 启动MySQL服务（如果未运行）
Start-Service -Name "MySQL80"  # 根据实际服务名调整
```

**方式二：使用Navicat**
- 打开Navicat
- 连接到本地MySQL（端口3308）
- 确保 `stegacam_db` 数据库存在

### 2. 初始化数据库表
```bash
cd E:\github\trae_projects\image-process-model
python server/init_db.py
```

### 3. 启动后端服务器

**开发模式（自动重载）：**
```bash
cd E:\github\trae_projects\image-process-model
uvicorn server.app.server:app --host 0.0.0.0 --port 8080 --reload
```

**生产模式：**
```bash
uvicorn server.app.server:app --host 0.0.0.0 --port 8080
```

服务器启动后：
- API地址：http://localhost:8080
- API文档：http://localhost:8080/docs
- 健康检查：http://localhost:8080/api/v1/ping

### 4. 启动frpc内网穿透（可选）

如果需要从外网访问，启动frpc：
```bash
cd frp_0.64.0_windows_amd64
.\frpc.exe -c frpc.toml
```

### 5. 启动前端应用

**Expo开发模式：**
```bash
cd client
npm start
# 或
npx expo start
```

然后：
- 扫描二维码（使用Expo Go应用）
- 或按 `w` 在Web浏览器中打开
- 或按 `a` 在Android模拟器中打开
- 或按 `i` 在iOS模拟器中打开

## 功能测试步骤

### 1. 测试健康检查
```bash
curl http://localhost:8080/api/v1/ping
```
预期响应：`{"ok": true}`

### 2. 测试用户注册

**API调用：**
```bash
curl -X POST "http://localhost:8080/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "123456"
  }'
```

**预期响应：**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "username": "testuser",
    "short_id": "AbC1234"
  }
}
```

### 3. 测试用户登录

**API调用：**
```bash
curl -X POST "http://localhost:8080/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email_or_username": "test@example.com",
    "password": "123456"
  }'
```

### 4. 测试邮箱验证

**发送验证码：**
```bash
curl -X POST "http://localhost:8080/api/v1/auth/send-verification-code" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**验证邮箱：**
```bash
curl -X POST "http://localhost:8080/api/v1/auth/verify-email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456"
  }'
```

> 注意：如果没有配置SMTP，验证码会在控制台输出（开发模式）

### 5. 测试密码重置

**请求重置：**
```bash
curl -X POST "http://localhost:8080/api/v1/auth/request-password-reset" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**重置密码：**
```bash
curl -X POST "http://localhost:8080/api/v1/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456",
    "new_password": "newpass123"
  }'
```

### 6. 测试用户资料管理

**获取用户信息：**
```bash
curl -X GET "http://localhost:8080/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**更新资料：**
```bash
curl -X PUT "http://localhost:8080/api/v1/auth/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "newname"}'
```

**修改密码：**
```bash
curl -X POST "http://localhost:8080/api/v1/auth/change-password" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "123456",
    "new_password": "newpass123"
  }'
```

### 7. 测试图片编码（需要认证）

```bash
curl -X POST "http://localhost:8080/api/v1/encode" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@test.jpg" \
  -F "message=AbC1234" \
  -F "model=stega" \
  -o encoded.png
```

### 8. 测试图片解码（需要认证）

```bash
curl -X POST "http://localhost:8080/api/v1/decode" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@encoded.png" \
  -F "model=stega"
```

## 前端测试步骤

### 1. 注册新用户
1. 打开应用
2. 输入邮箱、用户名（可选）、密码
3. 点击"注册并开始使用"
4. 记录返回的Short ID

### 2. 登录
1. 如果已注册，切换到"登录"模式
2. 输入邮箱/用户名和密码
3. 点击"登录"

### 3. 邮箱验证（可选）
1. 登录后，调用发送验证码API
2. 检查邮箱或控制台获取验证码
3. 调用验证接口完成验证

### 4. 使用编码功能
1. 进入拍照界面
2. 拍摄或选择图片
3. 系统自动使用用户的Short ID进行编码
4. 保存编码后的图片

### 5. 使用解码功能
1. 进入解码列表
2. 选择包含水印的图片
3. 查看解码结果

## 常见问题排查

### 端口被占用
```powershell
# 查看占用8080端口的进程
Get-NetTCPConnection -LocalPort 8080 | Select-Object OwningProcess

# 终止进程
Stop-Process -Id <PID> -Force
```

### 数据库连接失败
1. 检查MySQL服务是否运行
2. 检查 `.env` 文件配置
3. 检查端口是否为3308
4. 检查数据库 `stegacam_db` 是否存在

### 验证码未收到
- 开发模式下，验证码会在服务器控制台输出
- 生产环境需要配置SMTP设置

### Token过期
- 默认Token有效期为7天
- 可以通过 `JWT_EXPIRE_MINUTES` 环境变量调整

## 查看操作日志

```sql
-- 查看所有操作日志
SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 100;

-- 查看特定用户的操作
SELECT * FROM operation_logs WHERE user_id = 1 ORDER BY created_at DESC;

-- 查看特定操作类型
SELECT * FROM operation_logs WHERE operation_type = 'encode' ORDER BY created_at DESC;
```

## 性能监控

### 检查服务器状态
- 访问 http://localhost:8080/docs 查看API文档
- 检查服务器日志输出

### 数据库监控
```sql
-- 查看用户数量
SELECT COUNT(*) FROM users;

-- 查看已验证邮箱的用户
SELECT COUNT(*) FROM users WHERE email_verified = 1;

-- 查看最近的验证码
SELECT * FROM verification_codes ORDER BY created_at DESC LIMIT 10;
```

## 完整测试流程示例

1. **启动所有服务**
   ```powershell
   .\start_dev.ps1
   ```

2. **前端扫码连接**
   - 启动Expo应用
   - 扫描二维码
   - 输入服务器地址（如果使用frpc，使用外网地址）

3. **注册账号**
   - 在应用中注册新账号
   - 记录Short ID

4. **测试编码**
   - 拍摄一张照片
   - 等待编码完成
   - 保存编码后的图片

5. **测试解码**
   - 选择刚才编码的图片
   - 查看解码结果
   - 验证Short ID是否正确

6. **测试其他功能**
   - 邮箱验证
   - 密码重置
   - 资料更新

## 注意事项

1. **开发模式**：验证码会在控制台输出，无需配置SMTP
2. **生产环境**：必须配置SMTP邮箱服务
3. **Token安全**：生产环境必须修改JWT_SECRET_KEY
4. **数据库备份**：定期备份数据库
5. **日志清理**：定期清理过期的操作日志和验证码

