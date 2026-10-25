# VividDesktop 外壳与 UI 契约 v1

契约版本 `1.0`；机器清单 schemaVersion `1`。抽取基线为 `30888a98217e7051c977ee5a30a3525f152e7516`。本文是行为语义的权威说明，`contracts/shell-contract.json` 是可机器核对的传输清单，不是完整 JSON Schema。目标是让 UI 通过宿主适配器使用相同能力；不以抽取契约为由修改现有业务、账号、CF 包或私有工作流。

2026-10-25 接口优先扩展：在原9个Agent路由记录上新增7个明确路由，共16个；原22个宿主请求、2个事件及22个UI路由记录保持不变。新增能力复用现有业务，显式路径替代目录选择器提供路径这一步；不提供任意脚本执行或通用文件读写。操作和验收优先使用Agent接口与CLI，不使用Computer Use或系统弹窗代点；界面交互细节由已有自动测试及截图能力说明覆盖。

本文中的 MUST/必须约束兼容实现。标为“现状/缺口”的行为也必须保留，直到单独批准的版本变更。源码依据：`desktop/preload.cjs`、`main.cjs`、`server.cjs`、`task-service.cjs`、`runtime-manager.cjs`、`account-service.cjs`；消费者依据为 `client/src/api`、账号 store、桌面入口、工具栏、运行包控制器和工作台任务编排器。没有读取实际凭据、用户数据或在线服务，也没有验证正式账号、下载源或真实出图可用性。

## 1. 边界、传输与权限

公共业务模型只能包含普通对象、数组、字符串、有限数字、布尔值、null，以及明确标出的 void。Promise、回调和退订函数属于调用接口；Error、DOMException、Response、Electron event/frame/window、文件句柄、密钥和账号 token 都不属于公共数据模型。HTTP 文件/截图是独立二进制响应，不编码进任务对象。

宿主逻辑方法名沿用 preload 的 22 个请求名和 2 个事件名。Electron 绑定将请求映射到下表 IPC channel；其他宿主可以替换绑定，但不得让业务组件依赖 ipcRenderer/contextBridge。迁移后的 `desktop/electron-adapter.cjs` 独占 Electron 对象、生命周期、窗口、IPC、对话框、系统浏览器与 clientControl；`desktop/main.cjs` 消费宿主提供的 userData/version/executablePath/fetch/secureStorage/clientControl/openWorkspace/run 等宿主能力，不导入 Electron。preload 为 sandbox 入口，保留显式白名单，不依赖加载普通本地 CommonJS 模块来获得传输清单。前端业务通过 UI 侧适配器消费同一逻辑方法；这两侧适配不改变下文行为。

现有 IPC 调用以 Promise 交付；没有统一 `{ok,data,error}` 包装，没有全局 abort 参数。拒绝通过传输层失败表达，UI 可将本地异常转为显示文案，但不能把异常对象持久化为业务状态。兼容期不得把 void/string/boolean 的成功结果悄悄改成对象。

访问级别：

| 标识 | 必须满足 |
| --- | --- |
| `trusted-sender` | 当前宿主窗口的主 frame；Electron 中 sender 必须等于当前窗口 webContents，senderFrame 必须等于 mainFrame，frame URL 必须以当前 UI origin 加 `/` 开头。iframe/其他窗口不能调用。 |
| `signed-in` | `trusted-sender`，且账号状态严格为 `signed_in`。checking/unavailable 均不可通行。 |
| `ui-public` | UI HTTP Host 校验通过；仅明确列出的 GET 壳资源免账号。 |
| `ui-signed-in` | UI HTTP Host/Origin 规则通过，且账号 signed_in。 |
| `agent-token` | Agent HTTP Host/Origin/Bearer 校验通过。 |
| `agent-signed-in` | `agent-token` 且账号 signed_in。 |

权限检查失败不能被成功结果掩盖。IPC 非法来源拒绝“`不允许的调用来源`”，未登录拒绝“`请先登录客户端`”。每次请求重新检查账号；账号无独立推送事件。服务实际只监听 `127.0.0.1`。

## 2. 22 个宿主请求

表中 `()` 为无参数，`R` 为拒绝 Promise（仅传输失败，非公共 Error 模型）。账号业务失败和打开链接失败按下面说明 resolve 状态，而不是一律 R。所有请求都可能因宿主关闭或传输断开失败；这不证明副作用未发生。

