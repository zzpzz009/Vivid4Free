---
name: "va-rh-comfyui-design"
description: "VA_RH_comfyui 的项目级 DESIGN.md。用于任何页面、组件、交互、状态持久化或视觉改动前，指导 AI 与开发者保持统一的深色工作台设计。"
---

# VA_RH_comfyui DESIGN.md

## 0. Product Context

VA_RH_comfyui 是一个面向建筑可视化出图的深色工作台应用。核心体验不是营销页，而是高频生产工具：上传待处理图、设置参数、触发云端任务、查看结果、在历史中反查、在多工作区间切换并保持现场。

界面必须优先满足以下目标：
- 连续工作不打断：切换标签、刷新页面、返回历史时尽量保持现场
- 结果导向：原图、结果图、历史记录、运行状态必须比装饰更突出
- 低噪声深色环境：减少强对比与大面积高饱和色，避免影响长时间盯屏
- 组件一致：优先复用现有 PodUI、M3 token、Tailwind 扩展与 UI 组件，不重新发明一套视觉语言

## 1. Visual Theme & Atmosphere

- 整体气质：深色、安静、工具化、偏专业工作台而非宣传页
- 视觉基调：黑紫灰为主，柠檬绿与淡紫作为功能强调
- 密度：中高密度；信息允许紧凑，但不可拥挤
- 情绪关键词：稳定、克制、聚焦、结果优先、带轻微未来感
- 表面风格：深色实底 + 少量玻璃磨砂浮层并存
- 装饰原则：允许柔和渐变、光晕、blur，但只能作为层级和氛围补充，不能盖过任务状态与内容本身

## 2. Color Palette & Roles

### 2.1 Core tokens

以下颜色优先使用现有 token，不新增散落硬编码色值。

| Role | Token | Value | Usage |
|---|---|---:|---|
| Page background | `--bg-page` | `#0F0D13` | 整体应用底色 |
| Main workspace | `--color-workspace-base` | `#1A191F` | 主画布、工作区主容器 |
| Dark workspace | `--color-workspace-dark` | `#141419` | 侧栏、头部、次级深色区 |
| Glass panel | `--bg-component` | `rgba(30,30,35,0.7)` | 浮层、toolbar、轻磨砂卡片 |
| Solid panel | `--bg-component-solid` | `#1E1E24` | 需要稳定可读性的实底容器 |
| Primary text | `--text-primary` | `#e5e7eb` | 默认正文、输入内容 |
| Secondary text | `--text-secondary` | `#9ca3af` | 说明文字、次级信息 |
| Muted text | `--text-muted` | `#6b7280` | 弱化提示、空状态辅助文案 |
| Border | `--border-color` | `rgba(255,255,255,0.08)` | 默认描边、分隔 |
| Brand accent | `--brand-primary` | `#C5AEF6` | 主品牌强调、激活、焦点环 |
| Brand solid | `--brand-solid` | `#4F378B` | 深紫按钮底、选中容器 |
| Generate accent | `--color-lime-300` | `#ACF387` | 生成/主要行动按钮 |
| Generate contrast | `--color-lime-950` | `#062102` | 柠檬绿按钮上的文字 |
| Success | `--ui-green-color` | `#10b981` | 成功、完成、通过 |
| Danger | `--color-red-500` | `#ef4444` | 失败、删除、危险操作 |

### 2.2 Semantic rules

- 主背景永远深色，不做浅色主主题
- 强调色分工固定：
  - 淡紫：选中、高亮、焦点、品牌
  - 柠檬绿：主行动、生成、可继续推进的正向动作
  - 绿色：成功态
  - 红色：失败、删除、不可逆动作
- 历史缩略图、结果图、上传预览是最彩色的内容区域；容器本身必须保持克制
- 同一页面上高饱和色最多出现 2 种主角色，避免“彩灯感”

### 2.3 Forbidden color usage

- 不直接在业务组件里硬编码新的十六进制色值，优先走 token
- 不把红色用作普通主按钮
- 不把紫色、绿色同时用于多个同级 CTA
- 不在深色背景上使用纯白大面积块级容器

## 3. Typography Rules

### 3.1 Font families

