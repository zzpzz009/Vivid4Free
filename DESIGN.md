---
name: "VividDesktop-design"
description: "VividDesktop 当前界面的设计与实现规范；新增 UI 按本文件登记已有实践，保持既有视觉与状态连续性。"
---

# VividDesktop 设计规范

## 0. 适用范围与基线

本文件规范 `VividDesktop/client` 桌面应用的既有界面和新增 UI。视觉基线为原界面提交 `d9cf096`，可对照 `.archi-coo/ui-standard-r15/before-1280.png`。后续修改优先还原并保持该界面的颜色、布局、密度、文案和交互；把原来未登记的 UI 实践写入本规范，属于标准化，不代表重设计。此优先级要求零视觉变化的修复。

只有新增界面或用户明确授权重设计时，才提出其他视觉方向；新增方向不得反向改写当前界面规则。实现记录须区分源码中已经存在的类/组件与尚未实现的建议，不把建议写成当前强制组件。

2026-10-20 用户授权重设计顶部一排菜单，该区域按 §1.2 的当前规范覆盖原并排按钮方案；工作区及其他面板继续遵守原界面基线。

后续用户明确要求将导入图库、输出目录、Agent 接口收进账号弹窗内的设置，并以自定义顶栏替换 Windows 原生标题栏；这些区域按本文件当前登记的实现为准。

真实桌面入口是 `client/src/main.js`，它创建并挂载 `client/src/DesktopApp.vue`。`client/src/App.vue` 不是该入口的桌面主界面。

## 1. 既有视觉基线

### 1.1 M3 表面与颜色

工作区沿用 `client/src/assets/styles/variables.css` 的 Material 3 scheme：页面底色 `--schemes-surface: #141218`，容器 `--schemes-surface-container: #211f26`，最低层容器 `#0f0d13`，容器高层 `#2b2930`，主文字 `#e6e0e9`、次级文字 `#cac4d0`、主紫 `#d0bcff`、紫色主容器 `#4f378b`。主操作容器沿用 `--primary-container: #b6f298`，其文字色 `--on-primary-container: #062102`。状态色与图像/模式角标可按原有语义呈现，不套用“每页最多两种颜色”等会抹掉既有区分的限制。

桌面顶栏在 `DesktopToolbar.vue` 中沿用原有局部颜色常量：`#201e25` 背景、`#393640` 下边线与分隔线、`#2d2a33` 按钮 hover/展开底色，以及原引擎状态绿/暖黄色。菜单表面、边线、焦点使用 M3 tokens；新增 UI 优先使用上述 tokens，不扩散新的硬编码颜色。

整体保持原深色工作台；浅色导航选中块和取消按钮是已登记的局部变体。不得将它们扩展为浅色主主题，也不得因统一深色而把这些局部变体改掉。配色以具体组件基线为准。

### 1.2 顶栏与工作区导航

- 顶栏由 `DesktopToolbar.vue` 实现，高 52px、左右 padding 各 18px，沿用原 `#201e25` 表面、细下边线和左侧品牌 `VividDesktop / 本地 AI 渲染`。右侧业务入口仅为运行环境状态和账号入口，其后为最小化、最大化/还原、关闭窗口三个自定义窗口按钮。不再保留顶部“更多”菜单；顶栏重设计仅限此排，不调整下方工作区。
- 运行环境入口合并状态点与短文案：真实就绪时为“引擎已连接”，未安装时为“安装运行包”，其他未就绪状态为“引擎未就绪”。绿色/暖黄色状态点沿用原状态色；完整原因放在 title 与可访问名称中，点击打开既有运行环境面板，不用静态颜色伪造就绪。
- 账号保留原人像线框图标；未登录显示“登录 / 注册”，其他状态去掉重复“账号：”前缀，已登录显示真实用户名，过长省略但 title 保留全称；点击仍打开既有账号面板。运行入口和账号之间用 16px 高的细分隔线，不重复增加描边胶囊。
- 顶栏业务按钮高 32px、圆角 7px、12px 字、16px 线框图标、左右 10px 内距；默认透明底，hover/展开时使用原 `#2d2a33` 表面，键盘 focus-visible 使用 M3 主紫描边。
- 桌面使用 `frame: false` 去掉系统标题栏，移除原生菜单栏，保持可缩放边框和原窗口尺寸限制。原 52px 顶栏同时承担窗口拖动；整条使用 `-webkit-app-region: drag` 和 `user-select: none`，业务入口和窗口按钮所在操作区使用 `no-drag`，不得让拖动区域吞掉点击。
- 自定义窗口按钮宽 36px、高 32px、7px 圆角、14px 线框图标，相邻间距 2px，与业务入口之间留 8px 和细分隔线。关闭 hover 使用 M3 error-container/on-error-container，其他按钮沿用原暗色 hover。保留清晰的 title、aria-label 和键盘操作；最大化/还原图标跟随真实窗口状态，包含系统触发的最大化变化。
- 窗口拖动、拖动区双击最大化/还原、边缘缩放以及系统关闭快捷键保留系统窗口行为；自定义最小化、最大化/还原和关闭通过已有主进程来源校验后的固定动作调用，关闭沿用既有退出清理。窗口 API 不暴露任意系统命令或任意 IPC 通道。拖动区不再加自定义右键菜单，以免覆盖系统窗口菜单行为。
- 767px 以下顶栏仍保持单行 52px，左右内距 12px，隐藏品牌副标题，账号名最大 88px；通常尺寸账号名最大 140px。不通过改工作区布局来为顶栏腾空间。
- 工作区导航由 `WorkspaceHeader.vue` 渲染。主导航横向占满可用宽度；选中项 `.nav-tab-active` 是 `200×35px` 浅色块，使用对应原图标与文字。不要强制所有选中态使用紫色，也不要将主导航重画为侧栏。
- 右侧“常用”“图库”入口各占 120px，沿用原 M3 容器、选中样式及展开/收起箭头。
- `DesktopApp.vue` 的工作区上方留白和 `WorkspaceHeader.vue` 的自身间距属于原布局。没有对应源码值时不得补造统一间距规格。

