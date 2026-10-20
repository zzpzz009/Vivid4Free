<template>
  <div class="bg-schemes-surface h-screen relative overflow-hidden">
    <!-- 应用头部 -->
    <header class="bg-schemes-surface-container h-16 flex items-center justify-between px-6 border-b border-schemes-outline-variant">
      <!-- <div class="flex items-center space-x-4">
        <h1 class="text-schemes-on-surface text-xl font-semibold">ArchViz Generator</h1>
        <div class="text-schemes-on-surface-variant text-sm">
          {{ connectionStatus }}
        </div>
      </div> -->
      
      <div class="flex items-center space-x-4">
        <button
          class="p-2 rounded-lg hover:bg-schemes-surface-container-high transition-colors"
          @click="toggleTheme"
        >
          <span class="text-schemes-on-surface-variant">🌙</span>
        </button>
      </div>
    </header>

    <!-- 主内容区域 -->
    <div class="flex h-[calc(100vh-4rem)]">
      <!-- 左侧边栏 -->
      <aside class="w-80 bg-schemes-surface-container border-r border-schemes-outline-variant p-4">
        <div class="space-y-6">
          <!-- 图片上传区域 -->
          <div class="space-y-4">
            <h3 class="text-schemes-on-surface font-medium">
              上传图片
            </h3>
            
            <!-- 主图片上传 -->
            <div
              class="border-2 border-dashed border-schemes-outline rounded-lg p-6 text-center hover:border-schemes-primary transition-colors cursor-pointer"
              :class="{ 'border-schemes-primary bg-schemes-primary/5': isDragging }"
              @drop="handleDrop"
              @dragover.prevent
              @dragenter.prevent
            >
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleFileSelect"
              >
              
              <div
                v-if="!uploadedImage"
                @click="$refs.fileInput.click()"
              >
                <div class="text-4xl mb-2">
                  📁
                </div>
                <p class="text-schemes-on-surface-variant">
                  点击或拖拽上传图片
                </p>
              </div>
              
              <div
                v-else
                class="relative"
              >
                <img
                  :src="uploadedImage.preview"
                  :alt="uploadedImage.name"
                  class="w-full h-32 object-cover rounded-lg mb-2"
                >
                <p class="text-schemes-on-surface-variant text-sm">
                  {{ uploadedImage.name }}
                </p>
                <button
                  class="absolute top-2 right-2 bg-schemes-error text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-schemes-error/80"
                  @click="clearImage"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <!-- 生成参数 -->
          <div class="space-y-4">
            <h3 class="text-schemes-on-surface font-medium">
              生成参数
            </h3>
            
            <div>
              <label class="block text-schemes-on-surface-variant text-sm mb-2">提示词</label>
              <textarea
                v-model="prompt"
                placeholder="描述你想要的建筑风格..."
                class="w-full p-3 bg-schemes-surface-container-high rounded-lg border border-schemes-outline text-schemes-on-surface resize-none"
                rows="3"
              />
            </div>
            
            <div>
              <label class="block text-schemes-on-surface-variant text-sm mb-2">
                强度: {{ strength }}
              </label>
              <input
                v-model="strength"
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                class="w-full"
              >
            </div>
          </div>

          <!-- 生成按钮 -->
          <button
            :disabled="!canGenerate || isGenerating"
            class="w-full bg-schemes-primary text-schemes-on-primary py-3 rounded-lg font-medium hover:bg-schemes-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="handleGenerate"
          >
            {{ isGenerating ? '生成中...' : '开始生成' }}
          </button>
        </div>
      </aside>

      <!-- 主内容区域 -->
      <main class="flex-1 p-6">
        <div class="h-full bg-schemes-surface-container-lowest rounded-lg flex items-center justify-center">
          <!-- 加载状态 -->
          <div
            v-if="isGenerating"
            class="text-center"
          >
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-schemes-primary mx-auto mb-4" />
            <p class="text-schemes-on-surface-variant">
              {{ generationStatus }}
            </p>
            <div
              v-if="progress > 0"
              class="mt-2"
            >
              <div class="w-64 bg-schemes-surface-container rounded-full h-2 mx-auto">
                <div
                  class="bg-schemes-primary h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${progress}%` }"
                />
              </div>
              <p class="text-schemes-on-surface-variant text-sm mt-1">
                {{ progress }}%
              </p>
            </div>
          </div>

          <!-- 结果展示 -->
          <div
            v-else-if="resultImage"
            class="max-w-full max-h-full"
          >
            <img
              :src="resultImage"
              alt="Generated Result"
              class="max-w-full max-h-full object-contain rounded-lg"
            >
          </div>

          <!-- 空状态 -->
          <div
            v-else
            class="text-center text-schemes-on-surface-variant"
          >
            <div class="text-6xl mb-4">
              🎨
            </div>
            <p>上传图片并点击生成开始创作</p>
          </div>
        </div>
      </main>
    </div>

    <!-- 状态栏 -->
    <footer class="h-8 bg-schemes-surface-container border-t border-schemes-outline-variant px-6 flex items-center justify-between text-sm text-schemes-on-surface-variant">
      <div>{{ statusMessage }}</div>
      <div>{{ new Date().toLocaleTimeString() }}</div>
    </footer>

    <!-- Toast 通知 -->
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="bg-schemes-surface-container-high text-schemes-on-surface px-4 py-2 rounded-lg shadow-lg"
        :class="{
          'border-l-4 border-schemes-primary': toast.type === 'info',
          'border-l-4 border-green-500': toast.type === 'success',
          'border-l-4 border-red-500': toast.type === 'error'
        }"
      >
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
// import { useWebSocket } from '@/composables/useWebSocket.js'
import { api } from '@/api/index.js'