- 应用主字体：Roboto
- 登录页品牌字体可例外使用：
  - 标题：Syne
  - 正文：Manrope
- 主工作台内不混用装饰性字体

### 3.2 Type hierarchy

沿用现有 M3/Tailwind 扩展命名：

| Purpose | Suggested class/token |
|---|---|
| 大标题 | `m3-headline-medium` 体系 |
| 模块标题 | `m3-title-medium` / emphasized |
| 正文 | `m3-body-medium` |
| 主要按钮/标签 | `m3-label-large` / emphasized |
| 辅助说明 | `m3-label-medium` / `m3-body-small` |

### 3.3 Copy style

- 面向执行，不写营销腔
- 操作文案尽量短：2–6 个字为优先
- 状态文案要具体：
  - 好：`生成中 · 进度 64%`
  - 差：`处理中`
- 空状态要说明下一步动作，不只描述“暂无内容”

## 4. Component Stylings

### 4.1 Global component principles

- 优先使用 `src/ui`、`src/components/podui`、`main.css`、`podui.css` 中已有组件和类
- 组件圆角默认 12px，浮层与大容器可用 24px
- 有玻璃感的组件必须同时具备：
  - 半透明深色底
  - 低对比边框
  - 模糊背景
  - 中等阴影

### 4.2 Buttons

- 主按钮：柠檬绿底，深色文字，用于“预览/生成/继续”
- 次按钮：深色或半透明底 + 淡紫描边/文字
- 危险按钮：红色，仅用于清除、删除、停止等危险行为
- hover 反馈：轻微提亮、上浮或描边增强，不使用夸张缩放
- 禁用态：透明度降低到 0.5–0.6，并保持可识别文本

### 4.3 Inputs

- 输入框背景使用工作区输入背景，不要纯黑纯白
- 焦点态以淡紫 ring 为主，不用浏览器默认蓝边
- 提示文本使用次级文字，不低于可读性阈值
- 高级参数区属于“高密度工具区”，字段排列紧凑但左右对齐必须严格

### 4.4 Panels & toolbars

- 侧栏、浮动工具条、右侧面板都应使用统一容器语言：
  - 深色底
  - 细描边
  - 圆角
  - 层级清晰
- 浮动工具条使用 pill 形态；内容面板使用矩形大圆角
- 右侧面板属于高频交互区，禁止视觉上比中央工作画布更抢眼

### 4.5 Upload areas

- 上传区必须优先表达“这是输入入口”
- 视觉结构：
  - 图标
  - 标题
  - 一句明确操作提示
  - 上传后切换为预览态
- 拖拽 hover 态用描边增强与淡紫/绿色微弱高亮，不要整块大闪烁

### 4.6 Image comparison & history

- 原图/结果图是主内容，应最大化可读尺寸
- 对比滑杆、标签、状态角标只做辅助，不遮挡图像
- 历史项需优先展示：
  - 缩略图
  - 时间
  - 状态
  - 可继续操作
- 历史项状态必须与实际业务状态一致，禁止“视觉完成、数据运行中”的分裂体验

### 4.7 Toast, menus, dialogs

- Toast 用于短反馈，不承载复杂说明
- Dialog 仅用于需要确认的中断型动作
- Menu 用于轻量选项，不嵌入复杂表单

### 4.8 Canonical component catalog

以下类和封装是本项目优先级最高的组件输入源；新增界面优先复用，不重复造型。

| Component | Canonical implementation |
|---|---|
| Button | `.pod-primary-button` / `.pod-btn-secondary` / `.pod-btn-ghost` / `.pod-btn-outline` / `.pod-btn-danger` / `.pod-generate-button` |
| Icon button | `.pod-icon-button` + `.pod-icon-sm/md/lg` |
| Input | `.pod-input` / `.pod-input-sm` / `.pod-input-md` |
| Select | `.pod-select` |
| Textarea | `.pod-textarea` |
| Input group | `.pod-input-group` |
| Chip | `.pod-chip` / `.pod-chip.active` |
| Panel | `.pod-panel` / `.pod-panel-transparent` / `.pod-panel-pill` |
| Toolbar | `.pod-toolbar` / `.pod-toolbar-elevated` |
| Dialog | `.pod-dialog-overlay` + `.pod-panel` |
| Context menu | `.pod-context-menu` / `.pod-context-menu-item` / `.pod-context-divider` |
| Sidebar field | `SidebarField` |
| Sidebar section | `SidebarSection` |
| Upload card | `SidebarUploadCard` + upload prompt tokens + existing upload area sizing |
| Prompt bar | `.pod-prompt-bar` / `.pod-prompt-textarea` / `.pod-prompt-selector` / `.pod-segmented-control` |
| Context toolbar | `.pod-context-toolbar` / `.pod-context-button` / `.pod-context-range` / `.pod-context-input` |

