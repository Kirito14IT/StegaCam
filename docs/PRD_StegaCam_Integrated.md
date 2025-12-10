# 产品需求文档（PRD）：ImageProcess 客户端 + 推理后端（基于隐写模型）
> 版本：v0.2（MVP）
> 日期：2025-11-07
> 状态：在研（可执行）
> 作者：Krico

---

## 1. 项目概述（Overview）
- 愿景：提供“移动端瘦客户端 + 家庭/本地推理后端”的隐写水印能力，支持拍摄或选图进行 7 字符密文的无感写入与读取。
- 目标用户：内测用户，具备访问特定私有服务器/内网穿透通道权限。
- MVP 目标：
  - 跑通“移动端采集 → FRP 内网穿透 → 本地服务器推理 → 返回结果”的全链路。
  - 本地生成并持有固定 7 位 Short ID（字母数字混合），用作嵌入消息与轻量身份标识。
  - 不引入复杂云端账号系统；以可用性和稳定性优先。

术语说明：
- Short ID（7-char）：长度固定为 7 的字母/数字字符串，用作嵌入与识别。为避免与标准 UUID（32 位十六进制）混淆，文档不使用“UUID”。

仓库对齐说明：
- 编码脚本 `server/encode_image.py` 将 7 字符秘文写入 400×400 RGB 图；解码脚本 `server/decode_image.py` 负责读取密文。
- 模型以 TensorFlow SavedModel 形式存放于 `server/saved_models/`（每个子目录代表一次不可变导出）。
- 临时产物写入 `server/tmp/`；示例资产位于 `server/test/`（如 `server/test/test.jpg`）。
- 当前不修改模型核心逻辑，仅按现有流程将图片规范化到 400×400 后进行编解码。

---

## 2. 系统架构（Architecture）
- Client：React Native（Expo Managed）。
- API Gateway（云）：`47.101.142.85:6100`（HTTPS 优先）。
- Tunnel：FRPS（云） ↔ FRPC（本地 PC）。
- Backend Service（本地）：家庭 PC 上的 Web 服务，封装本仓库脚本进行推理。

模型 I/O 与预处理（来自脚本与 SavedModel 签名）：
- 编码：inputs=`secret`（BCH 后比特向量）、`image`（归一化 400×400×3）；outputs=`stegastamp`、`residual`。
- 解码：input=`image`（归一化 400×400×3）；output=`decoded`（含 BCH 冗余的比特向量）。
- 预处理：`ImageOps.fit(..., (400,400))`，再除以 255.0 归一化。
- 秘文长度：最多 7 个字符（56bit），空格右填充至 7 位，使用 BCH(137, t=5) 编码，拼接形成 96 比特用于推理。

---

## 3. 功能需求（Functional Requirements）

### 3.0 本地引导与认证（客户端）
- 首次启动：录入用户名与本地解锁密码（P1 可选），生成 7 位 Short ID 并存入安全存储（Expo SecureStore）。
- 非首次启动：可选要求输入本地密码解锁。

### 3.1 客户端 Tab 导航
- Tab 1：拍照（Capture & Encode）
  - MVP（简化）：拍摄 → 读取 Short ID → 全屏 Loading → `POST /api/v1/encode` → 返回隐写图 → 保存相册 → Toast 成功。
  - 异常：>30s 超时/网络错误 → 取消 Loading，提示重试。
  - P1（推荐）：拍照任务加入“全局任务队列”，取景立即恢复；角标/小圆环显示后台处理与队列数量；完成后自动保存并 Toast。
- Tab 2：选择（Select & Decode）
  - 从相册选图 → Loading → `POST /api/v1/decode` → 返回结果 → 大号字体显示 Short ID。
- Tab 3：设置（Settings）
  - 显示用户名与 Short ID（可复制）。
  - 模型选择（显示“默认 Stega V1”，MVP 固定）。
  - 调试信息（开发版可见）：服务器地址、Ping 按钮。

#### 3.1.1 解码列表（借鉴 Bigjpg 交互）
- 入口：Tab 2 顶部“选择图片”，支持多选（不支持多选的平台则多次追加）。
- 任务卡片包含：缩略图、文件名、大小/分辨率、进度条、状态与操作按钮。
- 状态与操作：
  - PENDING（灰）：开始 / 删除
  - QUEUED（蓝）：显示排队序号；取消排队 / 删除
  - PROCESSING（绿）：上传显示百分比；推理阶段显示不确定进度；取消
  - SUCCESS（绿实线）：展示 Short ID；复制结果 / 详情 / 删除
  - FAILED（红）：显示“未能解析/网络超时”等；重试 / 删除