| 方法 / IPC channel | 参数 | 访问 | 成功/业务失败返回、取消与副作用 |
| --- | --- | --- | --- |
| `windowState` / `window:state` | () | trusted-sender | `WindowState`。 |
| `windowAction` / `window:action` | `action: 'minimize' \| 'toggle-maximize' \| 'close'` | trusted-sender | **void/undefined**。最小化；全屏时 toggle 退出全屏，否则切换最大化；close 关闭窗口并触发退出。其他 action R“`不支持的窗口操作`”。无取消确认对象。 |
| `accountStatus` / `account:status` | () | trusted-sender | `AccountSnapshot`；只读取内存状态，不自动刷新远端。 |
| `accountLogin` / `account:login` | `{username:string,password:string}` | trusted-sender | `AccountSnapshot`。用户名 trim 后发出；原始用户名与密码各不超过 200 字符，用户名 trim 后非空，密码非空。多余键当前被忽略。非法输入返回当前 snapshot 加提示。登录并验证账号 context 后才 signed_in。无取消 API。 |
| `accountRefresh` / `account:refresh` | () | trusted-sender | `AccountSnapshot`。无 token 返回当前状态；同一 revision 的刷新合并；退避期返回当前状态。 |
| `accountLogout` / `account:logout` | () | trusted-sender | `AccountSnapshot`。先清本机登录，远端注销不确定时仍返回本机退出与未确认文案；本机记录清理失败返回 unavailable。不会通过此操作停止引擎或取消任务。 |
| `accountResetPassword` / `account:reset-password` | () | trusted-sender | `{opened:true}` 或 `{opened:false,message:string}`。只打开校验后的官方 HTTPS 页面；用户在浏览器的后续完成情况不回传。 |
| `accountRegister` / `account:register` | () | trusted-sender | `{opened:boolean,message:string}`。并发打开合并；注册需浏览器完成，再回客户端登录，不等于自动登录。 |
| `enterWorkspace` / `app:enter` | () | signed-in | `{entered:true}`。有运行包则异步尝试启动引擎；返回不等待引擎 ready，也不是能力验收。 |
| `importGallery` / `gallery:import` | () | signed-in | 原生目录选择；取消 `{added:0,cancelled:true}`，成功 `{added:number,total:number}`。仅目录直接子文件，支持 png/jpg/jpeg/webp/gif/bmp；以内容 SHA256 去重。文件系统失败 R，可发生部分写入，不能自动重试推断回滚。 |
| `agentInfo` / `agent:info` | () | signed-in | `{endpoint:string,tokenFile:string,version:'1.0'}`。endpoint 为 Agent origin + `/v1`，tokenFile 是本机凭据文件路径，**不含 token 值**。不可把路径当远端资源 URL。 |
| `openOutput` / `output:open` | () | signed-in | **string**：空串表示打开成功，非空为宿主打开失败说明；打开当前运行包（否则用户目录）的 output。底层异常可 R。 |
| `runtimeStatus` / `runtime:status` | () | signed-in | `RuntimeStatus` 加 `engineReady:boolean,clientUpdateConfigured:boolean`。 |
| `runtimeCheck` / `runtime:check` | () | signed-in | `RuntimeStatus`（不保证带上述两个扩展字段）；失败先更新状态再 R。并发 check 合并；安装中拒绝。不是安装动作。 |
| `runtimeOpenDownload` / `runtime:open-download` | `provider: 'quark' \| 'baidu', noticeAccepted: true` | signed-in | `{opened:boolean,message:string}`。每次跳转前界面展示根 NOTICE 全文，用户主动勾选同意；主进程严格要求 `noticeAccepted === true`，未同意不打开页面。当前 baidu 明确未开放；quark 需已检查且有配置，操作忙时失败；未知 provider 作为未配置失败。打开页面后由用户手动下载 ZIP，不自动下载或安装。 |
| `clientOpenUpdate` / `client:open-update` | () | signed-in | `{opened:boolean,message:string}`。选择已检查发布链接或内置策略链接，要求 HTTPS 且无用户名密码；仅打开页面。 |
| `runtimeInstall` / `runtime:install` | () | signed-in | `{runtime:RuntimeStatus,engine:{ready:boolean,error:string\|null}}`；安装/校验/启动失败 R。已有 install 合并，check 中拒绝。未检查则先 check；只有网盘入口时提示手动下载后导入。暂停导致原安装调用拒绝，之后读状态。 |
| `runtimePause` / `runtime:pause` | () | signed-in | **boolean**：存在下载 controller 时发 abort 并返回 true，否则 false。true 表示请求暂停，**不代表所有安装/校验/激活均已停止**；不是任务取消。 |
| `runtimeImportArchive` / `runtime:import-archive` | `file: absoluteZipPath` | signed-in | 用户手动填写或粘贴已下载 ZIP 的完整路径；不弹出文件选择器、不自动搜索或下载。主进程拒绝缺失、非字符串、NUL、相对路径和非 `.zip` 后缀。成功 `RuntimeStatus`。复用 `manager.importArchive(file)` 的实体文件、官方包结构、发布哈希、独立存储目录、兼容性、激活与回退校验；失败 R。 |
| `runtimeConnectDirectory` / `runtime:connect-directory` | () | signed-in | 目录选择；取消 `{cancelled:true}`；成功 `RuntimeStatus`。须有效官方 runtime.json，普通 ComfyUI 目录不能接入；校验/激活失败 R。 |
| `chooseRuntimeDirectory` / `runtime:choose-directory` | () | signed-in | `{cancelled:boolean,status:RuntimeStatus}`。取消也带当前状态；目录非法时宿主显示警告并重开选择器，直到有效或取消。 |
| `startEngine` / `runtime:start-engine` | () | signed-in | `{ready:true,message:string}` 或 `{ready:false,message?:string,error?:string}`；实际启动/能力检查失败通常 R。未安装、兼容不成立等可 resolve ready:false。同一根目录启动合并，不同根目录并发启动拒绝。 |

