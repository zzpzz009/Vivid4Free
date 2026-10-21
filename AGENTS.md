# Vivid4Free 项目约定

## 项目边界

本仓库根目录是 VividDesktop，只管理客户端源码、轻量工作流、构建工具和文档。用户明确要求 CF 环境和 CF 运行包独立，不得提交或推送 Python 环境、ComfyUI、模型、模型片段、运行包 ZIP、生成图片、图库、任务数据、令牌或用户设置。不要对上级 G:\Agent 仓库操作。源码恢复基线与本机验证证据保留在已忽略的本地目录。

Windows 命令优先使用 pwsh.exe -NoProfile。只修改任务涉及内容，保留用户工作、正式发行文件和其他服务。

## 版本与推送规则

1. 客户端使用 MAJOR.MINOR.PATCH。主版本表示用户使用方式或兼容性发生重大变化；次版本表示新增用户功能；修订号表示修复或小幅体验改进。未发布的内部候选不单独列为用户版本。不要改写或复用已推送的版本标签。
2. 发布前同步 desktop/package.json、desktop/package-lock.json 和 release-info.json 中的客户端版本，并更新根目录 CHANGELOG.md。CF 独立版本不随客户端版本机械递增，只更新实际兼容信息。client/package.json 的旧上游界面包版本和 client/CHANGELOG.md 是组件历史，不是本客户端的发布版本。
3. CHANGELOG.md 面向使用者，用中文说明新增能做什么、操作变化、已解决的问题和仍存在的限制。不要把端口、依赖版本、节点实现或测试数量堆成用户版本说明。技术依据放到单独文档。
4. CHANGELOG.md 必须含对应版本与发布日期；release-info.json 必须记录客户端版本、发布类型、平台、CF 协议/兼容版本、账号和下载功能的实际可用状态。
5. 推送前执行 node tools/check_release.cjs，检查暂存文件中没有凭据、运行包、模型或构建产物，运行与修改相关的验证。仅提交明确属于本项目的内容。
6. 提交信息概括用户得到的变化。使用带说明的 vMAJOR.MINOR.PATCH 标签，标签说明同样面向用户，并指向该版本的发布提交。提交后检查工作区干净。
7. 先确认目标远端为 https://github.com/zzpzz009/Vivid4Free.git。新仓库首版推送 main；后续功能开发默认 codex/ 分支，合并和发布服从用户当前授权。没有明确授权不得强推、删除远端分支或覆盖标签。
8. 推送指定分支和对应标签，不用 --all 或 --mirror。推送后核对远端分支提交、标签及标签指向的提交与本地一致，再向用户报告版本、提交和仓库地址。

正式下载或账号未就绪时必须如实写明，不得用本机配置、测试夹具或预留入口声称用户已能使用。

## 固定安装包与安装位置

- 本机安装包唯一输出目录为 `G:\Agent\Vivida4free\VividDesktop\release\installer`，最新安装包固定入口为其中的 `VividDesktop-Setup-latest-x64.exe`；同时保留当前版本文件及 `latest.json` 中的版本、来源提交和 SHA256。
- 统一执行 `npm --prefix desktop run pack`。入口 `tools/build-installer.cjs` 即使从 Git worktree 构建，也按 Git 公共仓库位置输出到上述固定目录，不在 worktree 内另建发行目录；禁止自行指定 `r7`、`r10-*`、日期或轮次目录。
- 安装后的本机客户端位置固定为 `G:\Agent\Vivida4free\VividClient`，运行入口为 `VividDesktop.exe`。构建产物中的 `win-unpacked` 仅用于打包验证，不是日常启动位置。
- 发布新版本先构建并核验新包，再清理旧产物。现用安装、外置 CF、模型、图库、任务、账号数据、源码及回退证据不属于旧安装包清理范围。安装包和解包目录继续被 Git 忽略，不上传远端。
- 需要保留回退时，旧产物只归档到固定 `.local-baseline/installer-archive`，不得再把旧版本目录作为运行或构建入口。归档与永久删除、实际释放磁盘空间须分开报告。
- 安装包生成不等于现用客户端已更新。交付“最新版可打开”时，必须核对 `VividClient/resources/app.asar` 的实际版本与新包一致，并从固定 `VividClient/VividDesktop.exe` 启动验证目标界面；仅测试源码预览或包内文件不能替代此检查。更新现用安装前保留回退，并保留已有开屏、用户数据及外置 CF。
