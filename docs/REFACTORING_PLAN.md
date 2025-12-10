# 项目重构实施方案：多模型支持架构

## ⚠️ 重要架构澄清

### 架构理解说明

**❌ 错误理解**：
- 需要启动两个后端服务，每个运行在不同端口
- 需要配置两个内网穿透端口
- 前端通过连接不同端口来选择模型

**✅ 正确架构**：
- **只需要一个后端服务**，运行在**一个端口**（如 8080）
- **只需要一个内网穿透配置**，指向一个本地端口
- 后端内部通过 `ModelManager` 统一管理多个模型
- 前端通过 API 请求中的 `model` 参数来选择使用哪个模型
- **frpc.toml 配置不需要修改**，保持原有配置即可

### 工作流程示例

1. **后端启动**：
   ```bash
   # 只需要一个终端，一个命令
   uvicorn server.app.server:app --host 0.0.0.0 --port 8080
   ```

2. **内网穿透配置**（frpc.toml）：
   ```toml
   # 保持原有配置不变，只需要一个端口映射
   [[proxies]]
   name = "ubuntu-frpc-8080"
   type = "tcp"
   localIP = "127.0.0.1"
   localPort = 8080      # 后端服务端口
   remotePort = 6100     # 公网端口
   ```

3. **前端选择模型**：
   - 前端调用 `POST /api/v1/encode` 时，在 FormData 中添加 `model=stega` 或 `model=upeca`
   - 后端根据 `model` 参数，内部切换到对应的模型适配器
   - **不需要切换端口，不需要多个服务**

### 模型切换机制

```
前端请求 → 同一个 API 端点 → 后端 ModelManager → 根据 model 参数选择适配器
   ↓              ↓                    ↓
POST /api/v1/encode?model=stega  →  TF1Adapter (stega)
POST /api/v1/encode?model=upeca  →  TF2Adapter (upeca)
```

**总结**：这是一个**软件层面的模型切换**，不是**基础设施层面的端口切换**。

---

## 一、现状分析

### 1.1 现有项目结构
- **后端**：FastAPI + TensorFlow 1.x 模型运行器
  - `server/app/server.py` - API 端点（已支持可选 `model` 参数）
  - `server/app/model_runner.py` - 仅支持 TF 1.x SavedModel 格式
  - `server/saved_models/stega/` - 旧模型（TF 1.x）

### 1.2 新模型特点（upeca）
- **TensorFlow 版本**：TF 2.x
- **加载方式**：`tf.saved_model.load()` 直接加载
- **接口方式**：函数式接口 `model.hide()` 和 `model.reveal()`
- **输入输出格式**：
  - 编码：`hide(secret=tensor, image=tensor)` → `{'stega': ..., 'residual': ...}`
  - 解码：`reveal(image=tensor)` → `{'decoded': tensor}` (需要 sigmoid + round)

### 1.3 关键差异点
| 特性 | stega (旧) | upeca (新) |
|------|-------------|-------------|
| TF 版本 | 1.x | 2.x |
| 加载方式 | `tf.compat.v1.saved_model.loader.load` | `tf.saved_model.load` |
| 接口类型 | SignatureDef (tensor 名称) | 函数式接口 |
| 输入格式 | `[secret_bits]`, `[image]` | `secret=tensor`, `image=tensor` |
| 输出格式 | `stegastamp`, `residual` | `{'stega': ..., 'residual': ...}` |
| 解码后处理 | 直接使用 | 需要 `sigmoid` + `round` |

### 1.4 前端现状
- 已有模型选择 UI（SettingsScreen），但硬编码模型名称
- API 调用未传递 `model` 参数
- 需要从后端动态获取模型列表

---

## 二、重构目标

1. **模块化设计**：支持多种模型类型（TF 1.x、TF 2.x 等）
2. **可扩展性**：新增模型只需添加适配器，无需修改核心代码
3. **向后兼容**：保持现有 API 接口不变
4. **前后端配合**：前端动态获取模型列表，支持模型选择

---

## 三、详细实施方案

### 3.1 后端架构设计

#### 3.1.1 模型适配器模式（Adapter Pattern）

创建统一的模型接口，不同模型类型实现各自的适配器：

```
server/app/models/
├── __init__.py
├── base.py              # 抽象基类 BaseModelAdapter
├── tf1_adapter.py      # TF 1.x 模型适配器（stega）
├── tf2_adapter.py      # TF 2.x 模型适配器（upeca）
└── registry.py         # 模型注册与发现机制
```

**BaseModelAdapter 接口**：
```python
class BaseModelAdapter:
    def load(self, model_dir: Path) -> None
    def encode(self, pil_img: Image.Image, secret_str: str) -> Tuple[Image.Image, Image.Image, Image.Image]
    def decode(self, pil_img: Image.Image) -> Optional[str]
    def get_model_info(self) -> dict
```

#### 3.1.2 模型注册机制

每个模型文件夹包含 `model_config.json` 用于标识模型类型：

```json
{
  "model_type": "tf1",  // 或 "tf2"
  "model_name": "stega",
  "display_name": "Stega V1",
  "description": "原始隐写模型",
  "input_size": [400, 400],
  "secret_length": 7,
  "model_path": "model"
}
```

**模型发现流程**：
1. 扫描 `server/saved_models/` 目录
2. 查找每个子目录的 `model_config.json`
3. 根据 `model_type` 选择对应的适配器
4. 注册到模型管理器

#### 3.1.3 模型管理器（ModelManager）

统一管理所有模型实例，支持按需加载：

