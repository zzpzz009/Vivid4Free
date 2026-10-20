import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './DesktopApp.vue'
import './assets/styles/main.css'
import './styles/podui.css'



// 创建应用实例
const app = createApp(App)

// 创建 Pinia 状态管理
const pinia = createPinia()

// 注册插件
app.use(pinia)

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  const componentName = vm?.type?.name
  const componentFile = vm?.type?.__file
  console.error('Global error:', err, info, { componentName, componentFile })
}

// 挂载应用
app.mount('#app')
