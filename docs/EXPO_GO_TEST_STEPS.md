# Expo Go 测试步骤

本文档提供使用 Expo Go 进行完整测试的详细步骤。

## 前置条件

1. **环境准备**
   - Windows 10/11
   - 已安装 Node.js（LTS 版本）
   - 已安装 Expo CLI：`npm i -g expo-cli`
   - 已安装 Anaconda/Miniconda
   - 已准备 Conda 环境：`stega-tf210`
   - 手机已安装 Expo Go 应用（iOS/Android）

2. **网络要求**
   - 手机和电脑在同一 WiFi 网络（用于本地测试）
   - 或已配置 frp 内网穿透（用于外网测试）

## 步骤 1：启动后端服务

### 1.1 本地后端（局域网测试）

在项目根目录打开 PowerShell：

```powershell
# 激活 Conda 环境
E:/Users/wzh26/Anaconda3/Scripts/activate
conda activate stega-tf210

# 启动后端服务
uvicorn server.app.server:app --host 0.0.0.0 --port 8080
```

**验证后端启动成功**：
- 看到日志：`INFO:     Application startup complete.`
- 看到日志：`Uvicorn running on http://0.0.0.0:8080`
- 在浏览器访问 `http://localhost:8080/api/v1/ping`，应返回 `{"ok":true}`

**记录你的电脑 IP 地址**：
- 在 PowerShell 中运行：`ipconfig`
- 找到 "IPv4 地址"，例如：`192.168.3.193`
- 本地后端地址为：`http://192.168.3.193:8080`

### 1.2 外网后端（通过 frp，可选）

如果需要通过外网访问，先启动 frp 客户端：

```powershell
# 在另一个 PowerShell 窗口
E:/Users/wzh26/Anaconda3/Scripts/activate
conda activate stega-tf210
cd E:\frp_0.64.0_windows_amd64\
frpc.exe -c frpc.toml
```

看到 `login to server success` 和 `start proxy success` 表示连接成功。

外网后端地址为：`http://47.101.142.85:6100`（默认配置）

## 步骤 2：启动客户端（Expo Go）

### 2.1 进入客户端目录

```powershell
cd .\client\
```

### 2.2 安装依赖（首次运行）

```powershell
npm install
```

### 2.3 启动 Expo 开发服务器

```powershell
npm start
```

**预期输出**：
```
› Metro waiting on http://<your-ip>:8081
› Scan the QR code above to open the project in Expo Go
```

**重要提示**：
- 终端会显示二维码和 URL
- 如果显示 `localhost:8081`，Expo Go 会自动识别局域网 IP
- 确保手机和电脑在同一 WiFi 网络

### 2.4 在手机上打开应用

1. **iOS**：打开相机应用，扫描终端显示的二维码
2. **Android**：打开 Expo Go 应用，点击 "Scan QR code"，扫描终端显示的二维码

**如果连接失败**：
- 检查手机和电脑是否在同一 WiFi
- 检查 Windows 防火墙是否允许 Node.js 通过
- 在手机浏览器访问 `http://<你的电脑IP>:8081`，应能看到 Expo 页面
- 如果仍失败，尝试使用隧道模式：`npx expo start --tunnel`（需要网络）

## 步骤 3：配置后端地址

### 3.1 进入设置页面

应用启动后：
1. 首次启动会显示登录页面，输入用户名和 Short ID 后登录
2. 登录成功后，点击底部导航栏的 **"设置"** 标签

### 3.2 配置服务器地址

在设置页面找到 **"服务器地址"** 输入框：

**本地测试**（推荐）：
- 输入：`192.168.3.193:8080`（替换为你的电脑 IP）
- 或输入完整 URL：`http://192.168.3.193:8080`

**外网测试**：
- 输入：`47.101.142.85:6100`
- 或输入完整 URL：`http://47.101.142.85:6100`

点击 **"连接"** 按钮，等待连接测试完成。

**验证连接**：
- 如果连接成功，会显示 "连接成功" 提示
- 如果连接失败，会显示 "已保存" 提示（地址已保存，但联通性未确认）
- 查看应用顶部状态栏，应显示连接状态指示器

## 步骤 4：选择模型

在设置页面的 **"模型选择"** 部分：
- 选择 **"Stega"**（默认）
- 或选择 **"UpEca"**（如果已配置）

## 步骤 5：功能测试

### 5.1 编码测试（隐藏信息）

1. 进入 **"拍摄"** 标签页
2. 点击相机按钮拍摄照片，或从相册选择图片
3. 输入要隐藏的消息（最多 7 个字符，例如：`A1B2C3D`）
4. 点击 **"编码"** 按钮
5. 等待处理完成（查看任务队列状态）
6. 处理完成后，编码后的图片会保存到相册

