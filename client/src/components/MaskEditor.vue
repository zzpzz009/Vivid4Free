<template>
  <div class="mask-editor">
    <!-- 工具栏 -->
    <div class="bg-white border-b border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h3 class="text-lg font-medium text-gray-900">
            蒙版编辑器
          </h3>
          <div class="flex items-center space-x-2">
            <!-- 工具选择 -->
            <div class="flex bg-gray-100 rounded-lg p-1">
              <button
                v-for="tool in tools"
                :key="tool.id"
                class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                :class="{
                  'bg-white text-gray-900 shadow-sm': activeTool === tool.id,
                  'text-gray-600 hover:text-gray-900': activeTool !== tool.id
                }"
                @click="setActiveTool(tool.id)"
              >
                {{ tool.name }}
              </button>
            </div>
            
            <!-- 画笔大小 -->
            <div class="flex items-center space-x-2">
              <label class="text-sm text-gray-600">画笔大小:</label>
              <input
                v-model="brushSize"
                type="range"
                min="1"
                max="50"
                class="w-20"
              >
              <span class="text-sm text-gray-600 w-8">{{ brushSize }}</span>
            </div>
            
            <!-- 透明度 -->
            <div class="flex items-center space-x-2">
              <label class="text-sm text-gray-600">透明度:</label>
              <input
                v-model="opacity"
                type="range"
                min="0"
                max="100"
                class="w-20"
              >
              <span class="text-sm text-gray-600 w-8">{{ opacity }}%</span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-2">
          <button
            :disabled="!canUndo"
            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            @click="undoMask"
          >
            撤销
          </button>
          <button
            :disabled="!canRedo"
            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            @click="redoMask"
          >
            重做
          </button>
          <button
            class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            @click="clearMask"
          >
            清除
          </button>
          <button
            class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            @click="saveMask"
          >
            保存蒙版
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="flex-1 relative overflow-hidden">
      <div class="absolute inset-0 flex items-center justify-center bg-gray-50">
        <div
          class="relative"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        >
          <!-- 原始图像 -->
          <img
            ref="originalImage"
            :src="imageUrl"
            class="absolute inset-0 w-full h-full object-contain"
            style="pointer-events: none;"
            @load="onImageLoad"
          >
          
          <!-- 蒙版画布 -->
          <canvas
            ref="maskCanvas"
            :width="canvasWidth"
            :height="canvasHeight"
            class="absolute inset-0 cursor-crosshair"
            :style="{ opacity: showMask ? opacity / 100 : 0 }"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
          />
          
          <!-- 预览画布 -->
          <canvas
            ref="previewCanvas"
            :width="canvasWidth"
            :height="canvasHeight"
            class="absolute inset-0 pointer-events-none"
            :style="{ opacity: showPreview ? 1 : 0 }"
          />
        </div>
      </div>
    </div>

    <!-- 底部控制栏 -->
    <div class="bg-white border-t border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <label class="flex items-center">
            <input
              v-model="showMask"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm text-gray-700">显示蒙版</span>
          </label>
          <label class="flex items-center">
            <input
              v-model="showPreview"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm text-gray-700">显示预览</span>
          </label>
          <label class="flex items-center">
            <input
              v-model="invertMask"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm text-gray-700">反转蒙版</span>
          </label>
        </div>
        
        <div class="flex items-center space-x-2">
          <button
            class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            @click="loadMask"
          >
            加载蒙版
          </button>
          <button
            class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            @click="exportMask"
          >
            导出蒙版
          </button>
          <button
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            @click="applyMask"
          >
            应用蒙版
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  imageUrl: {
    type: String,
    required: true
  },
  initialMask: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['mask-updated', 'mask-applied'])

// 工具定义
const tools = [
  { id: 'brush', name: '画笔' },
  { id: 'eraser', name: '橡皮擦' },
  { id: 'fill', name: '填充' }
]

// 状态
const activeTool = ref('brush')
const brushSize = ref(10)
const opacity = ref(50)
const showMask = ref(true)
const showPreview = ref(false)
const invertMask = ref(false)

// 画布相关
const originalImage = ref(null)
const maskCanvas = ref(null)
const previewCanvas = ref(null)
const canvasWidth = ref(800)
const canvasHeight = ref(600)

// 绘制状态
const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)

// 历史记录
const maskHistory = ref([])
const historyIndex = ref(-1)
const canUndo = ref(false)
const canRedo = ref(false)

// 画布上下文
let maskCtx = null
let previewCtx = null

// 方法
const setActiveTool = (toolId) => {
  activeTool.value = toolId
}

const onImageLoad = () => {
  nextTick(() => {
    if (originalImage.value) {
      const img = originalImage.value
      const aspectRatio = img.naturalWidth / img.naturalHeight
      
      // 计算合适的画布尺寸
      const maxWidth = 800
      const maxHeight = 600
      
      if (aspectRatio > maxWidth / maxHeight) {
        canvasWidth.value = maxWidth
        canvasHeight.value = maxWidth / aspectRatio
      } else {
        canvasHeight.value = maxHeight
        canvasWidth.value = maxHeight * aspectRatio
      }
      
      initializeCanvas()
    }
  })
}