`accountStatus/Login/Refresh/Logout` 的操作内部意外失败被宿主转成当前 snapshot + `status:'unavailable'` 与通用提示；来源校验在此捕获之外，仍拒绝。不可把 `unavailable` 当作已登出成功。注册与找回入口校验在宿主内完成，密码、token 和跳转校验实现不下沉至 UI。

## 3. 2 个宿主事件、生命周期

| 订阅方法 / channel | 回调负载 | 时序与退订 |
| --- | --- | --- |
| `onWindowState(callback)` / `window:state-changed` | `WindowState` | 最大化/恢复、进入/离开全屏触发；不保证最小化发事件，无首次快照或重放。先订阅，再调用 windowState 获取初值。返回同步 `unsubscribe():void`，仅移除此订阅；同一退订重复执行应无害。 |
| `onAgentTask(callback)` / `agent:show-task` | `Task` | Agent show-task 校验完成任务有结果后发送，随后显示窗口。只传 task，不传 IPC event。没有队列、重放、ACK 或送达保证；UI 未订阅时会丢失。返回相同退订约定。 |

UI 卸载必须退订、清 timer、停止本地轮询与回调写状态。运行包 manager 的内部 change 不是公共事件；UI 当前每 1800ms 调 runtimeStatus，任务约每 1000ms GET，工作台能力每 20000ms GET。间隔属于当前消费者策略，不是服务端 SLA。AbortSignal 只取消当前 HTTP 等待/本地轮询；不取消已到达服务端的任务或 IPC 操作。无宿主桥接时必须给出不可用状态，不伪造成功。

## 4. 公共数据模型

字段的 `?` 表示可能缺失；null 与缺失不同。时间是 ISO 8601 字符串。实际持久化历史记录没有统一 schema 迁移/严格输出过滤，消费者应容忍附加字段。不得推断未返回字段一定为 false。

### WindowState / AccountSnapshot

`WindowState = {maximized:boolean,fullscreen:boolean}`。

`AccountSnapshot = {status:'signed_out'|'checking'|'signed_in'|'unavailable',profile:AccountProfile|null,persistent:boolean,message:string,retryAfterSeconds:number,lastCheckedAt:string|null}`。

`AccountStatus = 'signed_out'|'checking'|'signed_in'|'unavailable'`，供脱敏Agent账号刷新响应复用。

`AccountProfile` 的宿主白名单为 `id,username,nickname,email,companyName,userNameComplete`，各可能为 string/number/boolean（字符串最多 250 字符）；上游 company.name 可映射 companyName。至少有有限 number id、非空 string id 或非空 username 才构成有效身份。这里是现有宽类型，不应编造成固定完整用户实体。UI 的 `desktopAccount.safeSnapshot` 另行只保留 `userId,id,username,displayName,nickname,avatarUrl,emailMasked,role,companyName` 中 string/number 字段，故宿主 email/userNameComplete 不进入该 UI snapshot；本次不合并两套白名单。

登录恢复先 checking，context 验证才 signed_in；401/403 清本机会话到 signed_out，其余刷新异常 unavailable；429 退避 1–3600 秒。revision 防止 logout 后旧登录/刷新覆盖新状态。persistent 仅表示本机安全存储成功，不能用于授权。signed_in 由最近验证的本机状态决定，并非每次任务都在线校验；lastCheckedAt 可供显示，当前未实现固定离线过期时间。

### RuntimeStatus

| 字段 | 类型/枚举与含义 |
| --- | --- |
| `state` | `not_installed,installed,checking,downloading,verifying,installing,paused,starting,ready,error` 之一。 |
| `installed,available` | boolean；已接入包/已取得发布清单，均不等同于引擎可出图。 |
| `version,availableVersion` | string|null。 |
| `storageDir,activePath` | 本机绝对目录 string|null，不是 URL。 |
| `downloadedBytes,totalBytes,progress` | number；progress 为当前阶段百分比，不是整条流程单调进度。 |
| `message,error` | string 与 string|null；error 是文案，绝不是异常对象。 |
| `updateCheckState` | `not_checked,checking,checked,failed`。 |
| `clientRelease` | null 或 `{version:string,downloadUrl:string,notes?:string[],supportedRuntimeVersions?:string[]}`；已验证的发布对象可能包含附加字段。 |
| `clientUpdateAvailable,updateAvailable` | boolean，当前版本与已检查发布结果比较。 |
| `releaseNotes` | string[]。 |
| `downloadSources` | `{provider:'quark'|'baidu',label:string,url:string,extractionCode:string,enabled:boolean}[]`；当前仅 quark enabled。 |
| `clientVersion` | string|null。 |
| `supportedRuntimeVersions,compatibleClientVersions` | string[]。 |
| `compatibilityNote,compatibilityMessage` | string。 |
| `runtimeCompatible,availableCompatible` | boolean|null；null 表示尚无对应信息。 |
| `runtimeCompatibilityState,availableCompatibilityState,failedCompatibilityState` | `'supported'|'incompatible'|'unverified'|null`。 |
| `availableCompatibilitySource` | `'client-policy'|'engine-manifest'|'protocol'|null`。 |
| `recommendedPackage` | `'incremental'|'full'`；建议不代表增量包校验已通过。 |
| `incrementalBaseVersion` | string|null。 |
| `fullPackageBytes,incrementalPackageBytes` | number|null。 |
| `downloadConfigured` | boolean；配置存在不证明网络可用。 |
| `engineReady?` | boolean；runtimeStatus IPC、Agent GET runtime 和 HTTP capabilities.runtime 包含；其他 manager 返回未必包含。 |
| `clientUpdateConfigured?` | boolean；runtimeStatus IPC 与 Agent GET runtime 加入；HTTP capabilities.runtime 及其他 manager 返回未必包含。 |

