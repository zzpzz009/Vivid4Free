# 首次使用开屏

2026-10-21 已将确认后的 Logo、柔光与共同文字过渡接入源码及本机安装客户端。

## 用户行为

- 当前 Windows 用户的客户端数据首次使用时播放一次，约 4.75 秒后淡入工作台。
- 可以点击「跳过」或按 Escape。正常完成或主动跳过后写入本地完成标记，后续启动直接进入工作台。
- 提前关闭客户端不会记录完成；动画加载或显示异常时最多等待 12 秒后退出开屏，不记录完成，下一次仍可重试。
- 已有账号、图库、任务、CF 位置和引擎状态不参与开屏判断。更新现有安装同样会在下一次打开时展示一次。

本地标记为 `vivid-desktop:startup-intro:v1=seen`，保存在客户端自身的 localStorage 中，不按客户端补丁版本重复播放。清除客户端用户数据会重置此标记。

## 实现

`client/src/main.js` 调用 `utils/startupOverlay.js`。动画模板和代码位于 `components/startup/`，仅首次展示时加载。开屏期间工作台设置为 inert；完成后恢复交互并清理动画计时器与临时文字层。

通过 Shadow DOM 隔离样式，JavaScript 以正常外部模块运行。未放宽客户端 CSP，也不使用 iframe、内联脚本或 eval。

本机安装版与工作区已有原生代码不同，为保留现有安装，只向原安装包新增 `ui/startup-intro.js`，并在 `ui/index.html` 加入启动入口。所有其他打包文件按字节保持一致。独立入口由同一份源码构建：

```powershell
node tools/build-startup-entry.cjs <输出文件>
```

安装目录为 `G:/Agent/Vivida4free/VividClient`。这是本机更新，未重发安装器、变更版本标签或推送远端。后续从源码正常构建时，开屏由主入口自动包含，无需再注入独立入口。

2026-10-21 后续安装同步：为修复固定启动入口仍显示旧导航栏的问题，已用包含当前开屏源码及新标题栏/账号设置的 0.4.0 本机预览包更新上述安装目录。开屏改为由主入口正常包含，未清除首次播放标记或其他用户数据。安装后的 ASAR SHA256 为 `6c7353e24249bbd57fb75cbfd91a430462ee01873d630e8ee52586c55e6613ca`，与新包一致；原安装完整回退保存在 `.local-baseline/client-rollback`。此前的独立注入回执仍作为历史记录保留。本次未新增 Git 标签或推送；最新本机包以固定 `release/installer/latest.json` 的实际 SHA256 和 `sourceDirty` 为准。

## 验证与恢复

前端 19 个文件、149 项测试通过，桌面前端构建通过。在真实 Electron 中，以独立用户目录验证以下 9 个场景：

| 场景 | 结果 |
| --- | --- |
| 安装版首次展示原动画并恢复工作台 | PASS |
| 同一用户目录重新启动不重复播放 | PASS |
| 主动跳过并保存完成记录 | PASS |
| 跳过后重新启动不重复播放 | PASS |
| 播放中关闭不记录完成 | PASS |
| 中断后重新启动重试播放 | PASS |
| 图片解码故障时自动退出，恢复交互且不记录完成 | PASS |
| 当前工作区源码构建首次播放 | PASS |
| 当前工作区源码构建再次启动不重复播放 | PASS |

测试仅使用独立用户目录，未运行安装版真实用户目录，也未消费用户下一次打开时的首次播放机会。

本地证据与原安装备份位于 `.local-baseline/startup-intro-20261021/`；其中 `package-diff.json` 验证安装包修改范围，`deployment.json` 记录落地路径与哈希。故障夹具与早期失败记录仅用于定位问题，最终故障结果见 `decode-stall-fallback-report.json`。

- 修改前工作区基线提交：`bb7f36ab8f68adc481b9166f28689f2442b71ada`，保留于 `refs/codex/baselines/startup-intro-20261021`；原未跟踪工具栏另存文件备份。
- 原安装 ASAR SHA256：`8167a1837ff3c5c2723d6c02b3bbf800a8416cb851c2d928ae2b0fc0dd72e76d`。
- 更新后 ASAR SHA256：`9a58e1df67fafa1ab08671399138d12cb23c5eff2428bc237e80d3656f5d2060`。

恢复安装版可在客户端退出后，用本地 `app-deployed-before.asar` 备份替换安装目录的 `resources/app.asar`。无需修改用户数据或 CF。