```python
class ModelManager:
    def __init__(self)
    def register_model(self, model_name: str, adapter: BaseModelAdapter)
    def get_model(self, model_name: str) -> BaseModelAdapter
    def list_models(self) -> List[dict]
    def load_model(self, model_name: str) -> None
```

#### 3.1.4 具体适配器实现

**TF1Adapter**（基于现有 `ModelRunner`）：
- 复用现有 `model_runner.py` 的逻辑
- 封装为适配器接口

**TF2Adapter**（新实现）：
- 使用 `tf.saved_model.load()` 加载
- 实现 `hide()` 和 `reveal()` 调用
- 处理 sigmoid + round 后处理

### 3.2 后端文件修改清单

#### 3.2.1 新建文件
1. `server/app/models/__init__.py` - 包初始化
2. `server/app/models/base.py` - 抽象基类
3. `server/app/models/tf1_adapter.py` - TF 1.x 适配器
4. `server/app/models/tf2_adapter.py` - TF 2.x 适配器
5. `server/app/models/registry.py` - 模型注册与发现
6. `server/app/models/manager.py` - 模型管理器

#### 3.2.2 修改文件
1. `server/app/server.py`：
   - 使用 `ModelManager` 替代 `ModelRunner`
   - 增强 `/api/v1/models` 端点，返回模型详细信息
   - 保持现有 API 接口不变

2. `server/app/model_runner.py`：
   - 保留作为 TF1Adapter 的内部实现
   - 或重构为 TF1Adapter 的基础类

#### 3.2.3 模型配置文件
1. `server/saved_models/stega/model_config.json` - 旧模型配置
2. `server/saved_models/upeca/model_config.json` - 新模型配置

### 3.3 前端修改清单

#### 3.3.1 API 客户端修改（`client/src/api/client.ts`）

**需要修改的函数**：

1. **`apiEncode()` 函数**：
   ```typescript
   export async function apiEncode(
     api: ApiConfig,
     params: { 
       fileUri: string; 
       fileName?: string; 
       shortId: string; 
       model?: string;  // 新增：模型名称参数
       onUploadProgress?: ProgressCb 
     }
   ): Promise<string> {
     const url = `${api.baseURL}/api/v1/encode`;
     const formData = new FormData();
     
     formData.append('image', {
       uri: params.fileUri,
       type: 'image/jpeg',
       name: params.fileName || 'image.jpg',
     } as any);
     
     formData.append('message', params.shortId);
     
     // 新增：如果提供了模型参数，添加到请求中
     if (params.model) {
       formData.append('model', params.model);
     }
     
     // ... 其余代码保持不变
   }
   ```

2. **`apiDecode()` 函数**：
   ```typescript
   export async function apiDecode(
     api: ApiConfig,
     params: { 
       fileUri: string; 
       fileName?: string; 
       model?: string;  // 新增：模型名称参数
       onUploadProgress?: ProgressCb 
     }
   ): Promise<{ success: boolean; data?: { message: string; model_used?: string }; error?: string }> {
     const url = `${api.baseURL}/api/v1/decode`;
     const formData = new FormData();
     
     formData.append('image', {
       uri: params.fileUri,
       type: 'image/jpeg',
       name: params.fileName || 'image.jpg',
     } as any);
     
     // 新增：如果提供了模型参数，添加到请求中
     if (params.model) {
       formData.append('model', params.model);
     }
     
     // ... 其余代码保持不变
   }
   ```

3. **新增 `apiListModels()` 函数**：
   ```typescript
   export async function apiListModels(
     api: ApiConfig
   ): Promise<{ models: Array<{ name: string; display_name: string; description: string; type: string }> }> {
     const url = `${api.baseURL}/api/v1/models`;
     
     const response = await fetch(url, {
       method: 'GET',
       headers: {
         'Accept': 'application/json',
       },
     });
     
     if (!response.ok) {
       throw new Error(`list models http ${response.status}`);
     }
     
     return await response.json();
   }
   ```

#### 3.3.2 设置页面修改（`client/src/screens/SettingsScreen.tsx`）

**需要修改的内容**：

1. **添加状态管理**：
   ```typescript
   const [availableModels, setAvailableModels] = useState<Array<{
     name: string;
     display_name: string;
     description: string;
     type: string;
   }>>([]);
   const [loadingModels, setLoadingModels] = useState(false);
   ```

2. **添加获取模型列表的函数**：
   ```typescript
   const loadModels = async () => {
     try {
       setLoadingModels(true);
       const api = await getApiBaseUrl();
       if (api) {
         const models = await apiListModels({ baseURL: api, timeoutMs: 10000 });
         setAvailableModels(models.models || []);
       }
     } catch (error) {
       console.error('加载模型列表失败:', error);
       // 如果加载失败，使用默认模型列表
       setAvailableModels([
         { name: 'stega', display_name: 'Stega V1', description: '原始隐写模型', type: 'tf1' }
       ]);
     } finally {
       setLoadingModels(false);
     }
   };
   ```

3. **在 useEffect 中调用**：
   ```typescript
   useEffect(() => {
     loadData();
     loadModels();  // 新增：加载模型列表
   }, []);
   ```