### 4.9 Component wrapper preference

- Vue 层优先顺序：
  1. `src/ui/*`
  2. `src/components/podui/*`
  3. 复用已有 class 组合
  4. 最后才新增新样式
- 组件 API 应尽量复用现有 `variant`、`size`、`active` 等命名，不再引入新一套 props 语义
- 侧边栏、高级参数区、上传提示区优先复用现有 Tailwind 组合常量，不重新散落拼接 class

### 4.10 Component contract rules

- 基础组件职责边界：
  - `src/ui/*`：项目级通用交互组件，是默认首选入口
  - `src/components/podui/*`：对 PodUI 视觉语言的兼容封装，逐步向 `src/ui/*` 收敛
  - `src/components/*`：页面级或业务级组合组件，不重复定义基础视觉规范
- 基础组件命名规则：
  - 展示型：`Panel`、`Toolbar`、`Chip`
  - 输入型：`Input`、`Select`、`Textarea`
  - 反馈型：`Dialog`、`Toast`、`Loader`
  - 菜单型：`ImageActionMenu`、`ContextMenu`
  - 业务壳组件：`SidebarUploadCard`、`SidebarField`、`SidebarSection`
- Props 规范：
  - 视觉变体统一用 `variant`
  - 尺寸统一用 `size` 或 `inputSize`
  - 激活态统一用 `active`
  - 显隐统一用 `visible` / `open`
  - 渐进式收敛且要求“零视觉变化”时，可使用 `unstyled` 过渡到统一组件体系
- Events 规范：
  - 双向绑定用 `update:modelValue`
  - 动作用显式语义事件名，如 `primary`、`secondary`、`preview`、`close`
  - 不使用模糊事件名如 `doAction`、`handleClick`
- Slot 规范：
  - 图标优先走 slot，不新增一堆布尔 props
  - 菜单项、按钮组、空状态等允许 slot 定制，但默认视觉必须来自基础组件

## 5. Layout Principles

### 5.1 App shell

应用结构固定为：
- 顶部 AppHeader
- 工作区 Header / Tab
- 左侧工具输入区
- 中央画布与结果区
- 右侧面板
- 底部状态栏

### 5.2 Spatial rules

- 统一间距尺度：4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64
- 同一容器内部尽量只使用 1–2 个相邻尺度
- 工具区强调对齐，画布区强调留白
- 历史列表与表单列允许更高密度，结果展示区保持呼吸感

### 5.3 Width strategy

- 左侧输入区保持稳定宽度，避免随内容跳动
- 中央结果区优先拿剩余宽度
- 右侧面板支持展开/收起，但切换时不能破坏主工作流

### 5.4 Screen contracts

- `AppHeader`：全局导航与账户区，不承载工作流细节
- `WorkspaceHeader`：工作区级切换与控制，不抢占主画布纵向空间
- `UnifiedSidebar`：输入、参数、上传、触发操作的主入口，应拆分为更小的标准化子组件
- `WorkspaceCanvasPanel`：结果展示、对比、历史，是核心视觉重心
- `RightPanel`：次级资源浏览区，优先服务主工作流，不可压过主画布
- `HistorySection`：历史回显与操作回放区，状态必须可信且与业务一致

## 6. Depth, Elevation & Motion

### 6.1 Elevation

- 默认卡片：`--shadow-md`
- 浮层或高优先区：`--shadow-lg`
- 少数强调浮层：`--shadow-xl`
- 阴影只用于层级，不用于“炫酷”

