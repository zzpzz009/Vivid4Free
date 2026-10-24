# VividDesktop：客户端与 CF 独立分发

当前源码版本 **0.7.0，公开预览版**，提供经典深色与 Animal Island 海岛皮肤，可从标题栏或“账号 → 设置 → 界面皮肤”切换并记住选择；必须先登录 VividAI 账号，验证成功后播放当前皮肤开屏动画再进入工作区；无账号可从全屏登录页打开官方注册。沿用原工作台的大布局，具体适配与验证说明见 [海岛皮肤](docs/animal-island-skin.md) 和 [首次使用开屏](docs/startup-intro.md)。用户可见的迭代内容见 [版本更新](CHANGELOG.md)，后续版本与推送规则见 [项目约定](AGENTS.md)。本仓库仅提交客户端源码、通用工具和版本信息；客户端安装包通过 GitHub Releases 分发，引擎包和模型只通过夸克分发，不进入 Git。个人数据和工作流原件保留在本机。安装包的实际版本、来源提交和校验值以发行记录为准；构建安装包不会自动覆盖现用客户端。

客户端：[下载 0.7.0 安装包](https://github.com/zzpzz009/Vivid4Free/releases/tag/v0.7.0)。引擎：[夸克下载目录](https://pan.quark.cn/s/195bd3902d6e)，提取码 `Mw2s`；全量包约 83.7 GB，从官方 0.3.1 升级的增量包约 9 MB。新电脑安装和实际出图仍须独立验收。

2026-10-20 已按用户要求完成旧下载片段、测试缓存和旧版解包目录清理，过程脚本与前端遗留草稿已校验归档，正式客户端与 CF 保持可用。旧验收记录中的片段留存描述属于清理前快照；清理回执和恢复归档仅保存在本机。

## 四个独立目录

| 目录 | 内容 |
| --- | --- |
| `G:\Agent\Vivida4free\VividDesktop` | 客户端源码、构建工具、验证记录 |
| `G:\Agent\Vivida4free\VividClient` | 安装后的 Windows 客户端 |
| `G:\Agent\Vivida4free\VividCFRuntime` | 独立 CF 存储，实际版本为 `versions\vivid-comfy-0.3.2` |
| `G:\Agent\Vivida4free\VividCFPackages` | 独立 CF 发行 ZIP |

以上为实体目录，不使用目录链接或共用模型目录。CF 版本目录自带 Python、ComfyUI、节点、15 个模型、本地反推与输入输出；产品工作流自客户端 0.6.1 起封装在客户端内，不再随新引擎包分发。存储根目录 start.cmd/stop.cmd 可独立启动和停止 CF，停止前校验所属进程。原始 vivid模型 资料独立保留。

安装包统一保存在 `G:\Agent\Vivida4free\VividDesktop\release\installer`，以后始终从 `VividDesktop-Setup-latest-x64.exe` 打开最新本机安装包；同目录的 `latest.json` 记录实际版本、来源提交和 SHA256。安装后的日常启动入口固定为 `G:\Agent\Vivida4free\VividClient\VividDesktop.exe`。`win-unpacked` 是构建中间产物，不作为日常启动路径。旧版本目录不再使用。

现用安装和用户数据在生成新包时保持不变；需要更新时运行上述最新安装包。本机默认用户数据已登记独立 CF 位置。`docs/local-acceptance-033.md` 是原 0.3.3 的历史验收快照，其中旧产物路径只用于追溯，不是当前下载或构建入口。

旧安装包及旧解包目录统一移入 `.local-baseline/installer-archive` 作为可恢复归档，不再放在发行入口；归档不代表释放磁盘空间。清理记录保留在本机。

客户端安装包只含 Electron、界面、任务服务和轻量工作流，不含 CF、Python 或模型。客户端与 CF 分别更新。图库、任务、Agent 令牌和 CF 位置设置使用 Electron 用户数据目录，不存放在安装目录。卸载保留外置 CF 和用户数据。

## 新电脑接入 CF

运行环境面板支持导入官方全量或增量 ZIP，以及接入已解压的官方版本目录，不需要手工修改本机设置；详情见 [新电脑接入与更新](docs/cf-onboarding.md)。新电脑使用引擎 0.3.2 全量包；增量包仅供完整、未修改的官方 0.3.1 基线升级。

## 本地验证

预览采用用户指定的 vivid_klein_v1.4_000076275 LoRA，强度 1，仅第 1 步启用，后 3 步关闭 vivid；Klein 一致性增强全程保持 0.7，总计 4 步 Euler。其余原节点与本地 Qwen 反推保留。当前正式接入说明见 `docs/preview-v14-consistency.md`，此前首步调度记录见 `docs/preview-first-step.md`。

0.4.1 修复预览接入：恢复原插件计算节点、两项原版默认强度及 JPG 保存。当前本机 CF 需带 `preview-fidelity-v1` 修正；旧 0.3.0 ZIP 不包含此修正。恢复范围及剩余差异见 `docs/preview-fidelity.md`；以下 0.3.3 数值为历史验收，不代替本次证据。

- 原预览输出 2048×860，CF 执行约 99 秒。
- 原放大输出 8000×3360，CF 执行约 481 秒。
- 真实 Electron 完成双输入上传、渲染、结果设为主图、默认 4096 放大；输出 4096×1720，放大约 273 秒。
- 重启后任务、图库和真实输出可回看。CF 实际进度已到达客户端；28% 时真实取消后显示已取消，任务状态 cancelled，旧错误已清除。Agent 指定任务取消不影响另一 UI 任务。
- 前端相关回归 137 项、桌面 24 项通过。最终安装版通过运行环境识别、真实历史图片与图库恢复，以及 Agent 401/200/403 验证。

完整包：G:\Agent\Vivida4free\VividCFPackages\vivid-comfy-0.3.0-win32-x64.zip，83,725,765,123 字节。SHA256 为 3bc3e8e8495f3b6901f57f8d184fc506f926cccaf5eadf0b327a339650530ff7。全部成员已逐文件 SHA256 与 ZIP CRC 校验。包不含输入输出、用户数据、片段或诊断插件。

原始证据见 .runloop/local-client-r10/evidence。R5/R8 停止记录、R7 夹具测试和早期安装包保留作恢复与对比，不作为本轮最终验收。

## 仍然延后的项目

引擎更新采用“客户端提示新版 → 打开夸克分享链接 → 用网盘官方客户端下载 ZIP → 回客户端导入 → 自动校验、安装和切换”，百度入口暂未开放。客户端与引擎分别显示版本、分别更新；不兼容时明确提示必须更新，并禁用本地出图。版本公告位于 updates/engine.json，客户端安装包入口为 GitHub Releases；引擎 0.3.2 支持客户端 0.6.1 与 0.7.0，客户端根据现用引擎建议全量或增量包。

当前源码已接入统一账号中心 https://www.vividai.com.cn/new-api，支持登录、资料刷新、会话恢复与退出；注册入口打开官方账号中心。本机真实登录与会话生命周期已验证，多电脑、到期与撤销场景仍待验收，详见 [账号对接记录与配合事项](docs/account-system-integration.md)。导入图库、输出目录和 Agent 接口位于“登录 / 账号弹窗 → 设置”，登录后可使用；未登录时任务、历史、图库及引擎操作均受登录校验约束。自定义标题栏的按钮与双击已验证，拖动与边缘缩放仍待人工确认。本地生成不扣额度；创意工坊保留界面且未开放。

## CF 打包

协议见 docs/runtime-package-contract-v1.md；模型来源见 docs/model-sources.md 及实际 CF 版本目录中的 local-models.json、parallel-downloads.json。开发工具必须显式传实际版本根目录：

```powershell
$cf = 'G:\Agent\Vivida4free\VividCFRuntime\versions\vivid-comfy-0.3.0'
& "$cf\python\python.exe" -s -X utf8 tools/package_runtime.py --source $cf --check-only
& "$cf\python\python.exe" -s -X utf8 tools/package_runtime.py --source $cf --version <新CF版本> --compatible-client 0.6.1 --local-only --acceptance-report <新版真实出图验收报告> --out G:/Agent/Vivida4free/VividCFPackages
```

托管确定后使用 HTTPS --archive-url 生成发布清单，部署 ZIP 与清单，再配置客户端清单地址。正式包必须通过模型清单和双工作流真实输出验收。

## 构建客户端

```powershell
$env:ELECTRON_BUILDER_CACHE = 'G:\PackageCaches\electron-builder'
npm --prefix desktop run pack
```

构建前在 client、desktop、tools/installer 安装各自的开发依赖。统一入口会构建前端、刷新轻量桌面资源并生成 NSIS 安装包；从 Git worktree 构建也输出到原仓库的固定 `release/installer`，禁止按版本、日期或轮次新建输出目录。可先运行 `node tools/build-installer.cjs --check` 核对来源与输出位置。

构建使用显式文件白名单，不包含 CF、模型或用户数据。安装器只检查目标目录占用，不按进程名杀其他版本。生成安装包不会自动安装或覆盖现用客户端。基线保留在 .local-baseline；未修改线上账号配置。

## Agent

默认 127.0.0.1:17861/v1，随机 Bearer 令牌存于用户数据目录。agentInfo 仅向网页返回端点与令牌文件路径，不暴露令牌值。接口提供能力、渲染和放大任务、状态与指定任务取消；没有任意工作流、命令执行或远程安装功能。真实验证覆盖无令牌 401、正确令牌 200、网页跨域 403，以及 UI 共用任务生命周期。内部 UI 默认 17860，CF 默认 18295。

客户端控制同样需要令牌且拒绝网页来源：`GET /v1/client` 查询版本、窗口状态及预览图 SHA256；`GET /v1/client/screenshot` 返回客户端自身 PNG 截图；`POST /v1/client/show-task` 只接受 `{taskId}`，将已完成结果显示到工作区；`POST /v1/client/shutdown` 接受 `{}`，仅在客户端和 CF 队列都空闲时正常退出，队列无法核实时拒绝退出。无任意代码、命令执行、桌面截图或远程安装入口。

本机可用 `node tools/agent-client.cjs status`、`capabilities`、`tasks`、`submit 请求.json`、`show-task 任务ID`、`screenshot 结果.png`、`shutdown` 调用。工具在本地私有配置内读取令牌，不打印令牌；可用 `VIVID_AGENT_CONTROL_FILE` 指定已有配置文件。

工作流使用私有原件构建并封装进客户端，构建前请阅读 [工作流封装与私有构建](docs/workflow-packaging.md)。公开源码不含本产品的完整工作流。