4. **修改模型选择 UI**：
   ```typescript
   <View style={styles.section}>
     <Text style={styles.sectionTitle}>模型选择</Text>
     <Text style={styles.sectionSubtitle}>当前模型: {currentModel}</Text>
     
     {loadingModels ? (
       <Text style={styles.hint}>正在加载模型列表...</Text>
     ) : (
       availableModels.map((model) => (
         <TouchableOpacity
           key={model.name}
           style={[
             styles.modelOption,
             currentModel === model.name && styles.modelOptionActive,
           ]}
           onPress={() => handleModelSelect(model.name)}
         >
           <View style={styles.modelInfo}>
             <Text
               style={[
                 styles.modelOptionText,
                 currentModel === model.name && styles.modelOptionTextActive,
               ]}
             >
               {model.display_name}
             </Text>
             <Text style={styles.modelDescription}>{model.description}</Text>
           </View>
           {currentModel === model.name && (
             <Text style={styles.checkmark}>✓</Text>
           )}
         </TouchableOpacity>
       ))
     )}
   </View>
   ```

#### 3.3.3 任务队列修改（`client/src/queue/TaskQueueProvider.tsx`）

**需要修改的内容**：

1. **在任务执行时读取模型**：
   ```typescript
   // 在 encode 任务中
   const result = await apiEncode(api, {
     fileUri: task.fileUri,
     fileName: task.fileName,
     shortId: task.shortId,
     model: await getModel(),  // 新增：从存储读取模型名称
   });
   
   // 在 decode 任务中
   const result = await apiDecode(api, {
     fileUri: task.fileUri,
     fileName: task.fileName,
     model: await getModel(),  // 新增：从存储读取模型名称
   });
   ```

2. **导入必要的函数**：
   ```typescript
   import { getModel } from '../utils/storage';
   import { apiListModels } from '../api/client';
   ```

#### 3.3.4 存储工具检查（`client/src/utils/storage.ts`）

**当前状态**：
- ✅ `getModel()` 和 `setModel()` 已存在
- ✅ 默认模型为 `'stega_v1'`，需要改为后端实际模型名称（如 `'step14w'`）

**需要修改**：
```typescript
export async function getModel(): Promise<string | null> {
  // 修改默认值，与后端模型名称保持一致
  return await SecureStore.getItemAsync(KEYS.MODEL) || 'stega';  // 改为 'stega'
}
```

#### 3.3.5 前端修改总结

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| `client/src/api/client.ts` | 添加 `model` 参数到 `apiEncode()` 和 `apiDecode()`，新增 `apiListModels()` | 高 |
| `client/src/screens/SettingsScreen.tsx` | 动态加载模型列表，更新 UI | 高 |
| `client/src/queue/TaskQueueProvider.tsx` | 在 API 调用时传递模型参数 | 高 |
| `client/src/utils/storage.ts` | 修改默认模型名称 | 中 |

---

## 四、文件结构优化方案

### 4.1 新的统一目录结构

**目标结构**（用户指定）：
```
saved_models/
├── stega/
│   ├── tools/
│   │   ├── encode.py
│   │   └── decode.py
│   └── model/
│       └── saved_model.pb
└── upeca/
    ├── tools/
    │   ├── encode.py
    │   └── decode.py
    └── model/
        └── saved_model.pb
```

**优化说明**：
1. ✅ **统一命名**：`step14w` → `stega`，`Up_eca` → `upeca`（更简洁）
2. ✅ **统一结构**：每个模型都有 `tools/` 和 `model/` 两个子目录
3. ✅ **工具统一**：所有工具文件统一命名为 `encode.py` 和 `decode.py`
4. ✅ **清理冗余**：删除 `variables/`、`assets/` 等 TensorFlow 自动生成的目录（模型加载时不需要）

### 4.2 当前文件结构问题分析

**现状**：
```
server/
├── encode_image.py          # ❌ 需要移动到 stega/tools/encode.py
├── decode_image.py          # ❌ 需要移动到 stega/tools/decode.py
├── saved_models/
│   ├── step14w/              # ❌ 需要重命名为 stega
│   │   ├── saved_model.pb    # ❌ 需要移动到 model/saved_model.pb
│   │   └── variables/        # ❌ 需要删除（冗余）
│   └── Up_eca/               # ❌ 需要重命名为 upeca
│       ├── encode_img.py     # ❌ 需要移动到 tools/encode.py 并重命名
│       ├── decode_img.py     # ❌ 需要移动到 tools/decode.py 并重命名
│       └── up_eca/           # ❌ 需要重命名为 model
│           ├── saved_model.pb
│           ├── variables/    # ❌ 需要删除（冗余）
│           └── assets/       # ❌ 需要删除（冗余）
└── app/
    ├── server.py
    └── model_runner.py
```

**问题**：
1. 模型目录命名不一致（`step14w` vs `Up_eca`）
2. 工具文件位置和命名不统一
3. 模型文件位置不统一（有的在根目录，有的在子目录）
4. 存在冗余的 TensorFlow 生成文件（`variables/`、`assets/`）

### 4.3 文件重组操作步骤

**详细操作清单**：

#### 步骤 1：重组 stega 模型（原 step14w）

1. **重命名目录**：
   - `server/saved_models/step14w/` → `server/saved_models/stega/`

2. **创建新目录结构**：
   - 创建 `server/saved_models/stega/tools/`
   - 创建 `server/saved_models/stega/model/`

3. **移动文件**：
   - `server/encode_image.py` → `server/saved_models/stega/tools/encode.py`
   - `server/decode_image.py` → `server/saved_models/stega/tools/decode.py`
   - `server/saved_models/stega/saved_model.pb` → `server/saved_models/stega/model/saved_model.pb`

4. **删除冗余文件**：
   - 删除 `server/saved_models/stega/variables/` 目录（如果存在）

