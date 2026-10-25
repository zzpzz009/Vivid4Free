# 清单与签名发布

`updates/release-source.json` 是兼容信息和公开引擎目录的编辑入口。执行 `node tools/generate-release-metadata.cjs` 同步 `desktop/client-runtime-policy.json`、`updates/engine.json` 及 `release-info.json` 的兼容声明；构建与 `check_release.cjs` 都检查是否过期。0.7.0、0.7.1 已在 0.3.2 清单中。0.3.1 是增量升级基线，尚未完成当前客户端直接运行验收，不因存在增量包就自动加入运行白名单。

## 更新目录

清单仅提供版本、兼容关系、下载地址、大小和校验信息。客户端安装包仍从 GitHub Release 下载，引擎仍从夸克下载，大文件流量不经过清单主机。

`desktop/runtime-feed.json` 支持按顺序读取至多四个 `manifestUrls`。单个来源连接、正文读取的超时均受 15 秒信号约束；HTTP 错误、无效 JSON、无效清单都触发下一源；每份清单仍须通过原有字段校验和 1MiB 上限，不允许重定向。也可在私有构建/运行环境用逗号分隔的 `VIVID_RUNTIME_MANIFEST_URLS` 指定来源，旧的单一 `VIVID_RUNTIME_MANIFEST_URL` 继续支持。

2026-10-25 已上线阿里云 ECS 静态主源，客户端源码按以下顺序读取，GitHub 继续保留以适应不同网络：

1. `https://app.archai.vip/vivid-updates/engine.json`
2. `https://raw.githubusercontent.com/zzpzz009/Vivid4Free/main/updates/engine.json`
3. `https://cdn.jsdelivr.net/gh/zzpzz009/Vivid4Free@main/updates/engine.json`

阿里云通过 Nginx 静态返回 `/var/www/vivid-updates/engine.json`，配置片段为 `/etc/nginx/snippets/vivid-updates.conf`，仅在 `app.archai.vip` HTTPS server 内引入。支持 GET/HEAD，其他方法拒绝，缓存 60 秒；没有新增后台服务、容器或本机回连依赖。配置模板见 `tools/hosting/vivid-updates.conf`。

每次发布都从同一个生成结果同步阿里云与 GitHub 的 `updates/engine.json`，不得独立编辑线上文件。先校验生成结果，再在阿里云同目录写临时文件并原子替换；GitHub 仍按正常源码发布流程更新，jsDelivr 从 GitHub 获取且可能有缓存延迟。本次阿里云与 GitHub raw 均返回 HTTP 200，正文均为 2,842 字节，SHA256 一致；jsDelivr 在当前 Windows/curl 网络下 TLS 握手失败，保留备用配置但不将其计为该网络下已验证可用。

部署前的 Nginx 配置备份保存在服务器 `/root/vivid-updates-backup-20261025T012014Z/app-https.conf`，同目录 `receipt.json` 记录变更前后配置及清单哈希。回滚仅需恢复这个 server 配置，执行 `nginx -t` 后 reload Nginx；不要改动现有业务服务或隧道。线上及回退实测证据保存在本机 `.local-baseline/distribution-hardening/manifest-deploy/`。

已用客户端实际采用的 Electron `net.fetch` 与源码 `RuntimeManager` 实测：正常状态只请求阿里云；在测试传输层故意拒绝主源后，真实请求 GitHub raw 并成功取得同一 SHA256 的清单，两种场景均解析出引擎 0.3.2 / 客户端 0.7.1。该测试使用独立临时用户目录，不启动引擎或修改现用客户端。

## Windows 发行签名

`npm --prefix desktop run pack` 要求正式签名凭据，并启用 electron-builder 26 的 `signExecutable` 与 `forceCodeSigning`。使用私有环境中的 `WIN_CSC_LINK` / `CSC_LINK` 和对应密码变量，或 Windows 证书库的 `VIVID_SIGNING_CERT_SHA1`；不得将证书、私钥或密码写入仓库。

使用标准 NSIS 脚本时，electron-builder 会签署主程序、卸载程序和最终安装包。不要把现有 include 换成绕过卸载程序签名的自定义 NSIS script。SHA256 配合 RFC3161 时间戳；打包后的 EXE 和最终安装包还须通过 Windows Authenticode 信任及时间戳验证后才更新固定 latest 入口。没有证书时构建提前失败，保留已有安装包；真实受信任签名和 SmartScreen 表现尚需正式证书与实际安装验收，不能以配置变更冒充完成。

根 LICENSE 延续现有自有代码 UNLICENSED 状态，不替版权方选择新的开源授权。引擎声明及尚未完成的来源/授权核查见根 `ENGINE-NOTICES.md`。

## 前端与本地产物

`apiUtils` 的 JSON 和 Blob 请求具有包含正文与只读重试等待的总超时：读取默认 15 秒，写入默认 150 秒；调用方可传 `signal` 取消。只读请求对暂时网络故障及 408/429/502/503/504 最多重试一次，写请求不自动重试。工作台提交、对账、轮询及取消复用此入口，离开组件时停止查询。

当前桌面服务没有 WebSocket 升级接口，原有两套 WebSocket 均无法连接，故移除两套实现并沿用任务查询，不额外增加第三套通道。旧写端点不再自动回退到 `/prompt`、`/interrupt`、`/free` 或 POST `/queue`；GET `/queue` 仍是已实现的只读代理，保留。模拟引擎及模拟任务仅在开发模式加载，生产产物需检查不含模拟引擎事件与旧提交路径。

任务 store 使用现有 factory 风格，拆为 `submissionApi`、`submissionQueue`、`submissionActions`、`resultActions`、`records` 和 `inputPayload`，轮询继续由原 `queueLogic` 管理，并抑制慢请求造成的重叠查询。

历史产物归档位置与恢复映射记录在 `docs/local-artifacts.md`。今后 `desktop/prepare-ui.cjs` 的 UI/旧工作流备份写入仓库外的 `VividPrivate/artifacts/desktop-ui`。固定发行入口、正式引擎、用户数据、依赖与指定安装包回退目录保留原位。

## 本次验证与尚未交付项

源码基线为 `7882b88551c8e55252e26a56b350a8fbfc9d602b`，工作分支 `codex/distribution-hardening`。2026-10-25 已通过前端 172 项测试、桌面侧 80 项测试、引擎打包 7 项 Python 测试、类型检查与生产构建。生产 JS 检查未包含模拟引擎事件、WebSocket 构造和旧 `/comfy`、`/api/uploads`、`/api/queue`、`/prompt` 路径。

生产构建在独立 Chromium 中使用合成桌面桥验证四种情况：经典皮肤增量建议、海岛皮肤全量建议、640px 海岛增量建议、不可兼容下载源禁用导入。包含真实按钮点击和失败提示检查，无溢出或页面异常。证据位于仓库外 `VividPrivate/artifacts/distribution-hardening-ui-20261025/receipt.json`，属于 `isolated_integration`，不等同于现用安装版或真实新电脑出图验收。

ECS `47.98.179.158` 的清单主源已上线，Nginx 配置校验后仅执行 reload。部署前后既有首页、工程库和 Facade 健康入口的 HTTP 状态保持一致，未重启业务服务或隧道。主源顺序已写入客户端源码，但尚未构建、安装或发布包含该配置的新客户端，现装版不会因修改源码自动切换。签名流水线已接通且拒绝无凭据构建，正式代码签名证书仍未提供；未产生受信任签名包，未替换固定安装包或现用客户端，未推送或发布新版本。
