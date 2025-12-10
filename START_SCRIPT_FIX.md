# 启动脚本修复说明

## 问题分析

### 原始问题
1. **依赖缺失**：`stega-tf210` conda环境中缺少 `sqlalchemy` 等依赖
2. **环境检测**：脚本没有正确检测和使用conda环境
3. **服务器启动失败**：由于依赖问题导致服务器无法启动

### 已修复的问题
1. ✅ 添加了conda环境检测
2. ✅ 添加了依赖检查功能
3. ✅ 改进了错误处理和日志输出
4. ✅ 添加了前端启动选项
5. ✅ 安装了缺失的依赖

## 修复内容

### 1. 依赖安装
已在 `stega-tf210` 环境中安装：
- sqlalchemy
- pymysql
- passlib[bcrypt]
- python-jose[cryptography]
- python-dotenv
- email-validator

### 2. 启动脚本改进
- 自动检测conda环境
- 检查Python依赖
- 更好的错误提示
- 支持前端启动选项

### 3. 关于二维码
**重要说明**：
- 二维码是由 **Expo开发服务器（前端）** 显示的
- 后端FastAPI服务器不会显示二维码
- 需要单独启动前端才会显示二维码

## 使用方法

### 方式一：只启动后端（推荐）

```powershell
# 1. 激活conda环境
conda activate stega-tf210

# 2. 运行启动脚本
.\start_dev.ps1
```

### 方式二：同时启动后端和前端

```powershell
# 1. 激活conda环境
conda activate stega-tf210

# 2. 运行启动脚本（带前端选项）
.\start_dev.ps1 -StartFrontend
```

### 方式三：分步启动（推荐用于调试）

**终端1 - 后端服务器**：
```powershell
conda activate stega-tf210
.\start_dev.ps1
```

**终端2 - 前端Expo服务器（显示二维码）**：
```powershell
cd client
npm start
```

## 验证启动成功

### 后端服务器
1. 访问 http://localhost:8080/docs 查看API文档
2. 访问 http://localhost:8080/api/v1/ping 应返回 `{"ok": true}`

### 前端服务器
1. 运行 `npm start` 后会显示二维码
2. 使用Expo Go应用扫描二维码
3. 应用会自动加载

## 常见问题

### Q1: 提示缺少依赖
**解决**：
```powershell
conda activate stega-tf210
pip install sqlalchemy pymysql passlib[bcrypt] python-jose[cryptography] python-dotenv email-validator
```

### Q2: 数据库连接失败
**检查**：
1. MySQL服务是否运行：`Get-Service -Name "MySQL*"`
2. `.env` 文件配置是否正确
3. 端口是否为3308

### Q3: 服务器启动失败
**调试**：
```powershell
conda activate stega-tf210
python -m uvicorn server.app.server:app --host 0.0.0.0 --port 8080 --reload
```
查看详细错误信息

### Q4: 看不到二维码
**说明**：
- 后端服务器不会显示二维码
- 需要启动前端Expo服务器：`cd client && npm start`
- 二维码会在Expo服务器终端显示

## 完整测试流程

1. **准备环境**
   ```powershell
   conda activate stega-tf210
   ```

2. **启动后端**（终端1）
   ```powershell
   .\start_dev.ps1
   ```
   等待看到：`FastAPI服务器已启动: http://localhost:8080`

3. **启动前端**（终端2，新窗口）
   ```powershell
   cd client
   npm start
   ```
   等待看到二维码和Metro服务器地址

4. **扫码测试**
   - 使用Expo Go扫描二维码
   - 或使用开发构建版本

5. **配置服务器地址**（在应用中）
   - 本地：`http://192.168.x.x:8080`（替换为你的电脑IP）
   - 外网：`http://47.101.142.85:6100`（如果启动了frpc）

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

## 注意事项

1. **必须在conda环境中运行**：`conda activate stega-tf210`
2. **依赖已安装**：所有必要的Python依赖已在 `stega-tf210` 环境中安装
3. **二维码位置**：二维码由前端Expo服务器显示，不是后端
4. **网络要求**：手机和电脑需要在同一WiFi（局域网模式）

## 下一步

现在可以运行 `.\start_dev.ps1` 启动后端服务器了！

如果需要扫码测试，请在新终端运行：
```powershell
cd client
npm start
```