校验/安装/接入互斥；操作结束应重新读取 runtimeStatus。runtime 状态转换不是严格无环状态机：检查结束可能把 ready 改为 installed，进度在各阶段重置。切包仅允许独立目录、受支持的协议/平台和明确客户端兼容组合；需要校验文件、空间和包完整性。切换前若旧引擎在运行，必须证明归本宿主所有；未知/外部引擎阻止切换。现有队列门闩在 HTTP 成功并解析 JSON 后只检查 `(queue.queue_running || []).length || (queue.queue_pending || []).length`，**未校验两个字段均为数组**：`{}` 或两个字段为 null 都会放行并进入停止旧引擎步骤。因此不能宣称切包已经严格证明队列为空；这与 Agent shutdown 的显式数组校验不同。新包激活保留输入/输出，启动失败尝试恢复旧设置和旧引擎；恢复失败可合并文案返回，不可报告自动回退保证成功。

### TaskInput / Task / Capabilities / GalleryImage

`TaskInput` 仅允许以下键，其他键 400；JSON 请求可以只提供适用字段，但当前验证允许另一 kind 的已知字段存在且忽略其工作流映射：

| 键 | 约束/默认行为 |
| --- | --- |
| `kind` | 必需 `'render'|'upscale'`。 |
| `mainImage` | 必需已上传图片的单一文件名：string 非空、≤255 字符，无 `..` 子串、冒号、正反斜杠、NUL/控制字符。不是磁盘路径/URL。 |
| `referenceImage` | render 必需，同 mainImage 规则；upscale 当前不验证此字段类型/名称且不用于工作流，消费者不要发送。 |
| `prompt` | 可选 string ≤16000；render 缺省为空串。 |
| `seed` | 可选非负安全整数；render 缺省 0，upscale 缺省保留内置模板。指定 upscale seed 作用于全部随机阶段，部分阶段使用 seed 模 2^32。 |
| `mirror,addScene` | 可选 boolean；render 默认 false/true。 |
| `referenceStrength,colorMatchStrength,denoise` | 可选有限 number，0–1；render 前两者默认 1/0.285403；upscale denoise 缺省保留模板。 |
| `size` | 可选有限 number，512–16000，**当前不要求整数**；仅 upscale 使用，缺省模板值。 |
| `requestId` | 可选 string，正则 `^[a-zA-Z0-9_-]{16,128}$`；调用方应始终提供稳定的幂等键。 |

`Task = {id:string,requestId?:string,kind:'render'|'upscale',parameters:TaskInput,status:TaskStatus,progress:number,createdAt:string,title:string,workflowId:'render'|'upscale',input:{floorplanImage:{filename:string,type:'input'},styleImage:{filename:string,type:'input'}|null},resultImages:string[],promptId?:string,stage?:string,errorMessage?:string,completedAt?:string,output?:{imageUrl:string,resultUrls:string[]}}`。

`TaskStatus = submitting|queued|running|submission_unknown|completed|failed|cancelled`；终态仅 completed/failed/cancelled。id 为宿主 UUID；promptId 是引擎标识，不可拿它代替客户端 task id 去取消。resultImages/output URL 均为 UI origin 相对路径（典型 `/view?filename=...&subfolder=...&type=output`），不带 Bearer。不保证所有失败都有 completedAt。render 的进度按两个阶段加权、上限 99，completed 才 100；upscale 当前直接报告节点百分比，可能回退，且内部 progress 监听未同样阻止终态更新；不可把 progress==100 当作完成。

`Capabilities = {version:'1.0',engine:boolean,account:'deferred',billing:'local-free',runtime:RuntimeStatus|null,capabilities:{render:{ready:boolean,missing:string[]},upscale:{ready:boolean,missing:string[]},gallery:{ready:true},creativeWorkshop:{ready:false}}}`。`account:'deferred'` 是旧能力字段固定值，**不是绕过登录的依据**；实际权限仍由 AccountSnapshot 决定。ready 联合检查运行根目录、engineReady、引擎响应、内置工作流、所需模型与节点；没有真实调用不能据此宣称正式出图验收。

