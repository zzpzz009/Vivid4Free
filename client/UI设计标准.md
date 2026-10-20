# UI 设计标准（BananaArch）

## 快速接入（可直接复制到新项目）
1. 引入字体资源
   - 全局字体（Roboto）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet">
```

   - 登录页品牌字体（可选：Syne + Manrope）

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap');
```

2. 复制样式文件并按顺序引入
   - 将以下文件完整复制到新项目
     - src/styles/podui.css
     - src/assets/styles/variables.css
     - src/assets/styles/main.css

```js
import 'element-plus/dist/index.css'
import './styles/podui.css'
import './assets/styles/main.css'
```

3. Tailwind 配置

```js
module.exports = {
  content: ["./src/**/*.{vue,js,ts,jsx,tsx}", "./index.html"],
  theme: {
    extend: {
      fontFamily: {
        'm3-headline-medium-font-family': "Roboto-Regular, sans-serif",
        'm3-body-medium-font-family': "Roboto-Regular, sans-serif",
        'm3-label-medium-font-family': "Roboto-Medium, sans-serif",
        'm3-label-small-font-family': "Roboto-Medium, sans-serif",
        'm3-body-large-emphasized-font-family': "Roboto-Medium, sans-serif",
        'm3-body-small-font-family': "Roboto-Regular, sans-serif",
        'm3-label-large-emphasized-font-family': "Roboto-SemiBold, sans-serif",
        'm3-label-large-font-family': "Roboto-Medium, sans-serif",
        'm3-title-medium-font-family': "Roboto-Medium, sans-serif",
        'm3-title-medium-emphasized-font-family': "Roboto-SemiBold, sans-serif"
      },
      fontSize: {
        'm3-headline-medium-font-size': "28px",
        'm3-body-medium-font-size': "14px",
        'm3-label-medium-font-size': "12px",
        'm3-label-small-font-size': "11px",
        'm3-body-large-emphasized-font-size': "16px",
        'm3-body-small-font-size': "12px",
        'm3-label-large-emphasized-font-size': "14px",
        'm3-label-large-font-size': "14px",
        'm3-title-medium-font-size': "16px",
        'm3-title-medium-emphasized-font-size': "16px"
      },
      fontWeight: {
        'm3-headline-medium-font-weight': "400",
        'm3-body-medium-font-weight': "400",
        'm3-label-medium-font-weight': "500",
        'm3-label-small-font-weight': "500",
        'm3-body-large-emphasized-font-weight': "500",
        'm3-body-small-font-weight': "400",
        'm3-label-large-emphasized-font-weight': "600",
        'm3-label-large-font-weight': "500",
        'm3-title-medium-font-weight': "500",
        'm3-title-medium-emphasized-font-weight': "600"
      },
      lineHeight: {
        'm3-headline-medium-line-height': "36px",
        'm3-body-medium-line-height': "20px",
        'm3-label-medium-line-height': "16px",
        'm3-label-small-line-height': "16px",
        'm3-body-large-emphasized-line-height': "24px",
        'm3-body-small-line-height': "16px",
        'm3-label-large-emphasized-line-height': "20px",
        'm3-label-large-line-height': "20px",
        'm3-title-medium-line-height': "24px",
        'm3-title-medium-emphasized-line-height': "24px"
      },
      borderRadius: {
        'corner-large-increased': '20px',
        'corner-medium': '12px'
      },
      colors: {
        'schemes-surface': '#141218',
        'schemes-surface-container': '#211f26',
        'schemes-surface-container-lowest': '#0f0d13',
        'state-layers-secondary-opacity-08': 'rgba(204, 194, 220, 0.08)',
        'schemes-on-surface-variant': '#cac4d0',
        'schemes-on-surface': '#e6e0e9',
        'schemes-on-primary': '#381e72',
        'schemes-outline': '#938f99',
        'schemes-surface-container-high': '#2b2930',
        'schemes-outline-variant': '#49454f',
        'schemes-primary': '#d0bcff',
        'schemes-secondary-container': '#4a4458',
        'primary-container': '#b6f298',
        'on-primary-container': '#062102',
        'on-primary': '#ffffff',
        'schemes-primary-container': '#4f378b'
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
}
```

## 视觉基调
- 深色背景为主，强调磨砂玻璃质感与柔和光晕
- 低对比边框与柔和阴影塑造层级
- 交互状态以轻微提亮、上浮与光晕增强反馈