**验证**：
- 任务队列应显示编码任务完成
- 相册中应有新的编码图片（通常命名为 `xxx_hidden.png`）

### 5.2 解码测试（提取信息）

1. 进入 **"解码列表"** 标签页
2. 点击 **"选择图片"** 按钮
3. 从相册选择刚才编码的图片（或任何包含隐藏信息的图片）
4. 等待处理完成
5. 查看解码结果

**验证**：
- 如果解码成功，应显示隐藏的消息（例如：`A1B2C3D`）
- 如果解码失败，会显示相应错误信息

### 5.3 切换模型测试

1. 返回 **"设置"** 页面
2. 切换到另一个模型（例如从 Stega 切换到 UpEca）
3. 重复编码/解码测试
4. 验证不同模型的行为是否正常

## 步骤 6：常见问题排查

### 6.1 后端连接失败

**症状**：设置页面显示连接失败，或编码/解码时提示网络错误

**排查步骤**：
1. 确认后端服务正在运行（步骤 1）
2. 在手机浏览器访问后端地址（例如：`http://192.168.3.193:8080/api/v1/ping`）
   - 如果无法访问，检查防火墙设置
   - 如果使用外网地址，确认 frp 已连接
3. 检查设置页面中的服务器地址是否正确
4. 尝试重新连接

### 6.2 Expo Go 无法连接开发服务器

**症状**：应用显示 "Unable to connect to Metro bundler"

**排查步骤**：
1. 确认 `npm start` 正在运行
2. 确认手机和电脑在同一 WiFi
3. 检查 Windows 防火墙是否允许 Node.js
4. 在手机浏览器访问 `http://<电脑IP>:8081`
5. 如果仍失败，尝试使用隧道模式：`npx expo start --tunnel`

### 6.3 编码/解码失败

**症状**：任务队列显示失败，或应用提示错误

**排查步骤**：
1. 检查后端日志，查看错误信息
2. 确认模型文件存在且完整：
   - `server/saved_models/stega/model/`（Stega 模型）
   - `server/saved_models/up_eca/model/`（UpEca 模型）
3. 确认选择的模型与后端配置一致
4. 检查图片格式和大小（建议使用 JPG/PNG，尺寸不超过 4000x4000）

### 6.4 模型加载失败

**症状**：后端日志显示模型加载错误

**排查步骤**：
1. 确认模型目录结构正确：
   ```
   server/saved_models/
   ├── stega/
   │   ├── model/          # SavedModel 文件
   │   └── tools/
   │       ├── encode_image.py
   │       └── decode_image.py
   └── up_eca/
       ├── model/          # SavedModel 文件
       └── tools/
           ├── encode_image.py
           └── decode_image.py
   ```
2. 确认 TensorFlow 版本正确（2.10.0）
3. 检查模型文件权限

## 步骤 7：完整测试流程示例

### 测试场景 1：本地 Stega 模型

1. 启动本地后端：`uvicorn server.app.server:app --host 0.0.0.0 --port 8080`
2. 启动 Expo：`cd client && npm start`
3. 在手机上用 Expo Go 扫描二维码
4. 配置服务器地址：`http://192.168.3.193:8080`（替换为你的 IP）
5. 选择模型：Stega
6. 拍摄照片，输入消息 `TEST123`，进行编码
7. 等待编码完成
8. 在解码列表中选择刚才编码的图片
9. 验证解码结果为 `TEST123`

### 测试场景 2：外网 UpEca 模型

1. 启动本地后端：`uvicorn server.app.server:app --host 0.0.0.0 --port 8080`
2. 启动 frp：`frpc.exe -c frpc.toml`
3. 启动 Expo：`cd client && npm start`
4. 在手机上用 Expo Go 扫描二维码
5. 配置服务器地址：`http://47.101.142.85:6100`
6. 选择模型：UpEca
7. 重复编码/解码测试

## 注意事项

1. **消息长度限制**：最多 7 个字符（56 位 + ECC）
2. **图片格式**：支持 JPG、PNG 等常见格式
3. **图片尺寸**：会自动调整到 400x400 进行处理
4. **模型切换**：切换模型后需要重新编码/解码，不同模型的编码结果不兼容
5. **网络要求**：本地测试需要手机和电脑在同一 WiFi；外网测试需要 frp 正常运行

## 快速命令参考

```powershell
# 后端启动（本地）
conda activate stega-tf210
uvicorn server.app.server:app --host 0.0.0.0 --port 8080

# 后端启动（外网，需要先启动 frp）
conda activate stega-tf210
cd E:\frp_0.64.0_windows_amd64\
frpc.exe -c frpc.toml

# 客户端启动（Expo Go）
cd .\client\
npm start

# 客户端启动（隧道模式，用于网络问题）
cd .\client\
npx expo start --tunnel
```

