# CF 独立运行包接口 v1
客户端版本0.6.0；runtimeProtocol=1；Windows x64。
新电脑接入流程见 [接入与更新](cf-onboarding.md)。客户端新增两个无路径参数的桥方法 runtimeImportArchive()、runtimeConnectDirectory()，文件和目录仅由主进程原生对话框选择。离线包读取 ZIP 内部 runtime.json 并逐文件验证；已有版本目录校验全部声明文件，允许运行后产生的日志、缓存和输出。
runtimeStatus 另返回 downloadConfigured、updateAvailable、activePath、downloadSources、clientVersion、supportedRuntimeVersions、runtimeCompatible、availableCompatible、compatibleClientVersions、compatibilityMessage。settings 中 activeStorageDir 固定当前托管版本的位置；external=true 表示显式接入的独立目录，均需通过路径与清单检查，不使用开发环境 fallback。未来安装位置可独立修改。启动还需通过任务服务已有的双工作流能力检查。
发布配置 desktop/runtime-feed.json: {"schemaVersion":1,"manifestUrl":null}。正式URL未给出时显示未配置；测试可用主进程VIVID_RUNTIME_MANIFEST_URL与VIVID_RUNTIME_ALLOW_LOCAL_TEST=1启用仅127.0.0.1的HTTP，不接受renderer传任意URL。
发布清单字段：schemaVersion=1,id="vivid-comfy",version(安全字母数字点横线),protocolVersion=1,platform="win32-x64",archive={url,bytes,sha256,unpackedBytes},entry={python:"python/python.exe",launcher:"tools/start_comfy.py"},requiredFiles(相对路径数组)。网盘分发时 archive.url=null，新增 downloads 数组与 compatibleClientVersions；legacy 直链配置保持兼容，但界面采用外部网盘下载再导入的统一流程。

downloads 最多两项，每项为 {provider:"quark"或"baidu",url:"官方HTTPS分享链接",extractionCode:"可选提取码"}；同一 provider 不重复。仅接受 https://pan.quark.cn/s/<id> 和 https://pan.baidu.com/s/<id>，拒绝用户名、密码、非标准端口和其他主机。必须至少有一个有效下载入口。runtimeOpenDownload(provider) 只接收网盘类型，主进程从已检查发布清单取链接后调用系统浏览器，不接收 renderer 任意 URL。提取码在入口旁显示。网盘续传和登录由网盘官方客户端负责。

当前渠道策略仅启用夸克：runtimeStatus.downloadSources 各项带 enabled，百度固定为 false；面板置灰并隐藏其提取码，runtimeOpenDownload('baidu') 返回“暂未开放”。仍解析百度的合法清单以兼容旧发布数据。tools/package_runtime.py 的 --quark-share-url 和可选 --quark-extraction-code 可生成仅含夸克的发布 JSON，不能与 --archive-url 或 --local-only 混用。

compatibleClientVersions 为经过真实组合验收的前端确切版本数组，例如 ["0.6.0"]；网盘发布清单必须声明，并通过 tools/package_runtime.py --compatible-client 写入 ZIP 内 runtime.json（可重复参数声明多个已验证版本）。同一个 ZIP 可以同时放夸克和百度；两个渠道须下载同一内容并匹配同一个 archive.sha256。导入已获取发布信息的 ZIP 时，在解压前校验整个归档大小和 SHA256，并检查内部版本与发布版本一致。

客户端自带 client-runtime-policy.json，包含已知兼容 CF 版本数组 supportedRuntimeVersions、必要的组合备注和可选前端安装包入口 clientDownloadUrl。前端版本从应用本身取得，不硬编码到 UI。新 CF 可以通过自身兼容声明支持未改版的前端，重启后仍能判断；前端升级后不匹配的旧 CF 会提示必须更新，并拒绝启动引擎及通过任务服务出图。前端安装包与 CF ZIP 分别更新；clientOpenUpdate() 打开配置的 HTTPS 安装包发布入口。版本信息、网盘链接、前端安装包入口未配置时必须明确显示未就绪，不填演示地址冒充正式渠道。
ZIP根直接是python/、comfyui/、models/、custom_nodes/、llama/、tools/start_comfy.py，以及runtime.json。runtime.json含schemaVersion,id,version,protocolVersion,platform,entry,compatibleClientVersions,files:[{path,bytes,sha256}]。运行包制作工具拒绝缺原模型/节点，不发布演示包。测试夹具明确标为fixture，不宣称真实渲染通过。