`GalleryImage = {id:string,name:string,filename:string,url:string,path:string,createdAt:string}`；id 是文件 SHA256，name 为原始 basename，filename 为 hash+扩展名；url/path 都是 `/gallery/{filename}`。

## 5. HTTP 通用协议与访问矩阵

UI 默认 `http://127.0.0.1:17860`；Agent 默认 `http://127.0.0.1:17861`。测试门控显式允许临时端口（包括 0 分配端口），Host/Origin 必须使用实际端口，不能硬编码 localhost 或默认端口。UI 默认无 Bearer；Agent Bearer 是本机控制令牌，与账号 token 完全不同，每次宿主启动生成并写本机控制文件。不得读取/输出 token 到 UI、日志或本文。

| 请求 | Host | Origin | Bearer | 账号 |
| --- | --- | --- | --- | --- |
| UI GET 壳资源 `/`,`/index.html`,`/THIRD-PARTY-NOTICES.txt`,`/assets/*` | 精确 `127.0.0.1:实际UI端口` | GET/HEAD 不校验 | 不要求 | 不要求 |
| UI 其他 GET/HEAD | 同上 | 不校验 | 不要求 | signed_in |
| UI POST/其他非 GET/HEAD | 同上 | 必须精确 UI origin，缺失/null/异源均 403 | 不要求 | signed_in |
| Agent 任意请求 | 精确 `127.0.0.1:实际Agent端口` | 任何非空 Origin 均 403；必须省略（现有实现空串也通行） | 精确 `Bearer {token}`，长度与常量时间比较；无效 401 | 见逐路由表 |

UI 校验顺序为 Host → 非 GET/HEAD 的 Origin → 账号 → 路由；Agent 为 Host/Origin → Bearer → 路由/账号。因此未登录未知 UI 路径通常先 401；来源错误不能通过带 token 补救。无跨源 CORS/OPTIONS 预检开放。账号登录/注销不是 HTTP 路由，只能经宿主接口。

服务自己产生的 JSON：`Content-Type: application/json; charset=utf-8`，`Cache-Control: no-store`；错误体统一 `{error:string}`。已知 HTTP 错误保留 status/message，其他意外错误 500 `{error:'本地服务暂时不可用'}`。已开始写流后失败会断流。常见状态：400 参数/JSON、401 账号/令牌、403 来源、404 未开放/不存在、405 方法、409 状态冲突、413 JSON 超限、415 Content-Type、500 意外故障、502 上游提交缺少 prompt_id、503 依赖/队列不可确认。提交后的某些错误被记录到 Task，并以 **202 Task** 返回，而非顶层 HTTP 错误。

JSON body 解析器要求 Content-Type 以 `application/json` 开头，最大 1 MiB，空 body 当 `{}`，非法 JSON 400。是否接受 null/数组由具体路由决定。任务取消路由不解析 body，允许空 body，无需设置 JSON Content-Type，但 UI Origin 仍必须正确。

### UI 17860 路由

| Method | Path / 别名 | Body/query | 成功状态与响应 |
| --- | --- | --- | --- |
| GET | `/api/desktop/capabilities` | 无 | 200 `Capabilities`。 |
| GET | `/api/desktop/tasks` | 无；无分页/筛选 | 200 `{tasks:Task[]}`；刷新所有非终态。 |
| POST | `/api/desktop/tasks` | JSON `TaskInput` | 202 `{task:Task}`；幂等命中也 202，task 可已终态或 submission_unknown。 |
| GET | `/api/desktop/tasks/{id}` | id 正则 `[a-zA-Z0-9-]+` | 200 `{task:Task}`；缺少任务 404。 |
| POST | `/api/desktop/tasks/{id}/cancel` | 不解析 body | 200 `{task:Task}`；见取消语义。 |
| **ANY（现状）** | `/health`,`/api/system/status` | 不解析 body | 200 `Capabilities`。实现没有 method 条件；不是免账号探活。写方法仍需 Origin。 |
| GET | `/api/jobs`,`/api/history`,`/api/history/recent` | 可选 status；`processing` 匹配 running；page/limit 等当前忽略 | 200 `{success:true,data:{jobs:Task[],total:number}}`，顺序最近创建优先。 |
| GET | `/api/jobs/{id}`,`/api/jobs/{id}/results`,**`/api/jobs/{id}/cancel`** | id 同上 | 200 `{success:true,data:Task}`；GET cancel 仅查询，**不取消**。 |
| GET | `/api/jobs/{id}/logs` | id 同上 | 200 `{success:true,data:[]}`；先确认任务存在/刷新，不提供引擎日志。 |
| POST | `/api/jobs/{id}/cancel` | 不解析 body | 200 `{success:true,data:Task}`。 |
| GET | `/img/images` | limit 默认1000并限制1–5000；page默认1并取≥1 | 200 `{success:true,images:GalleryImage[],pagination:{page,limit,total}}`；按 name 的 zh-CN 排序。现状非数字 query 可导致 NaN 切片和 JSON null，不作为推荐输入。 |
| POST | `/img/meta` | JSON 数组 `[{url:string,...}]` | 200 `GalleryImage[]`；仅匹配 url，非数组当空数组，未知忽略，重复保留；数组 null 项当前可能 500。 |
| POST | `/img/filter-by-urls` | JSON 数组 `[{url:string,...}]` | 200 `{success:true,images:object[]}`；返回匹配图库 URL 的**原输入对象**，不是替换为 GalleryImage；非数组为空，null 项可能 500。 |
| GET | `/gallery/{filename}` | 路径解码 | 200 图片/文件原始字节；路径须在图库根内且是文件，否则404。 |
| GET | `/view`,`/system_stats`,`/queue`,`/object_info`,`/history` 及各自 `/*`；均有 `/comfy` 前缀别名 | 原查询串透传 | 原样转发上游状态、Content-Type 与响应流；非统一 JSON 包装。 |
| POST | `/upload/image`,`/comfy/upload/image` | multipart/form-data 字节流 | 原样转发上游状态、Content-Type 与响应流；通常 200 `{name,subfolder,type}`，实际形状由引擎决定。 |
| GET | `/`,`/index.html`,`/THIRD-PARTY-NOTICES.txt`,`/assets/*` | 无 | 200 静态文件；不存在404，公开壳资源无需登录。 |
| GET | 其他未被 API/代理匹配的本地静态路径 | 无 | signed_in 后从 UI 目录读取文件；非 SPA 任意路径回退，缺失404。 |

