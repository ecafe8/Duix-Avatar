# Duix.Avatar 项目长期约定

## 文件与路径约定
- 用户要求：所有下载的模型、权重、镜像相关大文件统一放在项目内 `D:/work/ai/Duix-Avatar/models/`，不要放到 C 盘用户目录或其他用户目录，避免找不到文件。
- 已在 `.gitignore` 追加 `models/`；原 `duix_avatar_data/` 也已忽略。
- 如需手动下载模型，设置缓存环境变量指向该目录：`HF_HOME`、`MODELSCOPE_CACHE`、`XDG_CACHE_HOME` → `D:/work/ai/Duix-Avatar/models/...`。

## 运行架构（本机 Windows，2026-11-06 已改造）
- 三块：Docker GPU 服务端（tts 18180 / asr 10095 / 视频合成 8383）+ Electron 桌面客户端（根目录）+ 可选 Next.js 局域网 Web 客户端（src-web，3000）。
- 数据路径已统一到项目内 `models/`：三个 Windows compose 的数据卷改为 `${DUIX_HOST_TTS_DIR:-../models/voice/data}` / `${DUIX_HOST_FACE_DIR:-../models/face2face}`；`deploy/.env`（git 忽略）写绝对路径，`deploy/.env.example` 同步。
- `src/main/config/config.js`：优先读 `DUIX_DATA_DIR`，其次自动识别项目内 `models/`，否则回退 `D:\duix_avatar_data`；已删除 dev 模式的外部 IP `192.168.4.204`，统一 `127.0.0.1`（可用 `DUIX_API_HOST` 覆盖）。
- `src-web/.env.local`（git 忽略）设 `DUIX_FACE_DATA_DIR` / `DUIX_TTS_DATA_DIR` / `DUIX_WEB_DB_PATH` / `FFMPEG_PATH`（内置 `resources/ffmpeg/win-amd64/bin/ffmpeg.exe`）。
- `.gitignore` 已忽略 `models/`、`deploy/.env`、`.env.local`；Docker Desktop 镜像层目标位置 `D:/work/ai/Duix-Avatar/models/docker`（需在设置里改 Disk image location）。
- 坑：`npm --prefix src-web install` 会连带触发根目录 postinstall（`electron-builder install-app-deps`）并失败；必须 `cd src-web && npm install`。

## 本机环境（2026-11-06 检查）
- Node v22.22.2 / npm 10.9.7；GPU NVIDIA RTX 3090，驱动 616.56（用标准 compose，不要用 -5090 版）。
- Docker Desktop 29.9.2 / Compose v5.6.1 已装，WSL2 引擎；`docker info` 里 `nvidia` 运行时已注册，GPU 透传就绪。系统 PATH 无 ffmpeg（仓库自带）。
- 用户已把 Docker WSL 数据目录改到 `D:\.docker-cache\DockerDesktopWSL`（`settings-store.json` 的 `CustomWslDistroDir`），并明确表示保持该位置、不再迁到项目内 `models/docker`；镜像层在这里，项目素材/数据库仍在 `models/`。改法只有 GUI：Settings → Resources → Advanced → Disk image location（顺便把 Disk usage limit 调到 ≥120G）。
- GPU 透传实测通过：`docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi` 在容器内看到 RTX 3090 / 驱动 616.56。
- `deploy/docker-compose.yml up -d` 已完成（2026-11-06，耗时 5h34m）：三个容器 `duix-avatar-tts` / `duix-avatar-asr` / `duix-avatar-gen-video` 全部 Up，`/api/health` 的 tts/video 均 `online:true`，GPU 显存占用约 7.6GB。日志在 `models/.cache/npm/compose-up.log`。
- 三个镜像实际解压后合计约 110GB（fish-speech 52.1G / fun-asr 42.4G / duix.avatar 15.1G），vhdx 约 105GB；比 README 说的「70G 流量」大，预留磁盘要按 120G+ 算。
- 服务端口探测的正常返回：18180 → 200，8383/easy → 404（根路径无路由，服务正常），10095 → 426（WebSocket 握手要求，非故障）。
- 沙箱禁止执行 `wsl.exe`（程序黑名单），不要尝试用 WSL 命令迁移分发。
- `src-web` 依赖已装（Next 16.4.5 / better-sqlite3 可用）；`npm run dev` 验证通过：首页 200，`/api/health` 返回 tts/video offline（Docker 服务未起，属预期）。后台 dev server 会随会话结束被回收，需长期运行请用户自己在终端启动。
- `docker compose -f deploy/docker-compose.yml config` 已验证卷解析为 `D:/work/ai/Duix-Avatar/models/face2face` 与 `models/voice/data`，端口 18180 / 10095 / 8383。
- 磁盘：C 盘剩 251G，D 盘 196G 可用，足够放约 70G 镜像。
- npm 缓存与日志改用项目内 `models/.cache/npm`（`npm install --cache ...`），不落用户目录。