// 响应式状态
const uploadedImage = ref(null)
const prompt = ref('')
const strength = ref(0.7)
const isGenerating = ref(false)
const generationStatus = ref('')
const progress = ref(0)
const resultImage = ref(null)
const statusMessage = ref('就绪')
const toasts = ref([])
const isDragging = ref(false)

// WebSocket 连接
// const { isConnected, connectionStatus, on } = useWebSocket()

// 计算属性
const canGenerate = computed(() => {
  return uploadedImage.value && prompt.value.trim() && !isGenerating.value
})

// 文件处理
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    processFile(file)
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragging.value = false
  
  const file = event.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) {
    processFile(file)
  }
}

const processFile = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    uploadedImage.value = {
      file,
      name: file.name,
      preview: e.target.result
    }
    showToast('图片上传成功', 'success')
  }
  reader.readAsDataURL(file)
}

const clearImage = () => {
  uploadedImage.value = null
  resultImage.value = null
}

// 生成处理
const handleGenerate = async () => {
  if (!canGenerate.value) return

  try {
    isGenerating.value = true
    generationStatus.value = '准备中...'
    progress.value = 0

    // 上传文件
    const uploadResult = await api.files.upload(uploadedImage.value.file)
    
    // 创建作业
    const jobData = {
      type: 'archviz-preview',
      inputFiles: [uploadResult.data.id],
      parameters: {
        prompt: prompt.value,
        strength: strength.value
      }
    }

    const job = await api.jobs.create(jobData)
    
    // 监听作业状态更新
    const checkStatus = async () => {
      try {
        const status = await api.jobs.getStatus(job.data.id)
        
        if (status.data.status === 'completed') {
          const results = await api.jobs.getResults(job.data.id)
          resultImage.value = results.data.outputFiles[0]?.url
          isGenerating.value = false
          generationStatus.value = '完成'
          showToast('生成完成！', 'success')
        } else if (status.data.status === 'failed') {
          isGenerating.value = false
          generationStatus.value = '失败'
          showToast('生成失败', 'error')
        } else {
          generationStatus.value = status.data.status
          progress.value = status.data.progress || 0
          setTimeout(checkStatus, 2000)
        }
      } catch (error) {
        console.error('Status check failed:', error)
        setTimeout(checkStatus, 5000)
      }
    }

    setTimeout(checkStatus, 1000)

  } catch (error) {
    console.error('Generation failed:', error)
    isGenerating.value = false
    showToast('生成失败: ' + error.message, 'error')
  }
}

// 工具函数
const showToast = (message, type = 'info') => {
  const toast = {
    id: Date.now(),
    message,
    type
  }
  toasts.value.push(toast)
  
  setTimeout(() => {
    const index = toasts.value.findIndex(t => t.id === toast.id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }, 3000)
}

const toggleTheme = () => {
  // 主题切换逻辑
  showToast('主题切换功能待实现', 'info')
}

// WebSocket 事件监听
// on('message', (data) => {
//   console.log('WebSocket message:', data)
// })

// on('error', (error) => {
//   console.error('WebSocket error:', error)
//   showToast('连接错误', 'error')
// })

// 组件挂载
onMounted(() => {
  statusMessage.value = '应用已启动'
  showToast('欢迎使用 ArchViz Generator', 'success')
})
</script>