5. **创建配置文件**：
   - 创建 `server/saved_models/stega/model_config.json`

#### 步骤 2：重组 upeca 模型（原 Up_eca）

1. **重命名目录**：
   - `server/saved_models/Up_eca/` → `server/saved_models/upeca/`

2. **创建新目录结构**：
   - 创建 `server/saved_models/upeca/tools/`
   - 创建 `server/saved_models/upeca/model/`

3. **移动文件**：
   - `server/saved_models/upeca/encode_img.py` → `server/saved_models/upeca/tools/encode.py`
   - `server/saved_models/upeca/decode_img.py` → `server/saved_models/upeca/tools/decode.py`
   - `server/saved_models/upeca/up_eca/saved_model.pb` → `server/saved_models/upeca/model/saved_model.pb`

4. **删除冗余文件和目录**：
   - 删除 `server/saved_models/upeca/up_eca/variables/` 目录
   - 删除 `server/saved_models/upeca/up_eca/assets/` 目录
   - 删除空的 `server/saved_models/upeca/up_eca/` 目录

5. **创建配置文件**：
   - 创建 `server/saved_models/upeca/model_config.json`

### 4.4 最终目录结构

**优化后的完整结构**：
```
server/
├── app/                      # API 服务器核心代码
│   ├── __init__.py
│   ├── server.py
│   ├── model_runner.py       # 保留（用于 TF1Adapter 内部实现）
│   └── models/               # 模型适配器（新增）
│       ├── __init__.py
│       ├── base.py
│       ├── tf1_adapter.py
│       ├── tf2_adapter.py
│       ├── registry.py
│       └── manager.py
└── saved_models/             # 模型文件目录（统一结构）
    ├── stega/                # 原 step14w
    │   ├── model_config.json # 模型配置文件
    │   ├── tools/            # 命令行工具
    │   │   ├── encode.py
    │   │   └── decode.py
    │   └── model/            # 模型文件
    │       └── saved_model.pb
    └── upeca/                # 原 Up_eca
        ├── model_config.json # 模型配置文件
        ├── tools/            # 命令行工具
        │   ├── encode.py
        │   └── decode.py
        └── model/            # 模型文件
            └── saved_model.pb
```

**优势**：
1. ✅ **结构统一**：所有模型遵循相同的目录结构
2. ✅ **命名统一**：工具文件统一命名为 `encode.py` 和 `decode.py`
3. ✅ **清晰分离**：工具和模型文件分离，职责明确
4. ✅ **易于维护**：新增模型只需复制目录结构
5. ✅ **无冗余文件**：删除了 TensorFlow 自动生成的冗余目录

### 4.5 关于删除冗余文件的说明

**可以安全删除的文件/目录**：
1. ✅ `variables/` 目录：包含 TensorFlow 变量索引和数据文件
   - 这些文件在模型保存时自动生成
   - 模型加载时，TensorFlow 会从 SavedModel 中读取变量
   - **注意**：如果 `saved_model.pb` 是完整的 SavedModel，删除 `variables/` 是安全的
   - **验证**：删除前先测试模型是否能正常加载

2. ✅ `assets/` 目录：包含模型资源文件（如词汇表、标签等）
   - 如果模型不使用外部资源，可以删除
   - **注意**：需要确认模型不依赖这些资源

3. ✅ 其他 TensorFlow 自动生成的文件：
   - `saved_model.pb` 是核心模型文件，**不能删除**
   - 其他文件根据实际情况判断

**删除前的检查清单**：
- [ ] 确认 `saved_model.pb` 是完整的 SavedModel（包含所有变量）
- [ ] 测试模型加载是否正常（使用 `tf.saved_model.load()` 或 `tf.compat.v1.saved_model.loader.load()`）
- [ ] 测试编码/解码功能是否正常
- [ ] 备份原始文件（建议先备份整个目录）

### 4.6 文件重组后的影响

**需要更新的引用**：
1. **模型配置文件**：`model_config.json` 中的 `model_path` 需要更新为 `"model"`
2. **适配器代码**：模型加载路径需要更新
3. **文档中的路径**：更新 README.md 中的示例命令
4. **测试脚本**：如果有测试脚本引用这些文件，需要更新路径
5. **开发脚本**：如果有开发脚本使用这些工具，需要更新路径

**向后兼容性**：
- 这些是命令行工具，不是 API 服务器的一部分
- 移动不会影响 API 服务器的运行（只要更新配置）
- 只需要更新使用这些工具的脚本路径

### 4.7 实施建议

**优先级**：高（在开始重构前完成，确保目录结构正确）

**实施时机**：
- **建议在开始重构前完成**，这样后续的配置和代码编写都基于正确的目录结构
- 或者与阶段二（模型配置）一起完成

**操作清单**：
- [ ] 重命名 `step14w/` → `stega/`
- [ ] 重命名 `Up_eca/` → `upeca/`
- [ ] 创建 `stega/tools/` 和 `stega/model/` 目录
- [ ] 创建 `upeca/tools/` 和 `upeca/model/` 目录
- [ ] 移动 stega 模型文件到 `model/` 目录
- [ ] 移动 upeca 模型文件到 `model/` 目录
- [ ] 移动工具文件到 `tools/` 目录并重命名
- [ ] 删除冗余的 `variables/` 和 `assets/` 目录
- [ ] 测试模型加载是否正常
- [ ] 更新文档中的路径引用

---

## 五、实施步骤

### 阶段一：后端核心架构（优先级：高）