### 1.3 左侧输入区与操作

`UnifiedSidebar.vue` 是当前输入侧栏实现。总宽通过 `--workspace-sidebar-total-width: 297px` 控制；内部上传卡宽 265px、高 182px（多图时最小高度 182px），卡间沿用 16px gap/margin。上传卡片圆角为 8px，上传后预览按原 `object-cover` 裁切；卡片是 M3 容器上的单一上传/预览面，不增加原界面没有的外层分割面板或装饰层。

高级参数展开区宽 265px、字段纵向 gap 20px。保留当前字段顺序、字号与紧凑密度。随机种子输入的底色、placeholder“输入种子...”和聚焦样式按原实现；提示词区域高 137px、placeholder“在此输入提示词...”。这些是固定基线尺寸，不能以泛化组件规则替换。

主操作使用 M3 浅绿 `#b6f298` 与深色文字；取消操作保留浅白底和紫色文字。生成/预览带下拉时，右侧分段宽 30px、使用原箭头和分隔边。不得套用“所有次按钮必须深色”等一刀切规则。

### 1.4 右侧内容、历史、比较与预览

- 历史区由 `HistorySection.vue` 实现：卡片为 `165×165px`，间距 12px；折叠/展开容器高度分别为 177px 与 531px。保留当前图片、真实运行状态和操作菜单的呈现。
- 历史区灰色占位块是 `Math.max(0, 12 - displayItems.length)` 生成的原有纯空槽：无 status、无点击行为。当前补充的 `aria-hidden` 是不改变外观的可访问性修复，并非原始提交已具备的属性。空槽不代表记录、结果或成功状态；任务状态必须来自实际数据。
- `ImageComparison.vue` 保留现有原图/结果标签和 28px 拖动滑块。滑块、标签辅助比较，不覆盖主要图像内容。
- 图片操作菜单沿用现有 M3 浮层与 8px 圆角，顺序为“预览 → 设为主图 → 设为参考图 → 查看原图 → 复制链接”。`ImagePreviewModal.vue` 是已有图片 lightbox，按现有遮罩和预览行为使用。
- 对话框允许已有运行环境等运行时配置面板，以及图片 lightbox。该例外不构成新增常驻面板或重绘工作区的授权；确认型 Dialog 仍只用于会中断操作的确认。
- `StatusBar.vue` 底部保持原细分隔线、左右 16px 边距和原状态行间距。

### 1.5 滚动条与按需样式

`main.css` 已定义点状滚动条及其 hover/active 状态；沿用 `variables.css` 中 8px 尺寸、3px 点半径和关联颜色 token。保留 `scrollbar-width: auto`、`scrollbar-color: auto` 声明以及 WebKit 细化规则，避免改变非 WebKit 浏览器现有原生表现。

PodUI 样式、Element/运行时面板样式按实际加载页面和控件使用。不得通过扩大全局选择器或无条件重置，把局部规则强行应用到所有页面、原生控件和第三方控件。现有页面验证无视觉变化时，才可收敛重复样式。