## 色彩体系
### 基础色（Primitive）
| 语义 | 变量 | 值 |
| --- | --- | --- |
| 深色背景 | --color-base-dark | #0F0D13 |
| 半透明背景 | --color-base-dark-alpha | rgba(30, 30, 35, 0.7) |
| 实体背景 | --color-base-solid | #1E1E24 |
| 纯白 | --color-neutral-white | #ffffff |
| 中性浅灰 | --color-neutral-100 | #e5e7eb |
| 中性灰 | --color-neutral-400 | #9ca3af |
| 中性灰深 | --color-neutral-500 | #6b7280 |
| 中性深灰 | --color-neutral-800 | #2a2a2a |
| 中性黑灰 | --color-neutral-900 | #1a1a1a |
| 紫亮 | --color-purple-light | #C5AEF6 |
| 紫深 | --color-purple-dark | #4F378B |
| 绿 | --color-emerald-500 | #10b981 |
| 绿深 | --color-emerald-600 | #059669 |
| 红 | --color-red-400 | #ff6b6b |
| 红深 | --color-red-500 | #ef4444 |
| 蓝 | --color-blue-500 | var(--color-purple-light) |
| 柠檬绿 | --color-lime-300 | #ACF387 |
| 柠檬深 | --color-lime-950 | #062102 |
| 香蕉黄 | --color-banana-100 | #F9E76D |
| 香蕉深 | --color-banana-200 | #F5DF4D |
| 香蕉深棕 | --color-banana-dark | #3b2f1e |

### 语义色（Semantic）
| 语义 | 变量 | 值 |
| --- | --- | --- |
| 页面背景 | --bg-page | var(--color-base-dark) |
| 组件背景（玻璃感） | --bg-component | var(--color-base-dark-alpha) |
| 组件背景（实底） | --bg-component-solid | var(--color-base-solid) |
| Workspace 底色 | --color-workspace-base | #1A191F |
| Workspace 深色 | --color-workspace-dark | #141419 |
| Prompt Bar 背景 | --bg-prompt-bar | var(--color-workspace-base) |
| 标题文字 | --text-heading | var(--color-neutral-white) |
| 正文主色 | --text-primary | var(--color-neutral-100) |
| 次级文字 | --text-secondary | var(--color-neutral-400) |
| 弱化文字 | --text-muted | var(--color-neutral-500) |
| 通用边框 | --border-color | rgba(255, 255, 255, 0.08) |
| 主品牌色 | --brand-primary | var(--color-purple-light) |
| 品牌深色 | --brand-solid | var(--color-purple-dark) |
| 强调色 | --text-accent | var(--brand-primary) |

### Material 3 令牌
| 语义 | 变量 | 值 |
| --- | --- | --- |
| Surface | --schemes-surface | #141218 |
| Surface Container | --schemes-surface-container | #211f26 |
| Surface Lowest | --schemes-surface-container-lowest | #0f0d13 |
| On Surface Variant | --schemes-on-surface-variant | #cac4d0 |
| On Surface | --schemes-on-surface | #e6e0e9 |
| Outline | --schemes-outline | #938f99 |
| Outline Variant | --schemes-outline-variant | #49454f |
| Primary | --schemes-primary | #d0bcff |
| Primary Container | --schemes-primary-container | #4f378b |
| Secondary Container | --schemes-secondary-container | #4a4458 |
| State Layer 8% | --state-layers-secondary-opacity-08 | rgba(204, 194, 220, 0.08) |
| Primary Container (M3 alt) | --primary-container | #b6f298 |
| On Primary Container | --on-primary-container | #062102 |
| On Primary | --on-primary | #ffffff |

### 状态与强调
- 成功态：--ui-green-color / --ui-green-hover-color
- 危险态按钮：.pod-btn-danger（#ef4444）
- 生成按钮：.pod-generate-button（--color-lime-300）
- 选中/激活：多为背景提升 + 文字变亮

## 字体与排版
- 全局字体：Roboto（Tailwind 字体族与字号已在 tailwind.config.js 中配置）
- 登录页品牌字体：--font-display（Syne）与 --font-body（Manrope）
- 排版变量（src/assets/styles/variables.css）
  - --m3-*-letter-spacing
  - --m3-*-font-size
  - --m3-*-line-height
  - --m3-*-font-weight