### 6.2 Motion

- 动效速度使用现有 token：0.15s / 0.2s
- 动效类型：淡入、轻微位移、背景微调、光晕增强
- 避免：
  - 大幅缩放
  - 高频跳动
  - 与出图等待无关的炫技动效
- 对 `prefers-reduced-motion` 保持兼容

### 6.3 Scrollbars

- 全局滚动条必须统一为细线/圆点风格
- 优先使用以下 token：
  - `--scrollbar-size`
  - `--scrollbar-track-color`
  - `--scrollbar-thumb-color`
  - `--scrollbar-thumb-hover-color`
  - `--scrollbar-thumb-active-color`
  - `--scrollbar-radius`
  - `--scrollbar-dot-radius`
- 原生滚动条和 Element Plus 滚动条都应保持同一视觉语言
- 非 WebKit 环境允许降级，但不能回退成粗重默认滚动条

### 6.4 Accessibility

- 焦点态统一使用 `:focus-visible` + `--pod-ring`
- 禁用态必须保持可识别，不允许只靠颜色差异表达
- 图标按钮尺寸不可小于可用点击区域
- 结果图、历史记录、上传区的关键操作必须保留足够文字或 aria 语义，不能全靠图形猜测

## 7. State Persistence & Interaction Rules

这是本项目设计规范的扩展重点，优先级高于一般视觉规则。

- UI 不只是“看起来一致”，还必须“状态连续”
- 以下信息默认视为应持续化的工作现场：
  - 当前结果图
  - 对比原图
  - 对比滑杆位置
  - 关键右侧面板状态
  - 当前输入缓存
  - 历史项与结果项的映射关系
- 标签切换、刷新、历史回显必须优先保护用户现场
- 如果视觉方案会导致状态真假难辨，必须让位给清晰状态表达

### 7.1 State ownership matrix

| State type | Recommended owner | Example |
|---|---|---|
| 纯视觉瞬时态 | 组件局部状态 | hover、临时展开、单次菜单定位 |
| 跨组件 UI 态 | `useUIStore` | 右侧面板、对比滑杆、当前结果图 |
| 业务流程态 | 业务 store | 历史任务、队列状态、上传文件 |
| 可恢复工作现场 | store + 持久化 | 输入缓存、历史映射、当前预览结果 |

- 只要状态影响刷新恢复、切标签恢复、跨区域联动，就不应只放在局部 `ref`
- 视觉组件可以持有瞬时交互状态，但不能单独持有业务真相

### 7.2 Interaction standardization

- 相同操作在不同区域必须复用同一组件或同一交互模式
- 右键菜单、图片操作菜单、预览二次操作必须统一文案、顺序与视觉
- 上传区、历史区、图库区对“设为主图 / 设为参考图 / 预览 / 查看原图 / 复制链接”的动作排序保持一致
- 同类操作的按钮位置、名称、危险等级不可在不同页面漂移

## 8. Do's and Don'ts

### Do

- 复用已有 token、PodUI 类、Tailwind 扩展与现成组件
- 让主行动、结果图、历史状态一眼可见
- 使用统一的圆角、边框和焦点态
- 让页面在深色环境下可持续工作，不刺眼
- 设计时同时考虑刷新恢复、历史回显和切标签保持

### Don't

- 不新增零散视觉体系
- 不为单个页面重新定义按钮样式
- 不在业务组件中随手写新的硬编码颜色、阴影和圆角
- 不用大面积纯白、纯黑或高饱和渐变干扰内容
- 不让视觉层掩盖任务真实状态、错误状态或空状态

## 9. Responsive Behavior

- 断点沿用现有值：640 / 768 / 1024 / 1280
- 小屏优先收起次级面板，不压缩主结果区到不可用
- 触控目标至少保证易点中，图标按钮不可过小
- 当空间不足时，优先折叠边栏，其次压缩文本，不优先压缩结果图
- Prompt Bar、Context Toolbar、右侧工具条在小屏下优先减少横向占用，不可遮挡主工作流

## 10. Page-specific Exceptions

### 10.1 Login page