### 1.6 字体、密度与图标

沿用 `client/tailwind.config.js` 中的 M3 字体和排印：正文 `Roboto-Regular`，标签/标题 `Roboto-Medium`，强调标签/标题 `Roboto-SemiBold`，均有 sans-serif 回退。不新增远程字体请求或替换平台回退字体。正文 14px、辅助文字 12px、小标签 11px、模块标题 16px；具体行高和字重继续取同名 M3 token，不对所有控件强设一个字号。

顶栏按钮按 §1.2 使用 12px 文案和 7px 圆角；旧账号胶囊的 `rounded-corner-medium` 不再用于重设计后的顶栏。上传提示、种子字段和历史标题使用各自原 M3 class。工作区原 SVG 图标、24px 导航/历史图标、箭头方向和显示位置保持不变，不统一换成一套新图标。

4/8/12/16/20/24 等间距为常用尺度，已有的 3/5/6/10/18/22/26px 等局部值也属于已登记做法。按各处原 class/CSS 复用，不因间距尺度统一而挪动原控件。键盘可用性可通过语义、隐藏标签或不影响布局的命中区补齐，不能因此增大可见图标或行高。

### 1.7 已有浮层与反馈的具体变体

| 区域 | 既有外观与加载范围 | 来源 |
|---|---|---|
| 账号入口/表单 | 顶栏入口按 §1.2；右上账号卡宽 400px、24px 内距、24px 大圆角，原有局部深色玻璃表面，输入高 40px；登录行动用局部 PodUI `#ACF387`，注册入口为次操作，不套用工作区 `#b6f298` 去重配色 | `DesktopToolbar.vue`、`AccountPanel.vue` 及其 scoped PodUI 样式 |
| 账号内设置 | 账号弹窗标题区增加“设置”入口；点击在同一张卡片内切换到设置，提供“返回账号”。设置只含导入图库、输出目录、Agent 接口，按此顺序排列；行高至少 44px、8px 圆角、16px 线框图标、12px 字、左右 12px 内距，透明底、沿用卡片 hover。未登录也可访问本机设置，切回账号保留原表单行为；关闭后重开默认回到账号页 | `AccountPanel.vue`；事件由 `DesktopApp.vue` 连接到原动作 |
| 运行环境 | 原居中遮罩，最大宽 620px、18px 圆角，内容 padding 22px 26px 18px；原 `V` 标识和渐变保留；主操作是已有紫色按钮，最小高 37px、8px 圆角，不改成统一浅绿或右上常驻抽屉 | `RuntimeEnvironmentPanel.vue` 的 template/scoped CSS |
| 运行状态 | 原状态胶囊、下载/校验进度、成功绿/错误红/暂停暖色使用本面板既有颜色和文案；状态必须来自运行包接口，不将样式颜色当作就绪证明 | 同上 |
| 图片 lightbox | 全屏暗遮罩、四周 16px 留白、最大宽 `max-w-5xl`、最高 90vh、8px 外壳；保持原关闭/设图/查看原图工具条与缩放平移行为 | `components/ui/ImagePreviewModal.vue` |
| 图片菜单 | 8px 外圆角、M3 surface 背景/outline-variant 边线、8px 内距；项为 12px 字、8px 内距、原小圆角 hover；统一已登记的五项顺序，保持各区域可用动作子集 | `GalleryPanel.vue`、`FavoritesPanel.vue`、`HistorySection.vue` 的基线菜单 |
| 顶栏操作短反馈 | 右下方、距右 18px/底 52px，padding 10px 14px、8px 圆角，原局部 `#393540` 表面，约 4.5 秒；普通操作反馈不改为全屏面板 | `DesktopApp.vue` 的 `.desktop-notice` |
| Toast | 既有右上通知组件；保留原内外壳、淡入/退出和渐变进度边框。原 success/error/warning/info 分别有绿/红/黄/蓝语义色，不能按“只允许紫/绿”重新配色；原 4 秒旋转边框仅属于该反馈组件 | `components/ui/Toast.vue` |
| 底栏状态 | 12px 状态点、11px M3 小标签，原 idle 文案 `Ready`；排队、执行进度、失败等来自任务数据；不增加新的常驻产品宣传或账号说明行 | `StatusBar.vue` |

这些变体只适用于原本的场景。账号、运行环境和图片预览可保留不同的容器尺寸、圆角及焦点实现；登记为具体变体后，不再把这种差异当作待统一的违规。

### 1.8 窗口与资源呈现