1. **创建模型适配器基础架构**
   - 创建 `server/app/models/` 目录结构
   - 实现 `BaseModelAdapter` 抽象类
   - 实现 `ModelManager` 管理器

2. **实现 TF1 适配器**
   - 将现有 `ModelRunner` 逻辑封装为 `TF1Adapter`
   - 确保与现有 stega 模型兼容
   - 模型路径：`model_dir / "model"`

3. **实现 TF2 适配器**
   - 基于 `upeca/tools/encode.py` 和 `decode.py` 实现
   - 处理 sigmoid + round 后处理逻辑
   - 模型路径：`model_dir / "model"`

4. **实现模型注册机制**
   - 扫描 `saved_models/` 目录
   - 读取 `model_config.json`
   - 自动注册模型（模型名称：`stega`、`upeca`）

5. **修改 API 服务器**
   - 替换 `ModelRunner` 为 `ModelManager`
   - 增强 `/api/v1/models` 端点
   - 测试现有 API 兼容性

### 阶段二：模型配置（优先级：高）

1. **创建模型配置文件**
   - `stega/model_config.json`
   - `upeca/model_config.json`
   - 配置中的 `model_path` 设置为 `"model"`

2. **验证模型加载**
   - 测试两个模型都能正常加载（从 `model/` 目录）
   - 测试编码/解码功能
   - 确认删除冗余文件后模型仍能正常工作

### 阶段三：前端集成（优先级：中）

1. **修改 API 客户端**
   - 添加模型参数支持
   - 实现模型列表获取

2. **更新设置页面**
   - 动态加载模型列表
   - 实现模型选择功能

3. **更新任务队列**
   - 传递模型参数到 API 调用

### 阶段四：测试与优化（优先级：中）

1. **功能测试**
   - 测试两个模型的编码/解码
   - 测试前端模型切换
   - 测试前后端接口配合

2. **兼容性测试**
   - 确保旧模型（stega）正常工作
   - 确保新模型（upeca）正常工作
   - 确保默认行为（不指定模型）正常

3. **错误处理**
   - 模型加载失败处理
   - 模型不存在处理
   - 网络错误处理

---

## 六、技术细节

### 5.1 TF2 适配器关键实现

```python
class TF2Adapter(BaseModelAdapter):
    def __init__(self):
        self._model = None
        self._model_dir = None
    
    def load(self, model_dir: Path):
        import tensorflow as tf
        model_path = model_dir / "model"  # 统一路径：model_dir/model/
        self._model = tf.saved_model.load(str(model_path))
        self._model_dir = model_dir
    
    def encode(self, pil_img, secret_str):
        # 预处理图像
        image = self._preprocess_image(pil_img)
        secret_bits = self._encode_secret_to_bits(secret_str)
        
        # 转换为 tensor
        image_tensor = tf.convert_to_tensor(image, dtype=tf.float32)
        secret_tensor = tf.convert_to_tensor([secret_bits], dtype=tf.float32)
        
        # 调用模型
        result = self._model.hide(secret=secret_tensor, image=image_tensor)
        
        # 后处理
        stega = result['stega'].numpy()[0]
        residual = result['residual'].numpy()[0]
        # ... 转换为 PIL Image
    
    def decode(self, pil_img):
        # 预处理
        image = self._preprocess_image(pil_img)
        image_tensor = tf.convert_to_tensor(image, dtype=tf.float32)
        image_tensor = tf.expand_dims(image_tensor, axis=0)
        image_tensor /= 255.0
        
        # 调用模型
        result = self._model.reveal(image=image_tensor)
        decoded = result['decoded']
        
        # 后处理：sigmoid + round
        decoded = tf.round(tf.sigmoid(decoded)).numpy()
        # ... BCH 解码逻辑
```

### 5.2 模型配置文件格式

**stega/model_config.json**:
```json
{
  "model_type": "tf1",
  "model_name": "stega",
  "display_name": "Stega V1",
  "description": "原始隐写模型（TensorFlow 1.x）",
  "input_size": [400, 400],
  "secret_length": 7,
  "model_path": "model"
}
```

**upeca/model_config.json**:
```json
{
  "model_type": "tf2",
  "model_name": "upeca",
  "display_name": "Up-ECA 模型",
  "description": "基于 ECA 注意力机制的隐写模型（TensorFlow 2.x）",
  "input_size": [400, 400],
  "secret_length": 7,
  "model_path": "model"
}
```

### 5.3 API 响应格式

**GET /api/v1/models**:
```json
{
  "models": [
    {
      "name": "stega",
      "display_name": "Stega V1",
      "description": "原始隐写模型",
      "type": "tf1",
      "input_size": [400, 400],
      "secret_length": 7
    },
    {
      "name": "upeca",
      "display_name": "Up-ECA 模型",
      "description": "基于 ECA 注意力机制的隐写模型",
      "type": "tf2",
      "input_size": [400, 400],
      "secret_length": 7
    }
  ]
}
```

---

## 七、风险评估与应对

### 6.1 风险点

1. **TensorFlow 版本兼容性**
   - 风险：TF 1.x 和 TF 2.x 可能在同一环境中冲突
   - 应对：使用 `tf.compat.v1` 确保兼容，或使用虚拟环境隔离

2. **模型加载性能**
   - 风险：频繁切换模型可能导致性能问题
   - 应对：实现模型缓存机制，按需加载

3. **向后兼容性**
   - 风险：修改可能影响现有功能
   - 应对：保持 API 接口不变，充分测试

4. **前端模型选择**
   - 风险：用户选择不存在的模型
   - 应对：前端从后端获取模型列表，只显示可用模型