- 登录页允许作为品牌展示页例外使用 `Syne + Manrope`
- 允许更明显的品牌高光、text sheen、reveal 动效
- 但登录表单控件仍需和主应用共用同一焦点态、圆角与输入可用性标准

### 10.2 Workspace-specific priority

- 工作区不追求“更亮更酷”，优先保证结果图、对比区、历史区、输入区稳定可读
- 历史记录、结果状态、生成进度是一级信息，不得被装饰层抢焦点
- 任何影响状态持续化可理解性的视觉方案都应降级或取消

## 11. Implementation Mapping

### 11.1 Source of truth

- Color & radius & spacing token: `src/styles/podui.css`
- M3 token and reset: `src/assets/styles/variables.css`
- Common UI classes: `src/assets/styles/main.css`
- Project UI state persistence: `src/stores/useUIStore.js`
- App shell: `src/views/App/App.vue`
- Sidebar style constants: `src/utils/sidebarStyles.js`
- Root design source: `DESIGN.md`

### 11.2 Coding rules for agents

- 新组件先看是否可落在 `src/ui` 或 `src/components/podui`
- 需要样式时先复用 CSS 变量，再考虑新增类
- 新增视觉规则必须先和现有 DESIGN.md 一致，不能只在单文件临时成立
- 设计改动完成后要做浏览器回归验证与截图对比
- `UI设计标准.md` 只保留历史兼容入口，不再作为独立设计来源

### 11.3 Standardization targets in current codebase

以下文件是优先标准化对象：

| File / area | Current issue | Standardization direction |
|---|---|---|
| `src/components/UnifiedSidebar.vue` | 超大组件、长 class 串、上传/表单/参数混杂 | 拆为上传卡片、字段组、分区容器，复用 `src/ui` |
| `src/components/FavoritesPanel.vue` | 右键菜单逻辑与视觉重复 | 复用统一图片操作菜单组件 |
| `src/components/GalleryPanel.vue` | 搜索框与菜单重复、操作顺序需统一 | 复用 Input 和统一菜单组件 |
| `src/components/HistorySection.vue` | 历史项操作菜单重复、状态呈现复杂 | 统一菜单、保持状态展示可信 |
| `src/components/WorkspaceHeader.vue` | 顶部切换控制未完全标准化 | 复用 Toolbar / Chip / Button 体系 |
| `src/components/ui/Toast.vue` | 视觉语言局部独立 | 纳入统一 token 与反馈组件规则 |

### 11.4 Refactor policy

- 允许为了标准化而调整当前实现
- 但优先遵守“最小改动 + 高复用收益”：
  1. 先抽重复组件
  2. 再统一状态与契约
  3. 最后再处理更大范围的样式收敛
- 页面级大重构前，必须先证明有明确复用收益和对 DESIGN.md 的一致性提升

## 12. Agent Prompt Guide

### 12.1 Quick summary

- Build a dark, high-focus architectural rendering workspace
- Use PodUI + Material 3 tokens already defined in the repository
- Prefer muted black/purple surfaces with lime primary actions
- Keep layout stable and tool-like, not marketing-like
- Optimize for persistence, history clarity, and image comparison workflows

### 12.2 Good prompt examples

- “按 DESIGN.md 为工作区新增一个参数面板，复用现有深色玻璃容器、M3 排版和柠檬绿主按钮，不改变主工作流结构。”
- “基于 DESIGN.md 优化历史记录卡片，让缩略图、时间和状态更清晰，但保持当前深色工具台风格和低噪声层级。”
- “按 DESIGN.md 调整上传区交互态，保持 PodUI 风格、统一焦点态，并兼容刷新后状态恢复。”

### 12.3 Bad prompt examples

- “做一个更炫酷、更亮、更像营销页的界面。”
- “给每个按钮都加不同颜色区分功能。”
- “重新设计整套视觉，不用管现有 token 和组件。”

## 13. Migration Policy

- 从现在开始，根目录 `DESIGN.md` 是唯一设计输入源
- 历史文档、规则文件、提示词模板都应回指 `DESIGN.md`
- 若发现旧文档与 `DESIGN.md` 冲突，以 `DESIGN.md` 为准
- 新增设计规则必须直接补到 `DESIGN.md`，而不是另开平行规范文件