桌面保持顶栏、工作区导航、左输入、中画布、右资源、底栏的原顺序。右资源紧凑宽来自 `--right-toolbar-controls-width: 288px`，展开为 360px，保留原滚动容器和 16px 外边距。中央对比图使用 `object-contain`，上传和历史缩略图按原裁切方式显示，不能为了组件一致而改图像适配方式。

常用桌面宽度以原布局为准。640/768/1024/1280 为当前验证尺寸，不应声称原始提交已经具备后加的全部响应式行为。当前窄窗适配允许导航收紧、右资源按需浮出；顶栏按 §1.2 保持单行。输入侧栏默认仍可见并保持原卡片尺寸、原 24px 导航图标，不自动隐藏或改成带装饰边框的抽屉。输入侧栏仅由用户点击既有菜单入口收起。窄窗适配不得反向改变常用桌面宽度的外观。

对比标签的原 22em 透明定位区可保留，但不得吞掉滑动或图片操作；无外观的 `pointer-events` 修复不算重新设计。

## 2. 组件与样式复用

### 2.1 当前源码已有的实现

实际存在并可按对应区域用法复用：`DesktopToolbar.vue`、`UnifiedSidebar.vue`、`WorkspaceHeader.vue`、`HistorySection.vue`、`ImageComparison.vue`、`RightPanel.vue`、`StatusBar.vue`、`ImagePreviewModal.vue`，以及 `components/podui/PodButton.vue`、`PodInput.vue`、`PodPanel.vue`、`PodToolbar.vue`。全局既有类包括 `nav-tab-active`、`primary-button`、`secondary-button` 和 `.history-placeholder` 等；使用前以 baseline 源码及本文件登记的区域变更为准。

优先复用具体页面已经使用的 M3 token、Tailwind 扩展、类和组件。已有控件的实际样式优先于抽象的统一圆角、按钮或面板规则。不要只为满足文档而改写页面结构。

### 2.2 新增组件建议

`SidebarField`、`SidebarSection`、`SidebarUploadCard` 等名称在原界面基线中没有被采用，不是实现要求。改造候选中即使出现同名封装，也不代表可以替换原页面的默认外观。只有在具体新增/改动有复用收益且能保持原视觉时，才考虑抽取；抽取不得引入新的默认尺寸、颜色或圆角。

弹层、菜单和对话框复用已有实现与对应页面样式。新组件 API 可沿用项目现有 props/event 命名，但不得为了形式统一造成当前 DOM、交互或视觉变化。

## 3. 状态连续性与可访问性

标准化须保留状态含义与现有工作流：空槽不代表任务完成；生成、排队、取消、失败、成功分别呈现真实业务状态。菜单、预览和对比控件应继续作用于当前选择的图像。

原图、当前结果、对比位置、输入参数、右侧资源状态及历史映射属于需要连续保护的工作现场；切标签或刷新时避免丢失。跨组件状态由既有 UI/业务 store 持有，临时 hover/菜单定位保持局部状态。缓存不得保存密码、令牌或用任务占位伪造真实结果。

保留可见焦点、键盘操作、可读文案或 aria 语义以及 reduced-motion 支持。无障碍修复采用不改变既有视觉的方式；确需影响视觉时，作为新增设计变更提出并依据用户明确范围处理。

## 4. 实现映射与变更规则

| 用途 | baseline 源码 |
|---|---|
| 桌面入口与顶栏 | `client/src/main.js` → `client/src/DesktopApp.vue`；当前授权改造顶栏为 `client/src/components/DesktopToolbar.vue` |
| M3 tokens 与基础样式 | `client/src/assets/styles/variables.css`、`client/src/assets/styles/main.css` |
| 工作区导航 | `client/src/components/WorkspaceHeader.vue` |
| 左侧上传、参数与主操作 | `client/src/components/UnifiedSidebar.vue` |
| 历史与图像比较 | `client/src/components/HistorySection.vue`、`client/src/components/ImageComparison.vue` |
| 右侧内容与底栏 | `client/src/components/RightPanel.vue`、`client/src/components/StatusBar.vue` |
| 图片 lightbox | `client/src/components/ui/ImagePreviewModal.vue` |
| 桌面局部布局与颜色 | `client/src/DesktopApp.vue` |

桌面规范以 `VividDesktop/DESIGN.md` 为单一设计入口；修改前对照 baseline 源码及原图，修改后按任务范围比较对应页面。标准化用于登记并复用已有做法，不能成为重绘理由。不要把发布、部署或功能承诺写入设计规范。
