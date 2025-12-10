## 项目测试指南（StegaCam）

本指南帮助测试人员快速启动后端与移动端客户端，并通过两种方式进行真机联调（Expo Go 与 Dev Client）。

### 1. 环境准备
- 操作系统：Windows 10/11
- 已安装 Anaconda（或 Miniconda）
- 已准备 Conda 环境：`stega-tf210`
- 已安装 Node.js（建议 LTS）与 npm
- 已安装 Expo CLI
  - 安装命令：
    ```bash
    npm i -g expo-cli
    ```
- 如需内网穿透，已在目标机器准备好 frp 客户端（`frpc`）及对应 `frpc.toml`。

### 2. 启动后端（FastAPI + Uvicorn）
在项目根目录 `image-process-model` 下：
```powershell
E:/Users/wzh26/Anaconda3/Scripts/activate
conda activate stega-tf210
uvicorn server.app.server:app --host 0.0.0.0 --port 8080
```
看到如下日志即表示成功运行：
```
INFO:     Application startup complete.
Uvicorn running on http://0.0.0.0:8080 (Press CTRL+C to quit)
```

备注：
- 服务默认监听 `8080` 端口。如需更换端口，请同步在客户端配置中更新后端地址。

### 3. 启动 frp（可选，用于外网访问）
如果需要通过云端/外网访问本地后端，请在本地运行 `frpc`：
```powershell
E:/Users/wzh26/Anaconda3/Scripts/activate
conda activate stega-tf210
cd E:\frp_0.64.0_windows_amd64\
frpc.exe -c frpc.toml
```
看到如下日志表示连接成功：
```
start frpc service for config file [frpc.toml]
login to server success
start proxy success
```

确保云端 `frps` 常驻运行，并已正确映射后端端口（例如将本地 8080 暴露为云端固定地址/端口）。

示例 `frpc.toml`（与你当前可用配置一致）：
```toml
# 云服务器公网 IP
serverAddr = "47.101.142.85"
# 连接到云服务器 frps 的端口（需与 frps.toml 保持一致）
serverPort = 7000

[auth]
method = "token"
token  = "thisisatoken"

[[proxies]]
name       = "ubuntu-frpc-8080"
type       = "tcp"
localIP    = "127.0.0.1"
localPort  = 8080
remotePort = 6100
```
说明：
- 上例将本地 `127.0.0.1:8080`（Uvicorn）映射到云端 `47.101.142.85:6100`。
- 该映射是明文 TCP 转发，不包含 TLS 证书终止，访问协议应为 `http://` 而非 `https://`（除非你在云端再加一层反向代理并配置证书）。

云端示例 `frps.toml`（服务端）：
```toml
# frps 监听端口
bindPort = 7000

[webServer]
addr     = "0.0.0.0"
port     = 7500
user     = "admin"
password = "admin"

[auth]
method = "token"
token  = "thisisatoken"
```
说明：
- 请确保云服务器安全组/防火墙放通 `7000/tcp`（FRP 服务）与 `7500/tcp`（FRP 面板，可选）以及被映射的对外端口 `6100/tcp`。
- `auth.token` 必须与客户端 `frpc.toml` 中保持一致。
- 如需 TLS/HTTPS，请在云端增加反向代理（例如 Nginx/Caddy）为 `remotePort`（如 6100）提供证书终止，之后客户端才可使用 `https://`。

### 4. 启动客户端（移动端 App）
进入客户端目录：
```powershell
cd .\client\
```

#### 4.1 使用 Development Build（推荐）
如果使用 `npx expo run:android` 构建的开发版本，需要使用局域网模式启动：

```powershell
npm run start:lan
```

或者直接使用：
```powershell
npx expo start --dev-client --host lan
```

**注意**：即使终端显示 `Metro waiting on http://localhost:8081`，如果使用了 `--host lan` 参数，Metro 实际上会监听所有网络接口（包括局域网 IP）。你可以在终端中查找类似 `Metro waiting on http://192.168.x.x:8081` 的信息，或者查看二维码下方的完整 URL。

#### 4.2 使用 Expo Go（快速测试）
如果使用 Expo Go 应用，使用标准启动：
```powershell
npm start
```

典型输出：
```
› Metro waiting on http://<your-ip>:8081
› Scan the QR code above to open the project in a development build
```

