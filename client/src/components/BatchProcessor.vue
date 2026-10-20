<template>
  <div class="batch-processor h-full flex flex-col">
    <!-- 头部控制栏 -->
    <div class="bg-white border-b border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            批量处理
          </h2>
          <p class="text-sm text-gray-600">
            批量上传图片并进行处理
          </p>
        </div>
        <div class="flex items-center space-x-3">
          <span class="text-sm text-gray-600">
            已选择 {{ selectedImages.length }} / {{ images.length }} 张图片
          </span>
          <button
            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            @click="selectAll"
          >
            全选
          </button>
          <button
            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            @click="clearSelection"
          >
            清除选择
          </button>
          <button
            :disabled="selectedImages.length === 0 || isProcessing"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            @click="startBatchProcessing"
          >
            {{ isProcessing ? '处理中...' : '开始批量处理' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧图片列表 -->
      <div class="w-1/3 border-r border-gray-200 flex flex-col">
        <!-- 上传区域 -->
        <div class="p-4 border-b border-gray-200">
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
            @drop="handleDrop"
            @dragover.prevent
            @dragenter.prevent
          >
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <div class="mt-4">
              <label class="cursor-pointer">
                <span class="mt-2 block text-sm font-medium text-gray-900">
                  拖拽图片到此处或
                  <span class="text-blue-600">点击上传</span>
                </span>
                <input
                  ref="fileInput"
                  type="file"
                  multiple
                  accept="image/*"
                  class="sr-only"
                  @change="handleFileSelect"
                >
              </label>
              <p class="mt-1 text-xs text-gray-500">
                支持 PNG, JPG, JPEG 格式
              </p>
            </div>
          </div>
        </div>

        <!-- 图片列表 -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="space-y-3">
            <div
              v-for="image in images"
              :key="image.id"
              class="relative group cursor-pointer"
              @click="selectImage(image)"
            >
              <div
                class="border-2 rounded-lg overflow-hidden transition-all"
                :class="{
                  'border-blue-500 bg-blue-50': selectedImages.includes(image.id),
                  'border-gray-200 hover:border-gray-300': !selectedImages.includes(image.id)
                }"
              >
                <div class="aspect-w-16 aspect-h-9">
                  <img
                    :src="image.url"
                    :alt="image.name"
                    class="w-full h-24 object-cover"
                  >
                </div>
                <div class="p-2">
                  <p class="text-sm font-medium text-gray-900 truncate">
                    {{ image.name }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ formatFileSize(image.size) }}
                  </p>
                  <div
                    v-if="image.status"
                    class="mt-1"
                  >
                    <div class="flex items-center justify-between">
                      <span
                        class="text-xs"
                        :class="getStatusColor(image.status)"
                      >
                        {{ getStatusText(image.status) }}
                      </span>
                      <span
                        v-if="image.progress !== undefined"
                        class="text-xs text-gray-500"
                      >
                        {{ image.progress }}%
                      </span>
                    </div>
                    <div
                      v-if="image.progress !== undefined"
                      class="mt-1"
                    >
                      <div class="w-full bg-gray-200 rounded-full h-1">
                        <div
                          class="h-1 rounded-full transition-all duration-300"
                          :class="getProgressColor(image.status)"
                          :style="{ width: image.progress + '%' }"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 选择指示器 -->
              <div
                v-if="selectedImages.includes(image.id)"
                class="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center"
              >
                <svg
                  class="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              
              <!-- 删除按钮 -->
              <button
                class="absolute top-2 left-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                @click.stop="removeImage(image.id)"
              >
                <svg
                  class="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧预览和设置 -->
      <div class="flex-1 flex flex-col">
        <!-- 预览区域 -->
        <div class="flex-1 bg-gray-50 flex items-center justify-center">
          <div
            v-if="selectedImages.length === 1"
            class="max-w-2xl max-h-full"
          >
            <img
              :src="getSelectedImageUrl()"
              alt="预览"
              class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            >
          </div>
          <div
            v-else-if="selectedImages.length > 1"
            class="text-center"
          >
            <svg
              class="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p class="mt-4 text-lg text-gray-600">
              已选择 {{ selectedImages.length }} 张图片
            </p>
            <p class="text-sm text-gray-500">
              将进行批量处理
            </p>
          </div>
          <div
            v-else
            class="text-center"
          >
            <svg
              class="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p class="mt-4 text-lg text-gray-600">
              选择图片进行预览
            </p>
          </div>
        </div>

        <!-- 处理设置 -->
        <div class="bg-white border-t border-gray-200 p-4">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            处理设置
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">处理模式</label>
              <select
                v-model="processingMode"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="standard">
                  标准处理
                </option>
                <option value="fast">
                  快速处理
                </option>
                <option value="high_quality">
                  高质量处理
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">输出格式</label>
              <select
                v-model="outputFormat"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="png">
                  PNG
                </option>
                <option value="jpg">
                  JPG
                </option>
                <option value="webp">
                  WebP
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">输出质量</label>
              <input
                v-model="outputQuality"
                type="range"
                min="1"
                max="100"
                class="w-full"
              >
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>低</span>
                <span>{{ outputQuality }}%</span>
                <span>高</span>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">并发数量</label>
              <input
                v-model="concurrency"
                type="number"
                min="1"
                max="10"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              >
            </div>
          </div>
          
          <!-- 提示词设置 -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">批量提示词</label>
            <textarea
              v-model="batchPrompt"
              rows="3"
              class="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="输入批量处理的提示词..."
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 进度显示 -->
    <div
      v-if="isProcessing"
      class="bg-white border-t border-gray-200 p-4"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-900">批量处理进度</span>
        <span class="text-sm text-gray-600">{{ completedCount }} / {{ totalCount }}</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: overallProgress + '%' }"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useJobStore } from '../stores/useJobStore'