双包发布保持全量 archive 不变，并增加可选 incremental:{baseVersion,baseManifestSha256,filename,archive:{url:null,bytes,sha256,unpackedBytes}}。incremental.archive.unpackedBytes 仅为补丁载荷展开量；全量 archive.unpackedBytes 为最终完整目录的展开量。增量仍从同一夸克目录下载，不通过 GitHub 分发。旧客户端忽略 incremental 后仍可使用全量 archive。发布工具添加 --base-archive <上一版官方完整ZIP> 即同时制作两种包，基线清单直接取该ZIP的 runtime.json 原始字节。

增量 ZIP 根包含与目标全量 ZIP 完全相同的 runtime.json、delta.json 以及变化文件。delta.json={schemaVersion:1,baseVersion,targetVersion,baseManifestSha256,files:[变化文件相对路径],removed:[已移除相对路径]}。runtime.json.files 始终列出完整目标清单。导入根据 delta.json 自动区分包类型；匹配发布信息中对应归档后，基础版本必须与现用版本及其 runtime.json 原始字节哈希一致，变化/删除清单必须与基础和目标清单推导结果一致。完整验证基础文件后，仅按目标清单复制旧文件及补丁文件到独立暂存目录；额外载荷被拒绝，删除项不复制。新版完整校验通过才复用原激活与失败回退逻辑。基础版本不需要支持新客户端，目标版本必须支持。增量安装不在旧版目录覆盖或删除文件，不使用硬链接；磁盘预算同时包含完整新版和补丁解压空间。
安装位置为用户选择的storageDir/versions/vivid-comfy-<version>；用户设置和激活指针在Electron userData。下载片段/storageDir/downloads，暂存解压/storageDir/staging；绝不清空任意目录或覆盖当前激活版本。文件名/ZIP路径/链接及清单内路径须校验；大小和SHA正确、内部清单及entry/requiredFiles完整之后原子激活。磁盘检查包括下载与解压，失败不更换指针。
主进程预加载桥六个无任意路径/URL参数方法：runtimeStatus(),runtimeCheck(),runtimeInstall(),runtimePause(),chooseRuntimeDirectory(),startEngine()。choose使用原生目录框；runtimeInstall成功后由主进程启动引擎；进度由runtimeStatus轮询。runtimeStatus返回{state,installed,available,version,availableVersion,storageDir,downloadedBytes,totalBytes,progress,message,error}；state包括not_installed/checking/downloading/paused/verifying/installing/installed/starting/ready/error。
后台API兼容：startServer新增runtimeRoot(路径获取函数)、workflows(客户端内存资源加载器)、runtimeStatus(状态获取函数)，旧测试默认root/runtime仍可。生产root=Electron.userData，仅持久图库与tasks；production workflows=desktop/workflow-store.cjs 加载内置 engine-data.dat；无旧项目root探测。任务服务动态取已激活runtimeRoot/models，未安装时返回不可用。/api/desktop/capabilities附runtime字段；Agent共用。
引擎启动调用已激活包entry.python和entry.launcher，进程环境VIVID_RUNTIME_DIR=安装根；只有本客户端启动的项目引擎能停止，保留psutil身份/端口检查。开发测试可以主进程VIVID_RUNTIME_DEV_PATH显式接现有runtime，不得作为生产默认fallback；不改变其他CF服务。

客户端 0.6.1 起，CF ZIP 不再包含产品 workflows 目录；验收使用仓库外私有原件，客户端负责提交执行图。详见 workflow-packaging.md。