**重要提示：**
- **Development Build 连接问题**：Development Build 模式下，即使使用 `--host lan`，终端可能仍显示 `localhost:8081`，但应用需要手动配置调试主机地址。
  
  **解决方案（按优先级）：**
  
  1. **方法一：在 Development Build 应用中手动输入 IP（推荐）**
     - 启动服务器：`npm run start:lan`
     - 在手机上打开 Development Build 应用
     - 摇一摇设备或按菜单键打开开发菜单（Developer Menu）
     - 选择 "Configure Bundler" 或 "Enter URL manually"
     - 输入你的电脑 IP 地址和端口，例如：`192.168.3.193:8081`
     - 应用会重新连接到开发服务器
  
  2. **方法二：使用 PowerShell 脚本自动设置（需要 USB 连接）**
     ```powershell
     # 在 client 目录下运行
     cd .\client\
     .\set-debug-host.ps1
     
     # 或者指定自定义 IP 和端口
     .\set-debug-host.ps1 -HostIP 192.168.3.193 -Port 8081
     ```
     注意：需要手机通过 USB 连接并启用 USB 调试。
  
  3. **方法三：使用隧道模式（需要网络）**
     ```powershell
     npm run start:remote
     ```
     这会使用 Expo 的隧道服务，但需要网络连接。
  
  **其他注意事项：**
  - 确保手机和电脑在同一 WiFi 网络
  - 检查 Windows 防火墙是否阻止了 8081 端口
  - **验证连接**：在手机浏览器中访问 `http://<你的电脑IP>:8081`（例如 `http://192.168.3.193:8081`），如果能看到页面，说明网络连接正常
  - 如果使用 Expo Go，会自动识别局域网 IP，无需手动配置
- 若 `8081` 被占用，会提示切换到 `8082`，同意即可。

默认后端地址（客户端）：
- 代码默认指向 `http://47.101.142.85:6100`，涉及位置：
  - `client/App.tsx` 内 `ApiConfig.baseURL`
  - `client/src/utils/storage.ts` 默认值
  - `client/src/screens/SettingsScreen.tsx` 初始占位与校验
- 如需修改，可在 App 设置页中直接填写服务地址，或修改上述文件的默认值。

### 5. 常见问题

#### 5.1 Development Build 连接失败
**症状**：手机上显示 "Error loading app" - "Failed to connect to localhost/127.0.0.1:8081"

**原因**：应用尝试连接 `localhost`，但手机上的 localhost 指向手机本身，而不是开发机器。

**解决方案**：
1. 使用局域网模式启动：`npm run start:lan` 或 `npx expo start --dev-client --lan`
2. 确保手机和电脑在同一 WiFi 网络
3. 检查 Windows 防火墙：允许 Node.js 通过防火墙，或临时关闭防火墙测试
4. 如果使用 VPN，可能需要断开 VPN 或配置路由

#### 5.2 其他常见问题
- **端口占用**：如 Metro bundler 提示 `Port 8081 is being used by another process`，按提示切换端口（例如 `8082`）。
- **网络连接**：确保手机能访问到 `http://<PC局域网IP>:8081`（可在手机浏览器中测试）。
- **外网访问后端**：需确保 `frpc` 正常连接 `frps`，并已在手机侧客户端中使用外网可达的服务地址。
- **后端地址配置**：若客户端需要配置后端 URL，请在应用设置界面中填写，或修改 `client/src/utils/storage.ts` 中的默认值。

### 6. 目录结构（简要）
```
image-process-model/
├─ server/           # 后端（FastAPI / Uvicorn / 模型调用）
│  ├─ app/
│  ├─ encode_image.py
│  ├─ decode_image.py
│  └─ README.md
├─ client/           # 移动端（Expo / React Native）
│  ├─ src/
│  └─ README.md
└─ PRD_StegaCam_Integrated.md
```

### 7. 一键命令速查
- 后端启动：
  ```powershell
  E:/Users/wzh26/Anaconda3/Scripts/activate
  conda activate stega-tf210
  uvicorn server.app.server:app --host 0.0.0.0 --port 8080
  ```
- 本地 frp 启动：
  ```powershell
  E:/Users/wzh26/Anaconda3/Scripts/activate
  conda activate stega-tf210
  cd E:\frp_0.64.0_windows_amd64\
  frpc.exe -c frpc.toml
  ```
- 客户端（Development Build）：
  ```powershell
  cd .\client\
  npm install
  npm run start:lan
  ```
  
- 客户端（Expo Go）：
  ```powershell
  cd .\client\
  npm install
  npm start
  ```

### 8. 本地构建 Preview 版本（分发给同事）

**适用场景**：需要将应用分发给不在同一局域网的同事测试，无需连接开发服务器。

**前置要求**：
- Android：已安装 Android Studio 和 Android SDK（已配置 `ANDROID_HOME` 环境变量）
- 已运行过 `npx expo prebuild`（项目已有 `android` 目录）

---

## ⚠️ Windows 用户（推荐：纯本地构建）

**EAS Build 的本地构建（`eas build --local`）在 Windows 上不支持 Android**，仅支持 macOS/Linux。