- 列表工具条：开始全部 / 暂停全部 / 清理已完成。
- 规则：客户端本地 FIFO，强制同一时刻仅 1 个解码请求在飞；上传显示确定性进度，推理阶段显示不确定进度；失败重试采用 1s/3s/5s 指数退避（最多 3 次）。

#### 3.1.2 拍照加密异步队列（可选）
- 目标：提升连拍体验，避免全屏 Loading 阻塞。
- 行为：拍照后立即将 `ENCODE` 任务加入全局队列；角标显示数量与进度；完成后自动保存相册并 Toast。
- 资源限制：客户端并发=1（与后端一致），其余任务排队；队列超过阈值（如 20）提示“队列已满，请稍后”。

### 3.2 后端服务（封装本仓库脚本）
- 启动参数：
  - 模型目录：`server/saved_models/<model_dir>`（从环境变量或配置读取）
  - 端口：`8080`
  - 模式：`debug`（是否将 `_raw/_hidden/_residual` 落盘到 `server/tmp/`）
- 行为：
  - `/api/v1/encode`：接收图片与 7 位 `message`，返回隐写图（PNG-only）。
  - `/api/v1/decode`：接收图片，返回 JSON：`{"success":true,"data":{"message":"XXXXXXX"}}`。
  - `/api/v1/ping`：健康检查；`/api/v1/models`（可选）列举 `server/saved_models/` 子目录。
- 校验与限制：
  - `message` 长度必须=7，推荐字符集 `[A-Za-z0-9]`。
  - 图片最大边长默认 ≤4096；超限拒绝或压缩后处理。
- 资源与并发管理：
  - 模型常驻内存（禁止每请求加载）。
  - 统一缩放至 400×400；GPU 优先，CPU 回退。
  - 单线程任务队列（全局锁）：同一时间仅处理 1 个推理请求；队列满返回 503/429。

---

## 4. 非功能需求（Non-functional）
- 性能：客户端上传前压缩（JPEG 质量 ~0.8，分辨率 ≤2048 边）；服务端仅返回 PNG；端到端 3–8s（视网络）。
- 可靠性：30s 超时保护；失败重试（幂等）。
- 安全：Short ID/本地口令存储于设备安全区域；服务端不持久化图片/秘文（除 debug）。
- 兼容：iOS 15+ / Android 10+。
- 可运维：结构化日志、基本指标（QPS/延时/错误率）、健康检查与自启脚本。
- 数据完整性：编码结果必须以 PNG 保存与传输；客户端严禁转存为 JPEG（有损）。

---

## 5. API 合同（Draft）
MVP 必选：`/api/v1/encode`、`/api/v1/decode`、`/api/v1/ping`；`/api/v1/models` 可选。

### 5.1 加密图片
- URL：`POST /api/v1/encode`
- Content-Type：`multipart/form-data`
- Body：
  - `image`（File）原始图片
  - `message`（String）7 位 Short ID（长度=7）
  - `model`（String，可选）默认后端配置
- 成功（200）：返回隐写图片二进制（`image/png`）
- 失败示例：`{"success":false,"error":"message must be 7 chars"}`

### 5.2 解密图片
- URL：`POST /api/v1/decode`
- Content-Type：`multipart/form-data`
- Body：
  - `image`（File）待解码图片
- 成功（200）：
  ```json
  {
    "success": true,
    "data": { "message": "A1B9Y7X", "model_used": "stega_v1" }
  }
  ```
- 失败（200/4xx）：`{"success":false,"error":"未能解析出有效水印信息"}`

---

## 6. 端到端数据流（E2E）
1) 客户端采集/选图
2) 客户端压缩并发起 API 请求
3) 服务端预处理到 400×400 → 调用模型
4) 编码：返回 PNG
5) 解码：BCH 纠错 → 返回 7 位字符串
6) 客户端展示与保存

---