常用排版类（Tailwind）
```html
<div class="font-m3-label-medium-font-family text-m3-label-medium-font-size leading-m3-label-medium-line-height font-m3-label-medium-font-weight">
  Label
</div>
```

## 圆角、阴影与玻璃感
| 语义 | 变量/类 | 值 |
| --- | --- | --- |
| 大圆角 | --border-radius-lg | 24px |
| 基础圆角 | --border-radius-base | 12px |
| 工具条圆角 | --pod-toolbar-radius | 9999px |
| 中阴影 | --shadow-md | 0 8px 24px -4px rgba(0,0,0,0.4) |
| 大阴影 | --shadow-lg | 0 20px 40px -10px rgba(0,0,0,0.6) |
| 超大阴影 | --shadow-xl | 0 25px 50px -12px rgba(0,0,0,0.7) |
| 磨砂感 | .pod-panel / .pod-toolbar | backdrop-filter: blur(24px) |

## 间距与断点
### 间距尺度
--space-1/2/3/4/5/6/8/10/12/16 = 4/8/12/16/20/24/32/40/48/64px
- UnifiedSidebar：滚动内容与底部操作区保持 --space-4（16px）间距

### 断点
--bp-sm/md/lg/xl = 640/768/1024/1280px

## 动效规范
- 过渡速度：--transition-speed-fast 0.15s，--transition-speed-normal 0.2s
- 动画：podWaveShift、podGradientShift、podRadialPulse、pod-chip-sheen、pod-text-* sheen
- 降低动效：prefers-reduced-motion 时禁用大多数动画并回退为静态渐变

## 可访问性
- :focus-visible 使用 --pod-ring（2px 主色 + 淡色外环）
- 禁用态：常用 opacity 0.5~0.6 + cursor not-allowed

## 滚动条规范
- 令牌来源：src/assets/styles/variables.css
  - --scrollbar-size
  - --scrollbar-track-color
  - --scrollbar-thumb-color
  - --scrollbar-thumb-hover-color
  - --scrollbar-thumb-active-color
  - --scrollbar-radius
  - --scrollbar-dot-radius
  - --scrollbar-dot-color
  - --scrollbar-dot-hover-color
  - --scrollbar-dot-active-color
- 全局覆盖：src/assets/styles/main.css
  - 原生滚动条与 Element Plus 滚动条统一为细线圆点风格
  - 非 WebKit 环境降级为 scrollbar-width + scrollbar-color

## 组件标准
### Button
| 类型 | 类名 | 关键特征 |
| --- | --- | --- |
| 主按钮 | .pod-primary-button | 强调色底，16px 圆角，hover 提亮上浮 |
| 次按钮 | .pod-btn-secondary | 玻璃底 + 边框 |
| 幽灵 | .pod-btn-ghost | 透明底，hover 浅亮 |
| 线框 | .pod-btn-outline | 透明底 + 细边 |
| 危险 | .pod-btn-danger | 红色主导 |
| 生成 | .pod-generate-button | 柠檬绿强调 |

尺寸：
- XS：.pod-btn-xs（28px 高，8px 圆角）
- SM：.pod-btn-sm（32px 高，10px 圆角）
- MD：.pod-btn-md（40px 高，12px 圆角）

### Icon Button
- 基础：.pod-icon-button
- 尺寸：.pod-icon-sm 32、.pod-icon-md 40、.pod-icon-lg 48
- 激活态：.pod-icon-button.active（强调色底）

### Input / Select / Textarea
- 输入框：.pod-input（半透明底 + 12px 圆角）
- 尺寸：.pod-input-sm（32px），.pod-input-md（40px）
- Select：.pod-select（边框 + 强调色聚焦）
- Textarea：.pod-textarea（透明底，focus-visible 光晕）
- 输入组：.pod-input-group（胶囊式组合输入）
- UnifiedSidebar（高级参数区）输入框：背景使用 --schemes-surface-container（#211F26），文字使用 --schemes-outline（#938F99），对应 Tailwind 为 bg-schemes-surface-container 与 text-schemes-outline

### Chip
- 基础：.pod-chip（44px 高，9999px 圆角）
- 激活：.pod-chip.active（强调色底）
- size chip：.pod-chip-size.active（深色强调）

