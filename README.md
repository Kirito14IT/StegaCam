# 隐溯盾 (StegaCam)

隐溯盾是一款专为 iOS/Android 移动平台设计的智能图像版权与身份认证系统，它将深度学习隐写技术与高性能移动端图像处理能力完美结合。

## 项目简介

用户可通过拍照或选择相册图片，将个人ID以隐写水印的形式安全嵌入图像，实现"一图一身份"的可信绑定。嵌入后的水印肉眼不可见，却能在压缩、裁剪、模糊、90度增量旋转等多种干扰下稳定识别。系统还提供水印提取功能，可从任意带水印图像中精准提取用户ID，用于验证作者身份、追踪图像来源与防止侵权盗用，为数字内容的版权保护与可信传播提供技术支撑。

## 核心功能

- 📷 **图像编码**：将7位字母数字ID嵌入图像，生成带水印的图片
- 🔍 **图像解码**：从带水印图像中提取隐藏的ID信息
- 👤 **用户认证**：完整的用户注册、登录、邮箱验证系统
- 📱 **移动端应用**：React Native + Expo 跨平台应用
- 🚀 **高性能后端**：FastAPI + TensorFlow 深度学习模型服务
- 🔒 **安全可靠**：JWT认证、操作日志、密码加密

## 技术架构

### 后端服务 (`server/`)
- **框架**：FastAPI
- **深度学习**：TensorFlow 2.10.0
- **数据库**：MySQL + SQLAlchemy
- **认证**：JWT Token
- **模型支持**：StegaStamp、UP-ECA 等

### 移动端客户端 (`client/`)
- **框架**：React Native + Expo
- **语言**：TypeScript
- **导航**：React Navigation
- **功能**：相机拍照、图片选择、任务队列管理

## 快速开始

### 后端启动

```bash
# 1. 创建 Conda 环境
conda create -n stega-tf210 python=3.8 -y
conda activate stega-tf210

# 2. 安装依赖
pip install -r server/requirements.txt

# 3. 配置环境变量（创建 server/.env）
DB_HOST=localhost
DB_PORT=3308
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stegacam_db
JWT_SECRET_KEY=your_secret_key
JWT_EXPIRE_MINUTES=10080

# 4. 初始化数据库
python server/init_db.py

# 5. 启动服务器
uvicorn server.app.server:app --host 0.0.0.0 --port 8080
```

### 客户端启动

```bash
# 1. 进入客户端目录
cd client

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm start

# 或使用局域网模式（Development Build）
npm run start:lan
```

详细启动说明请参考 [QUICK_START.md](QUICK_START.md)

## 项目结构

```
image-process-model/
├── server/              # 后端服务
│   ├── app/            # FastAPI 应用
│   │   ├── server.py   # 主服务文件
│   │   ├── model_runner.py  # 模型运行器
│   │   ├── auth.py     # 认证模块
│   │   ├── models.py   # 数据库模型
│   │   └── ...
│   ├── saved_models/   # 深度学习模型（需单独下载）
│   ├── requirements.txt
│   └── README.md
├── client/             # 移动端应用
│   ├── src/
│   │   ├── screens/    # 页面组件
│   │   ├── components/ # UI组件
│   │   ├── api/        # API客户端
│   │   └── ...
│   ├── package.json
│   └── README.md
├── docs/               # 项目文档
└── README.md           # 本文件
```

## API 文档

启动后端服务后，访问 `http://localhost:8080/docs` 查看交互式 API 文档。

### 主要端点

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/encode` - 图片编码（需要认证）
- `POST /api/v1/decode` - 图片解码（需要认证）
- `GET /api/v1/models` - 获取可用模型列表

## 功能特性

### 已实现功能

- ✅ 用户注册、登录、JWT认证
- ✅ 邮箱验证码验证
- ✅ 密码重置功能
- ✅ 用户资料管理
- ✅ 图片编码/解码
- ✅ 操作日志记录
- ✅ 任务队列管理
- ✅ 多模型支持

详细功能列表请参考 [FEATURES_SUMMARY.md](FEATURES_SUMMARY.md)

## 开发说明

### 环境要求

- Python 3.8+
- Node.js 18+
- MySQL 5.7+
- Conda（推荐）

### 数据库设置

参考 [server/DATABASE_SETUP.md](server/DATABASE_SETUP.md)

### 测试步骤

参考 [TEST_STEPS.md](TEST_STEPS.md)

## 许可证

本项目采用 Apache-2.0 许可证。详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关文档

- [快速启动指南](QUICK_START.md)
- [功能总结](FEATURES_SUMMARY.md)
- [测试步骤](TEST_STEPS.md)
- [后端文档](server/README.md)
- [客户端文档](client/README.md)

## 注意事项

1. **模型文件**：`server/saved_models/` 目录包含大型模型文件，已通过 `.gitignore` 忽略，需要单独下载或训练
2. **环境变量**：请勿将 `.env` 文件提交到版本控制系统
3. **密钥文件**：Android keystore 文件已忽略，请妥善保管

## 正在集成

- 更强大的深度学习模型
- 更多功能特性
- 性能优化

---

**隐溯盾** - 为数字内容的版权保护与可信传播提供技术支撑