const initializeCanvas = () => {
  if (maskCanvas.value) {
    maskCtx = maskCanvas.value.getContext('2d')
    maskCtx.fillStyle = 'rgba(255, 0, 0, 0.5)'
    maskCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)'
    maskCtx.lineCap = 'round'
    maskCtx.lineJoin = 'round'
  }
  
  if (previewCanvas.value) {
    previewCtx = previewCanvas.value.getContext('2d')
  }
  
  // 加载初始蒙版
  if (props.initialMask) {
    loadMaskFromUrl(props.initialMask)
  }
  
  saveToHistory()
}

const startDrawing = (e) => {
  isDrawing.value = true
  const rect = maskCanvas.value.getBoundingClientRect()
  lastX.value = e.clientX - rect.left
  lastY.value = e.clientY - rect.top
  
  if (activeTool.value === 'fill') {
    floodFill(lastX.value, lastY.value)
  }
}

const draw = (e) => {
  if (!isDrawing.value || activeTool.value === 'fill') return
  
  const rect = maskCanvas.value.getBoundingClientRect()
  const currentX = e.clientX - rect.left
  const currentY = e.clientY - rect.top
  
  maskCtx.globalCompositeOperation = activeTool.value === 'eraser' ? 'destination-out' : 'source-over'
  maskCtx.lineWidth = brushSize.value
  
  maskCtx.beginPath()
  maskCtx.moveTo(lastX.value, lastY.value)
  maskCtx.lineTo(currentX, currentY)
  maskCtx.stroke()
  
  lastX.value = currentX
  lastY.value = currentY
  
  updatePreview()
}

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    saveToHistory()
  }
}

const floodFill = (x, y) => {
  // 简化的填充实现
  maskCtx.globalCompositeOperation = 'source-over'
  maskCtx.fillStyle = 'rgba(255, 0, 0, 0.5)'
  maskCtx.beginPath()
  maskCtx.arc(x, y, brushSize.value, 0, 2 * Math.PI)
  maskCtx.fill()
  
  updatePreview()
  saveToHistory()
}

const updatePreview = () => {
  if (!previewCtx || !originalImage.value) return
  
  previewCtx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 绘制原始图像
  previewCtx.drawImage(originalImage.value, 0, 0, canvasWidth.value, canvasHeight.value)
  
  // 应用蒙版效果
  previewCtx.globalCompositeOperation = 'multiply'
  previewCtx.drawImage(maskCanvas.value, 0, 0)
  previewCtx.globalCompositeOperation = 'source-over'
}

const saveToHistory = () => {
  const imageData = maskCtx.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 移除当前索引之后的历史记录
  maskHistory.value = maskHistory.value.slice(0, historyIndex.value + 1)
  
  // 添加新的历史记录
  maskHistory.value.push(imageData)
  historyIndex.value = maskHistory.value.length - 1
  
  // 限制历史记录数量
  if (maskHistory.value.length > 20) {
    maskHistory.value.shift()
    historyIndex.value--
  }
  
  updateHistoryButtons()
}

const updateHistoryButtons = () => {
  canUndo.value = historyIndex.value > 0
  canRedo.value = historyIndex.value < maskHistory.value.length - 1
}

const undoMask = () => {
  if (canUndo.value) {
    historyIndex.value--
    const imageData = maskHistory.value[historyIndex.value]
    maskCtx.putImageData(imageData, 0, 0)
    updateHistoryButtons()
    updatePreview()
  }
}

const redoMask = () => {
  if (canRedo.value) {
    historyIndex.value++
    const imageData = maskHistory.value[historyIndex.value]
    maskCtx.putImageData(imageData, 0, 0)
    updateHistoryButtons()
    updatePreview()
  }
}

const clearMask = () => {
  maskCtx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  saveToHistory()
  updatePreview()
}

const saveMask = () => {
  const maskDataUrl = maskCanvas.value.toDataURL('image/png')
  emit('mask-updated', maskDataUrl)
}

const loadMask = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        loadMaskFromUrl(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const loadMaskFromUrl = (url) => {
  const img = new Image()
  img.onload = () => {
    maskCtx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
    maskCtx.drawImage(img, 0, 0, canvasWidth.value, canvasHeight.value)
    saveToHistory()
    updatePreview()
  }
  img.src = url
}

const exportMask = () => {
  const link = document.createElement('a')
  link.download = 'mask.png'
  link.href = maskCanvas.value.toDataURL('image/png')
  link.click()
}

const applyMask = () => {
  const maskDataUrl = maskCanvas.value.toDataURL('image/png')
  emit('mask-applied', {
    maskUrl: maskDataUrl,
    inverted: invertMask.value
  })
}

// 监听器
watch([showPreview, invertMask], () => {
  updatePreview()
})

onMounted(() => {
  if (props.imageUrl) {
    // 图像会通过 @load 事件初始化画布
  }
})
</script>

<style scoped>
.mask-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

canvas {
  image-rendering: pixelated;
}
</style>