### 6.2 测试策略

1. **单元测试**：每个适配器独立测试
2. **集成测试**：端到端测试编码/解码流程
3. **兼容性测试**：确保旧模型正常工作
4. **性能测试**：模型加载和推理性能

---

## 八、部署配置说明

### 7.1 内网穿透配置（frpc.toml）

**重要**：重构后，**frpc.toml 配置不需要任何修改**！

**原因**：
- 后端仍然运行在同一个端口（如 8080）
- 模型切换是在应用层通过 API 参数实现的
- 不需要多个端口，不需要多个后端服务

**现有配置保持不变**：
```toml
# frp_0.64.0_windows_amd64/frpc.toml
serverAddr = "47.101.142.85"
serverPort = 7000

auth.method = "token"
auth.token = "thisisatoken"

[[proxies]]
name = "ubuntu-frpc-8080"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8080      # 后端服务端口（保持不变）
remotePort = 6100     # 公网端口（保持不变）
```

### 7.2 后端启动方式

**重构前**：
```bash
# 一个终端，一个命令
uvicorn server.app.server:app --host 0.0.0.0 --port 8080
```

**重构后**：
```bash
# 仍然是：一个终端，一个命令
uvicorn server.app.server:app --host 0.0.0.0 --port 8080
```

**没有任何变化**！后端仍然是一个服务，运行在一个端口。

### 7.3 模型切换方式

**前端选择模型**：
- 在设置页面选择模型（如 "Stega V1" 或 "Up-ECA 模型"）
- 前端将模型名称保存到本地存储
- 调用 API 时，在请求中传递 `model` 参数

**API 调用示例**：
```javascript
// 使用 stega 模型
formData.append('model', 'stega');
formData.append('message', shortId);

// 使用 upeca 模型
formData.append('model', 'upeca');
formData.append('message', shortId);
```

**后端处理**：
- 接收 `model` 参数
- ModelManager 根据模型名称选择对应的适配器
- 如果模型未加载，则按需加载
- 执行编码/解码操作

### 7.4 总结

| 项目 | 重构前 | 重构后 | 变化 |
|------|--------|--------|------|
| 后端服务数量 | 1个 | 1个 | ✅ 无变化 |
| 后端端口 | 8080 | 8080 | ✅ 无变化 |
| 内网穿透配置 | 1个端口映射 | 1个端口映射 | ✅ 无变化 |
| 模型切换方式 | 不支持 | API 参数 | ✅ 新增功能 |

---

## 九、后续扩展性

### 7.1 支持更多模型类型

未来可以轻松添加：
- PyTorch 模型适配器
- ONNX 模型适配器
- 自定义模型格式适配器

### 7.2 模型版本管理

- 支持模型版本号
- 支持模型 A/B 测试
- 支持模型回滚

### 7.3 模型性能监控

- 记录模型使用统计
- 监控模型推理时间
- 错误率统计

---

## 十、实施检查清单

### 后端
- [ ] 创建 `server/app/models/` 目录结构
- [ ] 实现 `BaseModelAdapter` 抽象类
- [ ] 实现 `TF1Adapter`（基于现有 ModelRunner）
- [ ] 实现 `TF2Adapter`（基于 Up_eca 代码）
- [ ] 实现 `ModelManager` 管理器
- [ ] 实现模型注册与发现机制
- [ ] 创建模型配置文件（stega, upeca）
- [ ] 修改 `server.py` 使用 ModelManager
- [ ] 增强 `/api/v1/models` 端点
- [ ] 测试两个模型都能正常工作

### 前端
- [ ] 修改 `apiEncode()` 添加 model 参数
- [ ] 修改 `apiDecode()` 添加 model 参数
- [ ] 实现 `apiListModels()` 函数
- [ ] 修改 `SettingsScreen` 动态加载模型列表
- [ ] 修改 `TaskQueueProvider` 传递模型参数
- [ ] 修改 `storage.ts` 默认模型名称
- [ ] 测试模型选择功能
- [ ] 测试前端与后端模型列表同步

### 文件结构优化（优先级：高，建议在重构前完成）
- [ ] 重命名 `step14w/` → `stega/`
- [ ] 重命名 `Up_eca/` → `upeca/`
- [ ] 创建统一的 `tools/` 和 `model/` 目录结构
- [ ] 移动模型文件到 `model/` 目录
- [ ] 移动工具文件到 `tools/` 目录并重命名
- [ ] 删除冗余的 `variables/` 和 `assets/` 目录
- [ ] 测试模型加载是否正常
- [ ] 更新文档中的路径引用

### 测试
- [ ] 测试 stega 模型编码/解码
- [ ] 测试 upeca 模型编码/解码
- [ ] 测试前端模型切换
- [ ] 测试默认模型行为
- [ ] 测试错误处理
- [ ] 测试删除冗余文件后模型仍能正常工作

---

## 十一、目录结构变更后的代码修改清单

**重要**：用户已手动完成目录结构重组，现在需要修改所有引用旧路径和旧名称的代码。

### 11.1 后端代码修改

#### 11.1.1 `server/app/model_runner.py`

**文件位置**：`server/app/model_runner.py`

