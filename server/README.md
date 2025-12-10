# Stega Server Scripts

This directory groups backend-facing scripts and future server code. Use these scripts directly; root-level wrappers have been removed.

Usage:
- `python server/saved_models/<model_dir>/tools/encode_image.py server/saved_models/<model_dir>/model --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`
- 示例（stega 模型）：`python server/saved_models/stega/tools/encode_image.py server/saved_models/stega/model --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`
- 示例（upeca 模型）：`python server/saved_models/upeca/tools/encode_image.py server/saved_models/upeca/model --image server/test/test.jpg --save_dir server/tmp --secret A1B2C3D`

Decode:
- `python server/saved_models/<model_dir>/tools/decode_image.py server/saved_models/<model_dir>/model --image server/tmp/test_hidden.png`
- 示例（stega 模型）：`python server/saved_models/stega/tools/decode_image.py server/saved_models/stega/model --image server/tmp/test_hidden.png`
- 示例（upeca 模型）：`python server/saved_models/upeca/tools/decode_image.py server/saved_models/upeca/model --image server/tmp/test_hidden.png`

Notes
- SavedModels now live under `server/saved_models/`.
- Temporary artifacts live under `server/tmp/`.
- Sample assets live under `server/test/`.
- Scripts accept the same argparse flags as before.

Run the web API (FastAPI)
- Set a model dir (if multiple exist):
  - PowerShell: `$env:MODEL_DIR="server/saved_models/<model_dir>"`
- Start server (dev):
  - `uvicorn server.app.server:app --host 0.0.0.0 --port 8080 --reload`
- Endpoints:
  - `GET /api/v1/ping` -> `{ "ok": true }`
  - `POST /api/v1/encode` (multipart: `image`, `message`) -> PNG
  - `POST /api/v1/decode` (multipart: `image`) -> JSON `{ success, data.message }`
  - `GET /api/v1/models` -> model directories under `server/saved_models/`

Docker (CPU, recommended for quick start)
- Build image:
  - `docker build -t image-process-api -f server/Dockerfile .`
- Run container (mount models and tmp):
  - `docker run --rm -p 8080:8080 -e MODEL_DIR=/app/server/saved_models/stega image-process-api`
  - 或者自定义模型目录：`-v %cd%/server/saved_models:/app/server/saved_models -e MODEL_DIR=/app/server/saved_models/<model_dir>`
- Test:
  - `curl http://localhost:8080/api/v1/ping`
  - `curl -F "image=@server/test/test.jpg" -F "message=A1B2C3D" http://localhost:8080/api/v1/encode > out.png`
  - `curl -F "image=@out.png" http://localhost:8080/api/v1/decode`

Conda 环境（CPU，Windows 示例）
- 创建环境（Python 3.8）：`conda create -n imgproc-py38 python=3.8 -y`
- 安装依赖（网络不畅可多试几次或切换镜像）：
  - `conda run -n imgproc-py38 python -m pip install tensorflow==2.10.0 tensorflow-estimator==2.10.0 tensorboard==2.10.1 pillow==8.4.0 protobuf==3.19.6 h5py==3.1.0 fastapi==0.110.2 uvicorn[standard]==0.29.0 python-multipart==0.0.9 tensorflow-io-gcs-filesystem==0.31.0 bchlib==0.10`
- 启动：`conda run -n imgproc-py38 uvicorn server.app.server:app --host 0.0.0.0 --port 8080`