静态文件设置按扩展名的 MIME 和 `X-Content-Type-Options:nosniff`；UI 静态响应附加同源 CSP。**HEAD 现状**：公开资源通过免账号判断，但最终静态处理要求 GET，因此 HEAD 返回405；其他 HEAD 先账号检查，`/health` 和 `/api/system/status` 特例命中 ANY（HTTP 层不发送 body）。这不是抽取时顺便修复的范围。未知 `/api/*`、`/comfy/*` 返回404“接口未开放”；普通未知路径非 GET 返回405。

### Agent 17861 路由

| Method | Path | 账号 | Body | 成功状态与响应 |
| --- | --- | --- | --- | --- |
| GET | `/v1/capabilities` | 必须 | 无 | 200 `Capabilities`。 |
| GET | `/v1/tasks` | 必须 | 无 | 200 `{tasks:Task[]}`。 |
| POST | `/v1/tasks` | 必须 | JSON `TaskInput` | 202 `{task:Task}`。 |
| GET | `/v1/tasks/{id}` | 必须 | 无 | 200 `{task:Task}`。 |
| POST | `/v1/tasks/{id}/cancel` | 必须 | 不解析 | 200 `{task:Task}`。 |
| GET | `/v1/client` | 不要求 | 无 | 200 `ClientStatus`；窗口状态新增maximized/fullscreen/bounds，详见下文，旧字段保留。 |
| GET | `/v1/client/screenshot` | 不要求 | 无 | 200 **PNG 字节**，Content-Type image/png、Cache-Control no-store；窗口不存在503。截图可能包含当前登录页或用户内容，不适用于网页访问。 |
| POST | `/v1/client/show-task` | 必须 | 严格 JSON `{taskId:string}`，仅一个键，id 同上 | 200 `{selectedTaskId:string}`；任务必须 completed 且 resultImages 非空，否则409；窗口不存在503。返回只证明宿主已发事件/显示窗口，不是 UI 已渲染确认。 |
| POST | `/v1/client/shutdown` | **不要求** | 推荐空 JSON 对象 `{}`；现状判断为 `!input`、数组或有可枚举键则拒绝，未校验对象类型，因此 `true` 和非零 JSON 数字（如 `1`）也被接纳；null、false、0、字符串、数组、非空对象被拒绝 | 202 `{exiting:true}`；body 通过后仍须通过任务/队列门闩。响应完成后安排退出，进程实际退出须外部观察。详见安全退出。 |
| GET | `/v1/client/runtime` | 必须 | 无 | 200 `RuntimeStatus`；实际运行包状态，不以模拟ready替代。CLI `runtime-status`。 |
| POST | `/v1/client/runtime/check` | 必须 | 严格 `{}` | 200 `RuntimeStatus`；复用原更新检查，不下载安装。CLI `runtime-check`。 |
| POST | `/v1/client/runtime/connect-directory` | 必须 | 严格 `{directory:absolutePath}` | 200 `RuntimeStatus`，保留manager.connectDirectory原返回；复用校验和激活/回退，不绕过现有包完整性失败。同当前activePath时，原方法完成目录/runtime.json验证后直接返回状态，不重新哈希全部文件。CLI `runtime-connect 绝对目录`。 |
| POST | `/v1/client/account/refresh` | 必须 | 严格 `{}` | 200 `{status:AccountStatus,signedIn:boolean}`；只回脱敏状态，不回profile、message或凭据；业务刷新失败可返回unavailable/signed_out，signedIn仅当status为signed_in才true。CLI `account-refresh`。 |
| GET | `/v1/client/output` | 必须 | 无 | 200 `{path:string,exists:boolean}`；path为已有输出目录逻辑计算的本机绝对路径；查询不创建/修改目录、不返回目录内容。CLI `output-info`。 |
| POST | `/v1/client/output/open` | 必须 | 严格 `{}` | 200 `{path:string,exists:boolean,opened:boolean,error:string\|null}`；原生打开成功时opened=true/error=null，失败文案为字符串，不含Error对象；没有UI确认回执。CLI `open-output`。 |
| POST | `/v1/client/gallery/import` | 必须 | 严格 `{directory:absolutePath}` | 200 `{added:number,total:number}`；复用已有图库导入，仅直接子文件、相同格式限制与内容去重；不递归。CLI `gallery-import 绝对目录`。 |