## 7. 环境与部署（Env & Deploy）
### 7.1 后端运行时
- Python 3.8+
- 依赖见 `requirements-portable-tf210.txt`（TF 2.10 GPU 优先）
- 建议 venv：`python -m venv .venv && .venv\\Scripts\\pip install -r requirements-portable-tf210.txt`

### 7.2 模型目录
- 将导出的 SavedModel 放置到 `server/saved_models/<model_dir>`；服务端启动时加载。

### 7.3 FRP 穿透
- 云端 FRPS 暴露 `6100`；本地 FRPC 映射 `localhost:8080`；HTTPS 证书优先。

---

## 8. 测试与验收（Testing & Acceptance）
### 8.1 脚本级（本仓库）
- 单图编码（产物 `server/tmp/`）：
  - `python server/encode_image.py server/saved_models/<model_dir> --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`
- 解码回读：
  - `python server/decode_image.py server/saved_models/<model_dir> --image server/tmp/test_hidden.png`

### 8.2 API 级
- `curl -F "image=@server/test/test.jpg" -F "message=A1B2C3D" https://47.101.142.85:6100/api/v1/encode > out.png`
- `curl -F "image=@out.png" https://47.101.142.85:6100/api/v1/decode`
- 期望：解码出的 `message` 与输入一致（区分大小写）。
- 注意：`out.png` 不得转为 JPEG。

### 8.3 客户端级（含 Bigjpg 风格列表）
- 多选 5 张图 → 生成 5 个任务，FIFO 串行；上传阶段 0–100%；推理阶段不确定进度；成功可复制 Short ID；失败可重试；“清理已完成”仅保留未处理任务。
- 拍照异步队列（P1）：连拍 3 次不阻塞；角标从 0→3；同一时间仅 1 个在飞；完成后自动保存相册并 Toast；队列满提示。

---

## 9. 错误码与异常处理（Errors）
- 400：`message must be 7 chars` / `invalid image` / `model not found`
- 408/504：`upstream timeout`（模型执行超时）
- 500：`internal error`
- 503/429：`server busy`（队列已满或推理锁占用）
- 响应头透出 `X-Request-ID` 便于排障。

---

## 10. 安全与合规（Security）
- 存储：客户端使用安全存储保存 Short ID/口令；后端不持久化图片与秘文（除 debug）。
- 传输：HTTPS/TLS；HTTP 仅限内测并有显式提示。
- 访问控制（MVP）：可选固定 Token 或 `X-Client-ID`；后续支持 JWT/OAuth。

---

## 11. 运营与可观测性（Ops）
- 结构化日志：请求入参（脱敏）、用时、错误；关键步骤埋点（预处理/推理/后处理）。
- 指标：QPS、P50/P95、错误率、GPU 利用率（如可用）。
- 健康检查：`/api/v1/ping`；本地进程守护与自启。

---

## 12. 风险与待确认（Risks & TBD）
1) [High] 证书/HTTPS 与 iOS ATS 例外策略。
2) [Medium] 家宽上行影响体验 → 客户端压缩与分辨率上限策略。
3) [Medium] 模型签名差异 → 确认 SavedModel I/O 名称与脚本一致。
4) [Low] 并发与内存 → 单线程推理队列、队列长度与拒绝策略验证。
5) [Low] 图片格式 → MVP 强制 PNG；评估抗 JPEG 能力后再开放。

---

## 13. 里程碑（Milestones）
- M0：后端包装层原型（FastAPI/Flask），本地端到端打通。
- M1：FRP 打通 + 客户端 MVP（拍照/选图/展示）。
- M2：可观测性与稳定性（日志、健康检查、简易鉴权）。
- M3：体验优化（进度与重试、图片压缩策略、解码反馈）。

---

## 14. 附录（Appendix）
### 14.1 仓库脚本与常量
- 编码脚本：`server/encode_image.py`（BCH_POLYNOMIAL=137、BCH_BITS=5）
- 解码脚本：`server/decode_image.py`（同上）

### 14.2 后端封装建议（示例）
- 语言：Python 3.8+；框架：FastAPI；推理线程池 1–2；模型单例常驻。
- 路径：`MODEL_DIR=server/saved_models/<model_dir>`；启动即加载。
- Debug：`DEBUG_SAVE=true` 时，将中间产物落盘到 `server/tmp/`。
- 并发：全局互斥 + FIFO 队列（单消费者）；队列长度与等待超时可配置。