### Panel
- 基础：.pod-panel（玻璃底 + 阴影）
- 品牌渐变：.pod-panel-brand-gradient
- 透明：.pod-panel-transparent
- 黑色：.pod-panel-black
- 药丸：.pod-panel-pill
- 圆角增强：.pod-panel-rounded-xl（22px）

### Toolbar
- 基础：.pod-toolbar
- 抬升：.pod-toolbar-elevated
- 柔和背景：.pod-bar-soft-gradient

### Dialog
- 遮罩：.pod-dialog-overlay（半透明 + blur 4px）
- 内容区：复用 .pod-panel

### Context Menu
- 容器：.pod-context-menu
- 项：.pod-context-menu-item
- 分隔：.pod-context-divider

### Prompt Bar
- 容器：.pod-prompt-bar
  - collapsed：56px 高、180px 宽、圆角 9999px
  - expanded：580px 宽、圆角 24px
- 输入区：.pod-prompt-textarea（15px 字号，1.6 行高）
- 菜单层：.pod-prompt-menu-overlay / .pod-menu-panel
- 选择器：.pod-prompt-selector（36px 高）
- 分段控件：.pod-segmented-control + .pod-segment-button

### Context Toolbar
- 容器：.pod-context-toolbar（52px 高，最小宽 340px）
- 按钮：.pod-context-button
- 滑块：.pod-context-range
- 数字输入：.pod-context-input

### 颜色输入与数值
- .pod-color-picker-input（28px 圆形）
- .pod-text-value（14px 字号，1.5rem 宽）

## 组件封装入口
### PodUI 组件（src/components/podui）
- PodButton：variant + size 映射 podui.css
- PodInput：支持左右图标、sm/md
- PodPanel：default/brand-gradient/transparent/black/pill
- PodToolbar：default/elevated

### UI 基础组件（src/ui）
- Button / IconButton / Input / Select / Textarea / Chip / Panel / Toolbar / Dialog
- 同一套 class 体系复用 podui.css 样式

## 使用规范
- 新组件优先使用已有 class 与 CSS 变量，避免硬编码颜色/阴影
- 交互状态统一使用 hover 轻微提亮与 focus-visible 光晕
- 大面积容器遵循玻璃感与边框规范，保持一致层级

## 元素代码（可直接复用）
### Button
```vue
<Button variant="primary" size="md">确认</Button>
<Button variant="secondary" size="sm">次级</Button>
<Button variant="ghost" size="sm">幽灵</Button>
<Button variant="outline" size="sm">线框</Button>
<Button variant="danger" size="sm">删除</Button>
<Button variant="generate" size="md">生成</Button>
```

### PodButton
```vue
<PodButton variant="primary" size="md">确认</PodButton>
<PodButton variant="generate" size="md">生成</PodButton>
```

### Icon Button
```vue
<IconButton size="sm" :active="true">
  <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"></svg>
</IconButton>
```

### Input / Select / Textarea
```vue
<Input v-model="name" inputSize="md" placeholder="Name" />
<Select v-model="size">
  <option value="s">S</option>
  <option value="m">M</option>
</Select>
<Textarea v-model="desc" class="w-full h-24" />
```

### PodInput
```vue
<PodInput v-model="keyword" size="md" placeholder="Search">
  <template #leftIcon>
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"></svg>
  </template>
</PodInput>
```

### Chip
```vue
<Chip :active="true">High</Chip>
<Chip>Normal</Chip>
```

### Panel
```vue
<Panel variant="default" class="p-4">
  <div>内容</div>
</Panel>
<Panel variant="brand-gradient" class="p-4">
  <div>品牌渐变</div>
</Panel>
```

### PodPanel
```vue
<PodPanel variant="transparent" :rounded="true">
  <div>透明面板</div>
</PodPanel>
```

### Toolbar
```vue
<Toolbar :elevated="true" class="gap-2 p-2">
  <Button size="xs">A</Button>
  <Button size="xs">B</Button>
</Toolbar>
```

### Dialog
```vue
<Dialog :open="isOpen" @close="isOpen = false">
  <div class="p-6">内容</div>
</Dialog>
```

### Menu Item
```vue
<MenuItem>操作</MenuItem>
```

