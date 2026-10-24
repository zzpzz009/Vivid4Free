# 登录后的开屏动画

2026-10-25：客户端 0.7.0 的启动顺序为全屏登录、对应皮肤开屏动画、工作区。旧版本验收记录保留作追溯。

## 用户行为

- 从 0.5.1 起，开屏读取已保存的界面主题。经典深色使用原来的光带动画，海岛使用已确认的日出 Logo、小船与海鸥场景，slogan 为「让灵感，即刻成形」。
- 每次启动验证登录成功后播放当前主题动画，退出再登录同样播放。经典动画约 4.75 秒，海岛动画约 5.6 秒，随后淡入工作台。切换主题时不会打断当前操作，下一次启动验证登录成功后再播放。
- 可以点击「跳过」或按 Escape。正常完成或主动跳过后，只记录当前主题的完成标记，登录后的动画允许跳过；登录页没有跳过入口，Escape 不能进入工作区。
- 提前关闭客户端不会记录完成；动画加载或显示异常时最多等待 12 秒后退出开屏，不记录完成，下一次仍可重试。
- 已有账号必须向账号中心验证成功；验证失败停留在登录页，不加载工作区，也不播放动画。图库、任务和引擎位置保持原样。更新现有安装同样会在下一次打开时展示一次。

经典完成标记继续使用 `vivid-desktop:startup-intro:v1=seen`；海岛独立使用 `vivid-desktop:startup-intro:animal-island:v1=seen`。两者保存在客户端自身的 localStorage 中。0.7.0 的登录入口在验证成功后强制播放，完成标记不承担账号验证。升级保留已有经典标记，清除客户端用户数据会重置标记。

## 实现

`client/src/DesktopApp.vue` 统一控制登录、动画和工作区挂载，在登录后调用 `utils/startupOverlay.js`。动画模板和代码位于 `components/startup/`，仅首次展示时加载。开屏期间入口设置为 inert；完成后由主进程再次确认账号，再挂载工作区并启动引擎，同时清理动画计时器与临时文字层。

通过 Shadow DOM 隔离样式，JavaScript 以正常外部模块运行。未放宽客户端 CSP，也不使用 iframe、内联脚本或 eval。

海岛模板与动画分别为 `client/src/components/startup/island.html` 和 `island.js`，Logo 为 `client/src/assets/brand/island-logo.svg`。本地 Nunito 与 Noto Sans SC 就绪后再播放。太阳从 A 内部低位缓慢升至原 Logo 的上方位置并恢复光芒；海鸥沿闭合曲线盘旋，远侧从 Logo 后方、近侧从前方经过。海面、小船与海鸥持续运动到开屏移除，系统减少动态效果时展示静态版本。

独立预览位于 `G:/Agent/Vivida4free/logo-splash/island/index.html`，字体直接嵌入 HTML，直接打开时不再依赖 `fonts/` 相对路径。可通过 `node tools/build-island-preview.cjs ../logo-splash/island` 从客户端同源资源重建；预览只包含开屏和重播按钮，不包含配色或设计说明页面。

## 0.5.1 本机整合状态

源码与固定目录安装包已包含双主题开屏。本次源码合并前，162 项前端单元测试、39 项桌面测试、16 项皮肤与开屏浏览器回归、类型检查及桌面前端构建通过。此前安装包内真实 Electron 使用独立用户目录验证了经典首次播放、海岛首次播放、海岛再次启动跳过，以及返回经典后保留完成记录。原动画文件保持不变。

安装包为 `release/installer/VividDesktop-Setup-latest-x64.exe`，其 0.5.1 来源是较早的未提交工作区；本次源码合并不重建该包，不代表包内包含全部后续皮肤调整。当前固定安装目录的实际更新尚未执行：自动审批拒绝了正常关闭现用客户端并运行安装器的命令，仅返回 `blocked by policy`。需退出客户端后，手动运行该安装包并选择 `G:/Agent/Vivida4free/VividClient`，再验证实际安装入口；不能把安装包验收当作现用客户端已更新。

完整原安装回退副本位于 `.local-baseline/client-rollback/island-startup-0.5.1-before`，其 ASAR SHA256 与更新前安装一致。源码基线为 `9035a388d68ea9162e24c50eab0c839c2b0155a2`。本次原生检查、截图和回退校验记录位于 `.local-baseline/island-startup-integration/`，未复制真实账号凭据或修改外置 CF。

以下为先前版本的安装和验收历史。

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
