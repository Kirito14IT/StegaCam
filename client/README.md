# StegaCam 客户端

基于 Expo 的 React Native 跨平台应用，用于图像隐写水印的编码和解码。

## 功能特性

- 📷 **拍照编码**：使用相机拍摄照片并添加7位Short ID水印
- 🖼️ **图片解码**：从相册选择图片进行解码，显示隐藏的Short ID
- 📋 **任务队列**：类似Bigjpg的可视化任务列表，支持进度显示和批量操作
- ⚙️ **用户设置**：管理用户信息和模型选择

## 技术栈

- React Native (Expo SDK 51)
- TypeScript
- React Navigation (Bottom Tabs)
- Expo Camera
- Expo Media Library
- Expo File System
- Expo Secure Store

## 安装和运行

### 前置要求

- Node.js 18+
- npm 或 yarn
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode (Mac only)
- Android: Android Studio

### 安装依赖

```bash
cd client
npm install
```

### 启动开发服务器

```bash
npm start
```

然后：
- 按 `i` 在 iOS 模拟器中运行
- 按 `a` 在 Android 模拟器中运行
- 扫描二维码在真实设备上运行（需要安装 Expo Go 应用）

### 构建生产版本

```bash
# iOS
expo build:ios

# Android
expo build:android
```

## 项目结构

```
client/
├── src/
│   ├── api/           # API 客户端
│   ├── components/    # 可复用组件
│   ├── queue/         # 任务队列管理
│   ├── screens/       # 屏幕组件
│   └── utils/         # 工具函数
├── App.tsx            # 应用入口
├── package.json
└── app.json           # Expo 配置
```

## 配置

### 服务器地址

默认服务器地址在 `App.tsx` 中配置：

```typescript
const API_CONFIG = {
  baseURL: 'https://47.101.142.85:6100',
  timeoutMs: 30000,
};
```

如需修改，请编辑 `client/App.tsx`。

## 注意事项

1. **HTTPS证书**：如果服务器使用自签名证书，iOS可能需要配置ATS例外
2. **权限**：首次使用需要授予相机和相册权限
3. **Short ID**：首次登录会自动生成7位字母数字组合的Short ID

## 开发说明

- 任务队列采用单线程执行（客户端并发=1）
- PNG格式：编码结果必须以PNG格式保存，不能转换为JPEG
- 进度显示：上传阶段显示确定性进度，推理阶段显示不确定进度