**需要修改**：
- **第 76 行**：`load()` 方法中的模型加载路径
  - **当前代码**：
    ```python
    model = tf.compat.v1.saved_model.loader.load(sess, [self._tag_constants.SERVING], model_dir)
    ```
  - **修改为**：
    ```python
    # model_dir 现在是模型根目录（如 stega/），需要加上 "model" 子目录
    model_path = os.path.join(model_dir, "model")
    model = tf.compat.v1.saved_model.loader.load(sess, [self._tag_constants.SERVING], model_path)
    ```
  - **说明**：`model_dir` 参数现在指向模型根目录（如 `stega/`），但实际模型文件在 `model/` 子目录中

**修改原因**：
- 目录结构已改为：`saved_models/stega/model/saved_model.pb`
- 需要从 `model_dir / "model"` 加载模型

---

#### 11.1.2 `server/app/server.py`

**文件位置**：`server/app/server.py`

**需要修改**：
- **第 72 行**：`encode_image()` 函数中的模型加载
  - **当前代码**：
    ```python
    runner.load(str(model_dir))
    ```
  - **修改为**：
    ```python
    # model_dir 是模型根目录（如 stega/），需要加上 "model" 子目录
    model_path = str(model_dir / "model")
    runner.load(model_path)
    ```

- **第 106 行**：`decode_image()` 函数中的模型加载
  - **当前代码**：
    ```python
    runner.load(str(model_dir))
    ```
  - **修改为**：
    ```python
    # model_dir 是模型根目录（如 stega/），需要加上 "model" 子目录
    model_path = str(model_dir / "model")
    runner.load(model_path)
    ```

**修改原因**：
- `resolve_model_dir()` 返回的是模型根目录（如 `stega/` 或 `upeca/`）
- 但实际模型文件在 `model/` 子目录中，需要拼接路径

---

#### 11.1.3 `server/README.md`

**文件位置**：`server/README.md`

**需要修改**：
- **第 6 行**：更新工具使用示例
  - **当前代码**：
    ```markdown
    - `python server/encode_image.py server/saved_models/<model_dir> --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`
    ```
  - **修改为**：
    ```markdown
    - `python server/saved_models/<model_dir>/tools/encode_image.py server/saved_models/<model_dir>/model --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`
    ```
  - **示例（stega 模型）**：
    ```markdown
    - `python server/saved_models/stega/tools/encode_image.py server/saved_models/stega/model --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`
    ```
  - **示例（upeca 模型）**：
    ```markdown
    - `python server/saved_models/upeca/tools/encode_img.py server/saved_models/upeca/model --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`
    ```

- **第 9 行**：更新解码工具使用示例
  - **当前代码**：
    ```markdown
    - `python server/decode_image.py server/saved_models/<model_dir> --image server/tmp/test_hidden.png`
    ```
  - **修改为**：
    ```markdown
    - `python server/saved_models/<model_dir>/tools/decode_image.py server/saved_models/<model_dir>/model --image server/tmp/test_hidden.png`
    ```
  - **示例（stega 模型）**：
    ```markdown
    - `python server/saved_models/stega/tools/decode_image.py server/saved_models/stega/model --image server/tmp/test_hidden.png`
    ```
  - **示例（upeca 模型）**：
    ```markdown
    - `python server/saved_models/upeca/tools/decode_img.py server/saved_models/upeca/model --image server/tmp/test_hidden.png`
    ```

- **第 32 行**：更新 Docker 示例
  - **当前代码**：
    ```markdown
    - `docker run --rm -p 8080:8080 -e MODEL_DIR=/app/server/saved_models/step14w image-process-api`
    ```
  - **修改为**：
    ```markdown
    - `docker run --rm -p 8080:8080 -e MODEL_DIR=/app/server/saved_models/stega image-process-api`
    ```
  - **注意**：`MODEL_DIR` 环境变量指向模型根目录（如 `stega/`），代码会自动拼接 `model/` 子目录

**修改原因**：
- 工具文件已移动到模型目录下的 `tools/` 子目录（保持原文件名：`encode_image.py`/`decode_image.py` 用于 stega，`encode_img.py`/`decode_img.py` 用于 upeca）
- 模型文件在 `model/` 子目录中，使用工具时需要传递 `model/` 子目录的路径
- 模型名称已更新为 `stega` 和 `upeca`

---

### 11.2 前端代码修改

#### 11.2.1 `client/src/utils/storage.ts`

**文件位置**：`client/src/utils/storage.ts`

**需要修改**：
- **第 38 行**：默认模型名称
  - **当前代码**：
    ```typescript
    return await SecureStore.getItemAsync(KEYS.MODEL) || 'stega_v1';
    ```
  - **修改为**：
    ```typescript
    return await SecureStore.getItemAsync(KEYS.MODEL) || 'stega';
    ```

**修改原因**：
- 后端模型名称已改为 `stega`（不再是 `stega_v1`）
- 需要与后端保持一致

---

#### 11.2.2 `client/src/screens/SettingsScreen.tsx`

**文件位置**：`client/src/screens/SettingsScreen.tsx`

**需要修改**：
- **第 10 行**：初始状态
  - **当前代码**：
    ```typescript
    const [currentModel, setCurrentModelState] = useState<string>('stega_v1');
    ```
  - **修改为**：
    ```typescript
    const [currentModel, setCurrentModelState] = useState<string>('stega');
    ```

- **第 27 行**：从存储读取时的默认值
  - **当前代码**：
    ```typescript
    setCurrentModelState(m || 'stega_v1');
    ```
  - **修改为**：
    ```typescript
    setCurrentModelState(m || 'stega');
    ```

- **第 118、120、125、130 行**：硬编码的模型名称
  - **当前代码**：所有 `'stega_v1'` 出现的地方
  - **修改为**：`'stega'`
  - **注意**：如果这些是 UI 显示用的硬编码选项，建议改为从后端动态获取模型列表（见阶段三）

