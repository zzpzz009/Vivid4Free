# ArchViz Web Client

基于 Vue 3 的 ArchViz Generator Web 客户端，提供现代化的 AI 建筑可视化生成界面。

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置你的后端服务地址
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

## 🏗️ 项目结构

```
src/
├── api/              # API 客户端模块
├── assets/           # 静态资源
├── components/       # Vue 组件
├── composables/      # Vue 组合式函数
├── config/           # 配置文件
├── stores/           # Pinia 状态管理
├── utils/            # 工具函数
├── App.vue          # 根组件
└── main.js          # 应用入口
```

## 🎯 核心功能

- 🖼️ **图片上传**: 支持拖拽上传和批量处理
- 🎨 **AI 生成**: 基于 ComfyUI 的建筑可视化生成
- 📊 **实时进度**: WebSocket 实时状态更新
- 🗂️ **图库管理**: 参考图片分类和收藏
- 🖌️ **蒙版编辑**: 局部重绘和精细控制
- 📱 **响应式设计**: 支持多设备访问

## 🔧 开发指南

### 状态管理

使用 Pinia 进行状态管理：

```javascript
import { useImageStore } from '@/stores/useImageStore'

const imageStore = useImageStore()
```

### API 调用

使用统一的 API 客户端：

```javascript
import { api } from '@/api'

const result = await api.jobs.create(jobData)
```

### 组件开发

遵循 Vue 3 Composition API 最佳实践：

```vue
<script setup>
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>
```

## 📦 技术栈

- **框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **状态管理**: Pinia
- **样式**: Tailwind CSS + Material Design 3
- **HTTP 客户端**: Axios
- **UI 组件**: Headless UI
- **开发工具**: ESLint + Prettier + Vitest




## 🤝 测试工作：

### 1.上传文件

| 测试项目 | 上传参考文件 | 上传待处理文件  |
|---------|------|------|
|手动点击上传图片| ----- | ----- |
| 上传常用文件   | ----- | ----- |
| 上传历史文件   | ----- | ----- |
| 上传本地文件   | ----- | ----- |

### 2.图片预览，生成
### 3.点击上传之后，是否有生成到历史文件里
### 4.打包测试：打包后放到后端项目里，是否运行正常，重复测试1

# 配置请求地址：
## 本地运行的地址：
  ***.env.development***
  如果本地地址有修改，可以修改 ***vite.config.js*** 里面的 ***代理地址***
## 配置打包的地址：
  ***.env.production***
