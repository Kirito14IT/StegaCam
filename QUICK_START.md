# 快速启动指南

## 问题说明

**关于二维码**：
- 二维码是由 **Expo开发服务器（前端）** 显示的，不是后端FastAPI服务器
- 后端服务器启动后不会显示二维码
- 需要单独启动前端Expo服务器才会显示二维码供手机扫码

## 一键启动（推荐）

### 方式一：只启动后端服务器

```powershell
# 确保在conda环境中
conda activate stega-tf210

# 运行启动脚本
.\start_dev.ps1
```

### 方式二：同时启动后端和前端

```powershell
# 确保在conda环境中
conda activate stega-tf210

# 运行启动脚本（带前端选项）
.\start_dev.ps1 -StartFrontend
```

## 分步启动

### 1. 启动后端服务器

```powershell
# 激活conda环境
conda activate stega-tf210

# 运行启动脚本
.\start_dev.ps1
```

后端服务器启动后：
- 服务器地址：http://localhost:8080
- API文档：http://localhost:8080/docs

### 2. 启动前端Expo服务器（显示二维码）

**打开新的终端窗口**：

```powershell
# 进入前端目录
cd client

# 启动Expo开发服务器
npm start
# 或
npx expo start
```

**Expo服务器启动后会显示**：
- 二维码（用于Expo Go扫码）
- Metro服务器地址（通常是 http://192.168.x.x:8081）
- 各种快捷键提示

**使用Expo Go扫码**：
1. 在手机上安装 Expo Go 应用
2. 打开 Expo Go
3. 扫描终端显示的二维码
4. 应用会自动加载

### 3. 启动frpc内网穿透（可选）

如果需要从外网访问后端服务器：

```powershell
cd frp_0.64.0_windows_amd64
.\frpc.exe -c frpc.toml
```

## 常见问题

### 1. 依赖缺失

如果提示 `ModuleNotFoundError`：

```powershell
conda activate stega-tf210
pip install sqlalchemy pymysql passlib[bcrypt] python-jose[cryptography] python-dotenv email-validator
```

### 2. 数据库连接失败

检查：
- MySQL服务是否运行
- `.env` 文件配置是否正确
- 端口是否为3308

### 3. 端口被占用

```powershell
# 查看占用8080端口的进程
Get-NetTCPConnection -LocalPort 8080 | Select-Object OwningProcess

# 终止进程
Stop-Process -Id <PID> -Force
```

### 4. 服务器启动失败

查看服务器日志：
```powershell
# 查看后台任务输出
Get-Job | Receive-Job
```

## 启动脚本参数

```powershell
# 基本启动
.\start_dev.ps1

# 同时启动前端
.\start_dev.ps1 -StartFrontend

# 跳过数据库检查
.\start_dev.ps1 -SkipDbCheck

# 自定义端口
.\start_dev.ps1 -ServerPort 8081
```

## 完整测试流程

1. **启动后端**（终端1）
   ```powershell
   conda activate stega-tf210
   .\start_dev.ps1
   ```

2. **启动前端**（终端2）
   ```powershell
   cd client
   npm start
   ```

3. **扫码测试**
   - 使用Expo Go扫描二维码
   - 或使用开发构建版本

4. **配置服务器地址**
   - 在应用设置中配置后端地址
   - 本地：`http://192.168.x.x:8080`
   - 外网：`http://47.101.142.85:6100`（如果启动了frpc）

## 注意事项

1. **conda环境**：确保在 `stega-tf210` 环境中运行
2. **数据库**：确保MySQL服务运行在3308端口
3. **防火墙**：确保8080和8081端口未被阻止
4. **网络**：手机和电脑需要在同一WiFi网络（局域网模式）

