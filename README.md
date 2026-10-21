# VividDesktop：客户端与 CF 独立分发

当前源码版本 **0.4.0，账号与桌面体验预览版**，新版安装包尚未发布，本机原有 0.3.3 安装版保持不变。用户可见的迭代内容见 [版本更新](CHANGELOG.md)，后续版本与推送规则见 [项目约定](AGENTS.md)。本仓库仅提供客户端源码和文档，CF 环境、运行包、安装程序及个人数据分别保存在本机，未上传到 Git。

2026-10-20 已按用户要求完成旧下载片段、测试缓存和旧版解包目录清理，过程脚本与前端遗留草稿已校验归档，正式客户端与 CF 保持可用。旧验收记录中的片段留存描述属于清理前快照；清理回执和恢复归档仅保存在本机。

## 四个独立目录

| 目录 | 内容 |
| --- | --- |
| `G:\Agent\Vivida4free\VividDesktop` | 客户端源码、构建工具、验证记录 |
| `G:\Agent\Vivida4free\VividClient` | 安装后的 Windows 客户端 |
| `G:\Agent\Vivida4free\VividCFRuntime` | 独立 CF 存储，实际版本为 `versions\vivid-comfy-0.3.0` |
| `G:\Agent\Vivida4free\VividCFPackages` | 独立 CF 发行 ZIP |

以上为实体目录，不使用目录链接或共用模型目录。CF 版本目录自带 Python、ComfyUI、节点、15 个模型、本地反推、工作流与输入输出。存储根目录 start.cmd/stop.cmd 可独立启动和停止 CF，停止前校验所属进程。原始 vivid模型 资料独立保留。

当前客户端安装程序为 `release/r10-client033/VividDesktop-Setup-0.3.3-x64.exe`，113,064,594 字节，已安装到上述 VividClient 目录。本机默认用户数据已登记独立 CF 位置。完整本地验收记录见 `docs/local-acceptance-033.md`。

客户端安装包只含 Electron、界面、任务服务和轻量工作流，不含 CF、Python 或模型。客户端与 CF 分别更新。图库、任务、Agent 令牌和 CF 位置设置使用 Electron 用户数据目录，不存放在安装目录。卸载保留外置 CF 和用户数据。

## 本地验证

原工作流的模型、精度、采样与分块链路保留，预览采用指定 vivid_klein_v1.4_000076275 LoRA，以本地 Qwen 反推替换在线 GLM。

- 原预览输出 2048×860，CF 执行约 99 秒。
- 原放大输出 8000×3360，CF 执行约 481 秒。
- 真实 Electron 完成双输入上传、渲染、结果设为主图、默认 4096 放大；输出 4096×1720，放大约 273 秒。
- 重启后任务、图库和真实输出可回看。CF 实际进度已到达客户端；28% 时真实取消后显示已取消，任务状态 cancelled，旧错误已清除。Agent 指定任务取消不影响另一 UI 任务。
- 前端相关回归 137 项、桌面 24 项通过。最终安装版通过运行环境识别、真实历史图片与图库恢复，以及 Agent 401/200/403 验证。

完整包：G:\Agent\Vivida4free\VividCFPackages\vivid-comfy-0.3.0-win32-x64.zip，83,725,765,123 字节。SHA256 为 3bc3e8e8495f3b6901f57f8d184fc506f926cccaf5eadf0b327a339650530ff7。全部成员已逐文件 SHA256 与 ZIP CRC 校验。包不含输入输出、用户数据、片段或诊断插件。

原始证据见 .runloop/local-client-r10/evidence。R5/R8 停止记录、R7 夹具测试和早期安装包保留作恢复与对比，不作为本轮最终验收。

## 仍然延后的项目

正式 CF 下载地址未确定，desktop/runtime-feed.json 的 manifestUrl 为空。目前先跑本地。独立下载、暂停、Range 续传、校验、ZIP64 安装和激活已在小夹具链路验证；正式托管与实际完整大包下载、解压安装需地址就绪后验收。完整包校验不等于已验证完整大包下载链路。

当前源码已接入统一账号中心 https://www.vividai.com.cn/new-api，支持登录、资料刷新、会话恢复与退出；注册入口打开官方账号中心。本机真实登录与会话生命周期已验证，多电脑、到期与撤销场景仍待验收，详见 [账号对接记录与配合事项](docs/account-system-integration.md)。导入图库、输出目录和 Agent 接口位于“登录 / 账号弹窗 → 设置”，未登录也可使用。自定义标题栏的按钮与双击已验证，拖动与边缘缩放仍待人工确认。本地生成不扣额度；创意工坊保留界面且未开放。

## CF 打包

协议见 docs/runtime-package-contract-v1.md；模型来源见 docs/model-sources.md 及实际 CF 版本目录中的 local-models.json、parallel-downloads.json。开发工具必须显式传实际版本根目录：

```powershell
$cf = 'G:\Agent\Vivida4free\VividCFRuntime\versions\vivid-comfy-0.3.0'
& "$cf\python\python.exe" -s -X utf8 tools/package_runtime.py --source $cf --check-only
& "$cf\python\python.exe" -s -X utf8 tools/package_runtime.py --source $cf --version 0.3.0 --local-only --acceptance-report .runloop/local-client-r10/evidence/runtime-workflow-acceptance.json --out G:/Agent/Vivida4free/VividCFPackages
```

托管确定后使用 HTTPS --archive-url 生成发布清单，部署 ZIP 与清单，再配置客户端清单地址。正式包必须通过模型清单和双工作流真实输出验收。

## 构建客户端

```powershell
cd client
npm ci
npm run build -- --mode desktop
cd ..
node desktop/prepare-ui.cjs
$env:ELECTRON_BUILDER_CACHE = 'G:\PackageCaches\electron-builder'
node tools/installer/node_modules/electron-builder/cli.js --projectDir desktop --config "$PWD/tools/installer/electron-builder.json" --config.directories.output=../release/r10-client033 --win nsis --x64 --publish never
```

开发依赖分别在 desktop 和 tools/installer 安装。构建使用显式文件白名单。上方命令展示原 0.3.3 安装包的构建方式，制作新版本时应使用对应的独立输出目录；本轮仅交付源码。安装器只检查目标目录占用，不按进程名杀其他版本。基线保留在 .local-baseline；未修改线上账号配置。

## Agent

默认 127.0.0.1:17861/v1，随机 Bearer 令牌存于用户数据目录。agentInfo 仅向网页返回端点与令牌文件路径，不暴露令牌值。接口提供能力、渲染和放大任务、状态与指定任务取消；没有任意工作流、命令执行或远程安装功能。真实验证覆盖无令牌 401、正确令牌 200、网页跨域 403，以及 UI 共用任务生命周期。内部 UI 默认 17860，CF 默认 18295。