`ClientStatus = {version:string,window:{available:boolean,visible:boolean,maximized:boolean,fullscreen:boolean,bounds:{x:number,y:number,width:number,height:number}|null},workflowSha256:string,operations:string[]}`。bounds为窗口屏幕坐标和大小（宿主逻辑像素），窗口不可用时为null；新增字段只描述状态，不开放任意窗口动作。operations列出 `status,screenshot,show-task,shutdown,runtime-status,runtime-check,runtime-connect,account-refresh,output-info,open-output,gallery-import`。CLI的 `task 任务ID` 和 `cancel 任务ID` 仅映射原有GET任务/POST定向取消，不增加路由。

`tools/agent-client.cjs` 的runtime-connect等待上限为300秒，其余命令30秒；超时只中止HTTP等待，不是业务取消或失败证明。新路由的成功body均直接返回表中对象，不包裹data/result。

新增7路由一律保持loopback Host、禁止网页Origin、Bearer及signed_in四重条件，不因读取输出路径或刷新账号而免登录。新POST的严格对象校验拒绝null、数组及所有primitive；`{}`只允许零个键，directory对象只允许directory一个键，值须为非空string、无NUL、满足宿主绝对路径规则，relative/空值/多余键返回400。JSON解析器仍将空body按`{}`解析；严格body约束只对新增路由生效，不顺便修正旧shutdown接纳primitive的现状。目录存在性、文件类型、运行包完整性及业务兼容性继续由原业务校验，不把路径格式合法等同于可接入。

新5个控制POST（check/connect-directory/account refresh/output open/gallery import）共享互斥门闩，并与任务提交和客户端退出互斥，冲突返回409。任何新控制POST进行中不能接受新的UI/Agent任务提交或shutdown；提交/退出/另一新控制POST正在处理时也不能开始新控制POST。成功或失败都须释放控制门闩；已有运行任务仍按原运行时激活队列/所有权规则保护，不能把“无正在提交HTTP请求”当作引擎空闲。GET状态查询不占该门闩；这不是对其他进程、所有原生IPC调用或共享引擎的全局事务锁。

新路由异常继续使用公共HTTP错误包络；参数错误400、账号状态不满足401、互斥409、宿主能力缺失503，未分类业务异常500且不泄露内部异常。HTTP200的account refresh必须读取status/signedIn，output open必须读取opened/error，不能一律判业务成功；取消本地HTTP等待也不保证接入/导入副作用未发生。目录接入与图库导入不是通用任意文件写入或读取接口；只向既有受控目录写已有业务输出。

所有 `/v1/client*` 均先要求宿主提供 clientControl，否则503；未知 client 控制路径404。其余 Agent 路径进入任务路由，先账号检查，再验证 `/v1/` 前缀和路由，未知版本/路径404。Agent新增的是本机图库目录导入，不提供图库文件、静态文件、图片上传或图片下载路由，不能将 `/view` 相对 URL 直接拼到17861；访问图像需使用满足UI来源/账号规则的UI origin。

## 6. 图片、上游与未开放接口

上传消费者构造 FormData：`image` 为 File，`type='input'`，`overwrite='true'`。必须让浏览器生成带 boundary 的 Content-Type，不能手填 application/json。代理原样流式转发 multipart，不解析/过滤字段，宿主 JSON 的 1 MiB 限制不适用于此流；未实现独立上传体积上限。上游负责其余校验。调用方使用上游返回 name/filename 提交任务，不能传 blob URL、本机路径或完整 Comfy graph。读取 `/view` 得到二进制，不能使用 JSON 解码工具。

图库/任务结果/输入预览采用相对 URL；UI 的 API base 当前为空表示同源，不是公网 API 配置。代理 GET 超时15秒，上传60秒；响应仅明确透传 status、Content-Type，并加 nosniff，不保证上游其他头、缓存或 Range 语义。不存在 WebSocket 的 UI 公开代理。

上游默认 `http://127.0.0.1:18295` 是 Vivid 官方 CF/Comfy 运行包，不是任何标准 ComfyUI 都能替换的承诺。任务服务内部使用 GET `/system_stats`,`/object_info`,`/history/{promptId}`,`/queue`；POST `/prompt` 与项目专用原子取消 `/api/jobs/{promptId}/cancel`；内部 `/ws?clientId=...` 收进度。UI 不直接控制这些写接口。兼容性依赖内置工作流对应节点、指定模型/大小与 sampler/scheduler 选项；没有列入公共任务参数的节点、图内容、模型目录或工作流源不开放给 UI。