import { api } from '../api/index.js'

const jobStore = useJobStore()

// 状态
const images = ref([])
const selectedImages = ref([])
const isProcessing = ref(false)
const processingMode = ref('standard')
const outputFormat = ref('png')
const outputQuality = ref(90)
const concurrency = ref(3)
const batchPrompt = ref('')

// 处理进度
const completedCount = ref(0)
const totalCount = ref(0)

// 计算属性
const overallProgress = computed(() => {
  if (totalCount.value === 0) return 0
  return (completedCount.value / totalCount.value) * 100
})

// 文件处理
const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  addFiles(files)
}

const handleDrop = (event) => {
  event.preventDefault()
  const files = Array.from(event.dataTransfer.files)
  addFiles(files)
}

const addFiles = (files) => {
  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      const id = Date.now() + Math.random()
      const url = URL.createObjectURL(file)
      
      images.value.push({
        id,
        name: file.name,
        size: file.size,
        url,
        file,
        status: 'ready',
        progress: 0
      })
    }
  })
}

// 图片选择
const selectImage = (image) => {
  const index = selectedImages.value.indexOf(image.id)
  if (index > -1) {
    selectedImages.value.splice(index, 1)
  } else {
    selectedImages.value.push(image.id)
  }
}

const selectAll = () => {
  selectedImages.value = images.value.map(img => img.id)
}

const clearSelection = () => {
  selectedImages.value = []
}

const removeImage = (imageId) => {
  const index = images.value.findIndex(img => img.id === imageId)
  if (index > -1) {
    URL.revokeObjectURL(images.value[index].url)
    images.value.splice(index, 1)
    
    const selectedIndex = selectedImages.value.indexOf(imageId)
    if (selectedIndex > -1) {
      selectedImages.value.splice(selectedIndex, 1)
    }
  }
}

const getSelectedImageUrl = () => {
  if (selectedImages.value.length === 1) {
    const image = images.value.find(img => img.id === selectedImages.value[0])
    return image?.url
  }
  return null
}

// 状态显示
const getStatusColor = (status) => {
  switch (status) {
    case 'ready': return 'text-gray-600'
    case 'processing': return 'text-blue-600'
    case 'completed': return 'text-green-600'
    case 'error': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'ready': return '就绪'
    case 'processing': return '处理中'
    case 'completed': return '已完成'
    case 'error': return '错误'
    default: return '未知'
  }
}

const getProgressColor = (status) => {
  switch (status) {
    case 'processing': return 'bg-blue-500'
    case 'completed': return 'bg-green-500'
    case 'error': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 批量处理
const startBatchProcessing = async () => {
  if (selectedImages.value.length === 0) return
  
  isProcessing.value = true
  completedCount.value = 0
  totalCount.value = selectedImages.value.length
  
  const selectedImageObjects = images.value.filter(img => selectedImages.value.includes(img.id))
  
  // 重置状态
  selectedImageObjects.forEach(img => {
    img.status = 'ready'
    img.progress = 0
  })
  
  // 并发处理
  const chunks = []
  for (let i = 0; i < selectedImageObjects.length; i += concurrency.value) {
    chunks.push(selectedImageObjects.slice(i, i + concurrency.value))
  }
  
  for (const chunk of chunks) {
    await Promise.all(chunk.map(processImage))
  }
  
  isProcessing.value = false
}

const processImage = async (image) => {
  try {
    image.status = 'processing'
    image.progress = 0
    
    // 创建 FormData
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('prompt', batchPrompt.value)
    formData.append('mode', processingMode.value)
    formData.append('format', outputFormat.value)
    formData.append('quality', outputQuality.value)
    
    // 模拟进度更新
    const progressInterval = setInterval(() => {
      if (image.progress < 90) {
        image.progress += Math.random() * 10
      }
    }, 500)
    
    // 发送请求
    const response = await api.post('/batch-process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    clearInterval(progressInterval)
    
    if (response.data.success) {
      image.status = 'completed'
      image.progress = 100
      image.resultUrl = response.data.resultUrl
      
      // 添加到作业存储
      jobStore.addJob({
        id: `batch_${image.id}`,
        status: 'completed',
        input: {
          floorplanPath: image.url,
          prompt: batchPrompt.value
        },
        output: {
          imageUrl: response.data.resultUrl
        },
        createdAt: new Date().toISOString()
      })
    } else {
      throw new Error(response.data.message || '处理失败')
    }
  } catch (error) {
    image.status = 'error'
    image.error = error.message
    console.error('Batch processing error:', error)
  } finally {
    completedCount.value++
  }
}
</script>

<style scoped>
.aspect-w-16 {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
}

.aspect-w-16 > img {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
</style>