### Prompt Bar 结构
```html
<div class="pod-prompt-bar">
  <textarea class="pod-textarea pod-prompt-textarea"></textarea>
  <div class="pod-prompt-controls">
    <button class="pod-prompt-selector">模型</button>
    <div class="pod-segmented-control">
      <button class="pod-segment-button active">S</button>
      <button class="pod-segment-button">M</button>
    </div>
  </div>
</div>
```

### Context Toolbar
```html
<div class="pod-context-toolbar">
  <button class="pod-context-button"></button>
  <input class="pod-context-range" type="range">
  <input class="pod-context-input" type="number">
</div>
```

### Context Menu
```html
<div class="pod-context-menu">
  <button class="pod-context-menu-item">操作</button>
  <div class="pod-context-divider"></div>
  <button class="pod-context-menu-item">删除</button>
</div>
```

### Toast
```vue
<Toast type="success" title="完成" message="任务已完成" />
<Toast type="error" message="请求失败" />
```

## Tailwind 组合样式（侧边栏可复用）
```js
export const UPLOAD_PROMPT_STYLES = {
  container: 'flex flex-col items-center justify-center gap-2',
  icon: 'w-6 h-6',
  title: 'text-schemes-on-surface-variant text-center font-m3-body-medium-font-family text-m3-body-medium-font-size leading-m3-body-medium-line-height font-m3-body-medium-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-medium',
  subtitle: 'text-schemes-outline text-center font-m3-body-small-font-family text-m3-body-small-font-size leading-m3-body-small-line-height font-m3-body-small-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-small',
  multiContainer: 'flex flex-col items-center justify-center gap-2 p-4',
  multiTitle: 'text-schemes-on-surface-variant text-sm font-m3-body-medium-font-family text-center',
  multiSubtitle: 'text-schemes-on-surface-variant text-xs text-center'
}

export const FORM_FIELD_STYLES = {
  container: 'flex flex-col gap-2',
  label: 'text-schemes-on-surface-variant text-sm font-m3-label-medium-font-family font-m3-label-medium-font-weight letter-spacing-m3-label-medium',
  input: 'input-field text-schemes-on-surface text-sm font-m3-body-medium-font-family focus:outline-none focus:ring-2 focus:ring-schemes-primary transition-colors',
  textarea: 'input-field min-h-[80px] text-schemes-on-surface text-sm font-m3-body-medium-font-family resize-none focus:outline-none focus:ring-2 focus:ring-schemes-primary transition-colors',
  placeholder: 'placeholder:text-schemes-on-surface-variant'
}

export const DIVIDER_STYLES = {
  horizontal: 'border-solid border-schemes-outline-variant border-t w-[265px] h-0 -mt-1'
}

export const INFO_DISPLAY_STYLES = {
  container: 'text-xs text-schemes-on-surface-variant text-center',
  count: 'text-schemes-primary font-medium'
}

export const ADVANCED_PARAMS_STYLES = {
  container: 'w-[265px]',
  button: 'flex w-full justify-between rounded-lg bg-schemes-surface-container px-4 py-2 text-left text-sm font-medium text-schemes-on-surface hover:bg-schemes-surface-container-high focus:outline-none focus-visible:ring focus-visible:ring-schemes-primary focus-visible:ring-opacity-75',
  icon: 'h-5 w-5 text-schemes-on-surface transition-transform',
  iconRotated: 'rotate-180 transform',
  panel: 'mt-4',
  transition: {
    enterActive: 'transition duration-200 ease-out',
    enterFrom: 'transform scale-95 opacity-0',
    enterTo: 'transform scale-100 opacity-100',
    leaveActive: 'transition duration-75 ease-in',
    leaveFrom: 'transform scale-100 opacity-100',
    leaveTo: 'transform scale-95 opacity-0'
  }
}
```

## 登录页品牌风格（可选复刻）
### 变量
```css
:root {
  --font-display: 'Syne', sans-serif;
  --font-body: 'Manrope', sans-serif;
  --login-accent: #C5AEF6;
  --login-bg: #0A0A0A;
}
```

### 关键样式
```css
.login-page {
  background-color: var(--login-bg);
  color: #EDEDED;
  font-family: var(--font-body);
}
.text-sheen {
  background: linear-gradient(90deg, #fff, #C5AEF6, #fff);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: sheen 3s ease-in-out infinite;
}
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.active {
  opacity: 1;
  transform: translateY(0);
}
```

## 参考文件
- src/styles/podui.css
- src/components/podui/*
- src/ui/*
- tailwind.config.js