明确未开放：旧 `/api/generate`、任务直接创建旧入口、任务删除/统计、全局 `/interrupt`、清空 queue、free/unload、任意 prompt、任意代理、工作流编辑、`/api/gallery/*` 分类/修改/收藏等、旧 systemAPI/resultsAPI 中没有 server 对应路由的操作。源码保留旧 helper 不代表接口存在。只允许上表白名单；不要因迁移外壳补开旧 API。

## 7. 幂等、未知提交、取消与退出

正常提交顺序：上传图片 → 获取 capabilities → POST TaskInput（稳定 requestId）→ 202 task → GET 同一 task 直到终态 → 根据相对 URL 读取结果。宿主先验证/构图/能力检查，再把 submitting 记录落盘，再发上游 prompt。HTTP 202 不等于引擎接受或成功出图。

同 requestId 的已落盘任务立即返回原记录，参数不同409；不会重新提交。持久化记录比较对对象键排序，但同一进行中的 inFlight 比较当前使用 JSON.stringify 原顺序，**键序不同可能409**；调用者应保持完全相同 payload。缺省值与显式默认值也不视为同参数。无 requestId 不保证去重。幂等不是支付式 exactly-once：网络中断可能已提交；不能换 requestId 自动重试。

上游网络异常无已知 status → submission_unknown；已知上游错误 → failed；缺少 prompt_id 当前为 failed 并保留“提交状态待确认”文案（实现与状态名不完全一致，不能静默修正）。有 promptId 但 node_errors 时尝试原子取消；确认取消记 failed，否则 submission_unknown。无 promptId 的 unknown 不会自动恢复/重投；客户端按 requestId GET 列表对账，找不到仍应保留未知。GET/list 会查询上游历史和队列；短暂不一致会再查一次，仍无记录标 failed，且不自动重新提交。读取上游失败可能让整个 list/get 返回错误，不是空任务列表。

取消只针对本客户端已记录 id。不存在404；终态直接返回原任务；无 promptId 返回409“提交状态尚未确认，不能中断其他任务”。原子取消上游返回 cancelled:true 才标 cancelled，完成结果优先于稍后取消；未确认则查历史，仍不能确认409。不调用全局 interrupt，也不取消碰巧正在运行的其他任务。浏览器 Abort、轮询停止、登出、runtimePause 都不能替代 task cancel。

Agent shutdown 在设置退出门闩前检查无并发提交和新控制POST；有并发提交/控制操作/已在退出409。设置门闩后拒绝新的任务POST和新控制POST；刷新任务列表，存在任何非终态（包括 submitting/submission_unknown）409；再检查上游 queue_running/queue_pending 都是数组且为空。队列非空409，不可获取/非预期结构503，失败撤销门闩；成功发送202，响应 finish 后请求宿主退出。此流程不是对外部进程的原子队列锁，无法阻止别的客户端随后向引擎提交。

**窗口 close/系统退出现状与 Agent shutdown 不同**：窗口 close 不执行上述任务/队列门闩。宿主退出路径尝试 pause → 关闭本地服务 → 只停止本宿主启动并拥有的引擎；已有外部引擎不应被停止。此清理为 best-effort，捕获失败后仍退出；不能宣称每次关闭都确保任务安全结束。本次只记录差异，不改变窗口交互。

## 8. 兼容策略、验证与已知缺口

1. 语义版本主版本才可删除/改名 channel、方法、必需字段或改变返回联合、授权和取消含义；新增可选字段可向后兼容，读取方忽略未知字段。HTTP `/v1` 和能力 `version:'1.0'`、Agent info `version:'1.0'` 均保留；没有运行时协商 IPC 版本接口，不能假定宿主/UI 可任意跨版本组合。
2. 宿主适配器保留 22 方法的参数转发、Promise resolve/reject 与两事件的退订；UI 适配器集中能力发现、不可用处理，不在业务组件中导入 Electron。保留现在账号专用安全快照，不扩散秘密，不统一改造所有返回为新 envelope。
3. JSON 清单需与实际绑定核对方法/channel/access、事件、HTTP method/path/alias；文档负责参数、状态、顺序与异常语义。清单的路径占位符/通配符是描述，不授权更多路径；`ANY` 仅记录两个现状路由。
4. 验证应覆盖 IPC 来源/账号矩阵、22 请求多种返回、退订、HTTP Host/Origin/Bearer、请求格式、任务幂等/未知/取消、运行包状态和真实 UI 消费。使用隔离夹具与临时端口，不读取生产凭据、不更改 CF/私有工作流。静态清单一致不等于正式账号、引擎和打包客户端已验收。
5. 已知缺口除前文现状外还包括：IPC 没有统一结构化错误码/超时/取消；事件无重放/ACK；任务 list 无分页且受单项刷新失败影响；资源 relative URL 依赖 UI origin；任务输入 upscale 的 referenceImage 宽松；状态/进度/时间字段不完全规范；没有自动恢复无 promptId 的未知提交。需另立变更需求，不能在“外壳替换”中默默修补。