**修改原因**：
- 后端模型名称已改为 `stega`
- 需要与后端保持一致

---

#### 11.2.3 `client/src/queue/TaskTypes.ts`

**文件位置**：`client/src/queue/TaskTypes.ts`

**需要修改**：
- **第 30 行**：注释中的模型名称示例
  - **当前代码**：
    ```typescript
    modelUsed?: string; // "stega_v1" etc.
    ```
  - **修改为**：
    ```typescript
    modelUsed?: string; // "stega" or "upeca" etc.
    ```

**修改原因**：
- 更新注释以反映新的模型名称

---

### 11.3 文档修改

#### 11.3.1 `README.md`（项目根目录）

**文件位置**：`README.md`

**需要检查**：
- 如果文档中有提到 `step14w`、`Up_eca`、`encode_image.py`、`decode_image.py` 等，需要更新为新的路径和名称

**示例修改**：
- `step14w` → `stega`
- `Up_eca` → `upeca`
- `server/encode_image.py` → `server/saved_models/stega/tools/encode_image.py`
- `server/decode_image.py` → `server/saved_models/stega/tools/decode_image.py`
- `server/encode_img.py` → `server/saved_models/upeca/tools/encode_img.py`
- `server/decode_img.py` → `server/saved_models/upeca/tools/decode_img.py`

---

### 11.4 修改总结表

| 文件 | 行号 | 修改内容 | 优先级 |
|------|------|---------|--------|
| `server/app/model_runner.py` | 76 | 模型加载路径：`model_dir` → `model_dir / "model"` | **高** |
| `server/app/server.py` | 72 | 编码函数：`str(model_dir)` → `str(model_dir / "model")` | **高** |
| `server/app/server.py` | 106 | 解码函数：`str(model_dir)` → `str(model_dir / "model")` | **高** |
| `server/README.md` | 6, 9, 32 | 更新工具使用示例和 Docker 示例 | **中** |
| `client/src/utils/storage.ts` | 38 | 默认模型：`'stega_v1'` → `'stega'` | **高** |
| `client/src/screens/SettingsScreen.tsx` | 10, 27, 118, 120, 125, 130 | 所有 `'stega_v1'` → `'stega'` | **高** |
| `client/src/queue/TaskTypes.ts` | 30 | 注释更新 | **低** |
| `README.md`（根目录） | - | 检查并更新所有路径和名称引用 | **中** |

---

### 11.5 修改后的验证步骤

完成所有修改后，请按以下步骤验证：

1. **后端验证**：
   ```bash
   # 启动服务器
   uvicorn server.app.server:app --host 0.0.0.0 --port 8080
   
   # 测试编码（使用 stega 模型）
   curl -F "image=@test.jpg" -F "message=A1B2C3D" -F "model=stega" http://localhost:8080/api/v1/encode > out.png
   
   # 测试解码
   curl -F "image=@out.png" -F "model=stega" http://localhost:8080/api/v1/decode
   
   # 测试 upeca 模型
   curl -F "image=@test.jpg" -F "message=A1B2C3D" -F "model=upeca" http://localhost:8080/api/v1/encode > out_upeca.png
   ```

2. **工具文件验证**：
   ```bash
   # 测试 stega 编码工具
   python server/saved_models/stega/tools/encode_image.py server/saved_models/stega/model --image test.jpg --save_dir output --secret A1B2C3D
   
   # 测试 stega 解码工具
   python server/saved_models/stega/tools/decode_image.py server/saved_models/stega/model --image output/test_hidden.png
   
   # 测试 upeca 编码工具
   python server/saved_models/upeca/tools/encode_img.py server/saved_models/upeca/model --image test.jpg --save_dir output --secret A1B2C3D
   
   # 测试 upeca 解码工具
   python server/saved_models/upeca/tools/decode_img.py server/saved_models/upeca/model --image output/test_hidden.png
   ```

3. **前端验证**：
   - 启动前端应用
   - 检查设置页面中的模型选择是否显示 `stega` 和 `upeca`
   - 测试编码/解码功能是否正常

---

## 十二、注意事项

1. **模型路径**：统一为 `model_dir / "model"`，所有模型都从 `model/` 子目录加载
2. **模型名称**：使用统一的模型名称 `stega` 和 `upeca`（小写，简洁）
3. **删除冗余文件**：删除 `variables/` 和 `assets/` 前，务必测试模型是否能正常加载
4. **BCH 编码**：两个模型都使用相同的 BCH 编码逻辑，可以提取为公共函数
5. **图像预处理**：两个模型的预处理逻辑略有不同，需要在适配器中分别实现
6. **线程安全**：ModelManager 需要保证线程安全，使用锁机制
7. **内存管理**：模型加载会占用内存，考虑实现模型卸载机制
8. **工具文件重命名**：`encode_image.py` → `encode.py`，`decode_image.py` → `decode.py`，`encode_img.py` → `encode.py`，`decode_img.py` → `decode.py`

---

## 十二、预期成果

完成重构后，项目将具备：
1. ✅ 支持多种模型类型（TF 1.x、TF 2.x）
2. ✅ 易于添加新模型（只需添加适配器和配置文件）
3. ✅ 前后端完整配合（前端动态获取模型列表）
4. ✅ 向后兼容（现有功能不受影响）
5. ✅ 模块化设计（代码结构清晰，易于维护）

---

**请检查此方案，确认无误后我将开始实施修改。**