Windows 用户请使用以下**纯本地构建方式**（最快）：

### 快速构建（Windows）

```powershell
cd .\client\
npm run build:android
```

或者手动执行：

```powershell
cd .\client\android
.\gradlew.bat assembleRelease
```

**构建完成后，APK 文件位于**：
```
client/android/app/build/outputs/apk/release/app-release.apk
```

**优点**：
- ✅ Windows 完全支持
- ✅ 本地构建，速度快（通常 2-5 分钟）
- ✅ 不需要云服务，不需要排队
- ✅ 不需要 EAS CLI

**注意事项**：
- 确保已安装 Android Studio 并配置好 Android SDK
- 确保 `ANDROID_HOME` 环境变量已设置
- 首次构建可能需要下载 Gradle 和依赖（约 5-10 分钟）
- 使用 debug keystore 签名（适合内部测试）

---

## macOS/Linux 用户

### 方案 1：纯本地构建（推荐，最快）

```bash
cd ./client/
npm run build:android
```

或手动执行：

```bash
cd ./client/android
./gradlew assembleRelease
```

### 方案 2：EAS 本地构建

```bash
cd ./client/
eas build --local --profile preview --platform android
```

**构建配置说明**：
- `--local`：本地构建，不使用云构建服务（避免排队）
- `--profile preview`：使用 preview 配置（独立运行，不依赖开发服务器）
- `--platform android/ios`：指定平台

---

## Preview 版本特点

- ✅ 独立运行，不需要连接开发服务器
- ✅ 包含所有代码和资源，可直接安装使用
- ✅ 适合分发给测试人员
- ✅ 仍可包含调试信息（便于排查问题）

## 分发方式

- 将生成的 APK 文件发送给同事
- 同事直接安装即可使用（Android 需要允许"安装未知来源应用"）
- 应用会使用默认的后端地址 `http://47.101.142.85:6100`，或可在设置中修改

## 常见问题

**Q: 构建失败，提示找不到 Android SDK？**  
A: 确保已安装 Android Studio，并设置 `ANDROID_HOME` 环境变量指向 SDK 目录（通常是 `C:\Users\<用户名>\AppData\Local\Android\Sdk`）

**Q: 构建很慢？**  
A: 首次构建需要下载 Gradle 和依赖，后续构建会快很多（通常 2-5 分钟）

**Q: 想要清理构建缓存？**  
A: 运行 `npm run build:android:clean` 或手动执行 `cd android && gradlew.bat clean assembleRelease`

**Q: 构建失败，提示 "Filename longer than 260 characters"？**  
A: 这是 Windows 路径长度限制问题。项目已配置为只构建 `arm64-v8a` 架构（覆盖大多数现代 Android 设备），避免此问题。如果需要构建所有架构，可以：
1. 启用 Windows 长路径支持（需要管理员权限）：运行 `New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force`，然后重启电脑
2. 或者将项目移动到更短的路径（如 `C:\proj\client`）

**Q: 执行 clean 任务时提示找不到 codegen 目录？**  
A: 这是 React Native 新架构的已知问题。项目已配置为跳过有问题的清理任务。如果仍然遇到问题，可以直接运行 `npm run build:android`（不先清理），Gradle 的增量构建会自动处理。

**Q: Dev 版本和 Preview 版本能在同一台手机上共存吗？**  
A: 可以！项目已配置为：
- **Dev 版本**（debug）：包名为 `com.stegacam.client.dev`，使用 `npm run build:android:dev` 构建
- **Preview 版本**（release）：包名为 `com.stegacam.client`，使用 `npm run build:android` 构建

两个版本可以同时安装在同一台手机上，方便调试和测试。

**Q: Preview 版本无法连接到服务器，右上角连接状态一直是红色？**  
A: 这通常是因为 Android 9 (API 28) 及以上版本默认不允许 HTTP 明文流量。项目已配置允许 HTTP 连接（因为服务器使用 `http://` 协议）。

如果仍然无法连接，请检查：
1. **重新构建 APK**：修复后需要重新构建才能生效，运行 `npm run build:android`
2. **服务器地址**：确保服务器地址正确（默认：`http://47.101.142.85:6100`）
3. **网络连接**：确保手机能访问互联网，且服务器正在运行
4. **防火墙/代理**：检查是否有防火墙或代理阻止了连接
5. **手机网络权限**：确保应用有网络访问权限（已在 AndroidManifest.xml 中配置）

**验证连接**：可以在手机浏览器中访问 `http://47.101.142.85:6100/api/v1/ping`，如果能看到 JSON 响应，说明网络连接正常。

如在使用过程中遇到无法定位的问题，请附带终端日志与手机侧截图反馈，便于快速定位与支持。 


