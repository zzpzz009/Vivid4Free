<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-schemes-surface rounded-lg max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-schemes-outline-variant">
        <h2 class="text-lg font-medium text-schemes-on-surface">
          蒙版编辑器
        </h2>
        <button
          class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-schemes-surface-container-high transition-colors"
          @click="handleClose"
        >
          <img
            class="w-5 h-5"
            :src="closeIcon"
            alt="Close"
          >
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Canvas Area -->
        <div class="flex-1 p-4 flex items-center justify-center">
          <div class="relative">
            <!-- Base Image -->
            <img
              v-if="baseImage"
              ref="baseImageRef"
              :src="baseImage"
              alt="Base Image"
              class="max-w-full max-h-full object-contain"
              @load="handleImageLoad"
            >
            
            <!-- Canvas for mask drawing -->
            <canvas
              ref="maskCanvas"
              class="absolute inset-0 opacity-60"
              :class="brushMode === 'fill' ? 'cursor-crosshair' : 'cursor-none'"
              @mousedown="startDrawing"
              @mousemove="handlePointerMove"
              @mouseup="stopDrawing"
              @mouseleave="handlePointerLeave"
              @mouseenter="handlePointerEnter"
            />
            <div
              v-if="showBrushPreview"
              class="pointer-events-none absolute rounded-full border-2 border-white/95 bg-white/10 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
              :class="brushMode === 'erase' ? 'border-red-400/95 bg-red-400/10' : 'border-white/95 bg-white/10'"
              :style="brushPreviewStyle"
            />
          </div>
        </div>

        <!-- Tools Panel -->
        <div class="w-64 p-4 border-l border-schemes-outline-variant flex flex-col gap-4">
          <!-- Brush Settings -->
          <div class="space-y-3">
            <h3 class="text-sm font-medium text-schemes-on-surface">
              画笔设置
            </h3>
            
            <!-- Brush Size -->
            <div class="space-y-2">
              <label class="text-xs text-schemes-on-surface-variant">画笔大小</label>
              <input
                v-model="brushSize"
                type="range"
                min="1"
                max="50"
                class="w-full accent-schemes-primary"
              >
              <div class="text-xs text-schemes-on-surface-variant text-center">
                {{ brushSize }}px
              </div>
            </div>

            <!-- Brush Mode -->
            <div class="space-y-2">
              <label class="text-xs text-schemes-on-surface-variant">模式</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  :class="brushMode === 'paint' ? 'bg-schemes-primary text-schemes-on-primary' : 'bg-schemes-surface-container text-schemes-on-surface'"
                  class="flex-1 py-2 px-3 rounded text-xs font-medium transition-colors"
                  @click="brushMode = 'paint'"
                >
                  绘制
                </button>
                <button
                  :class="brushMode === 'erase' ? 'bg-schemes-primary text-schemes-on-primary' : 'bg-schemes-surface-container text-schemes-on-surface'"
                  class="flex-1 py-2 px-3 rounded text-xs font-medium transition-colors"
                  @click="brushMode = 'erase'"
                >
                  擦除
                </button>
                <button
                  :class="brushMode === 'fill' ? 'bg-schemes-primary text-schemes-on-primary' : 'bg-schemes-surface-container text-schemes-on-surface'"
                  class="flex-1 py-2 px-3 rounded text-xs font-medium transition-colors"
                  @click="brushMode = 'fill'"
                >
                  填充
                </button>
              </div>
              <div class="text-xs text-schemes-on-surface-variant">
                先画出闭环，再切到填充并点击圈内区域
              </div>
            </div>
          </div>

          <!-- Mask Invert Option -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <input
                id="mask-invert-editor"
                v-model="maskInverted"
                type="checkbox"
                class="rounded border-schemes-outline"
              >
              <label
                for="mask-invert-editor"
                class="text-schemes-on-surface text-sm cursor-pointer"
              >
                反选蒙版（重绘未选中区域）
              </label>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-2">
            <button
              class="w-full py-2 px-3 bg-schemes-surface-container text-schemes-on-surface rounded text-sm font-medium hover:bg-schemes-surface-container-high transition-colors"
              @click="clearMask"
            >
              清除蒙版
            </button>
          </div>



          <!-- Keyboard Shortcuts -->
          <div class="space-y-2">
            <label class="text-xs text-schemes-on-surface-variant">快捷键</label>
            <div class="text-xs text-schemes-on-surface-variant space-y-1">
              <div>B - 画笔模式</div>
              <div>E - 擦除模式</div>
              <div>F - 填充模式</div>
              <div>Ctrl+C - 清除蒙版</div>
              <div>Ctrl+Enter - 保存</div>
              <div>Esc - 取消</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 p-4 border-t border-schemes-outline-variant">
        <button
          class="py-2 px-4 bg-schemes-surface-container text-schemes-on-surface rounded text-sm font-medium hover:bg-schemes-surface-container-high transition-colors"
          @click="handleClose"
        >
          取消
        </button>
        <button
          class="py-2 px-4 bg-schemes-primary text-schemes-on-primary rounded text-sm font-medium hover:bg-opacity-80 transition-colors"
          @click="handleSave"
        >
          保存蒙版
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { icons } from '../utils/assets.js'

export default {
  name: 'MaskEditorModal',
  props: {
    baseImage: {
      type: String,
      required: true
    },
    initialMask: {
      type: String,
      default: null
    }
  },
  emits: ['save-mask', 'close', 'mask-invert-change'],
  setup(props, { emit }) {
    const baseImageRef = ref(null)
    const maskCanvas = ref(null)
    const isDrawing = ref(false)
    const showBrushPreview = ref(false)
    const brushSize = ref(20)
    const brushMode = ref('paint')
    const maskInverted = ref(false)
    const closeIcon = icons.close
    const pointerState = {
      lastX: 0,
      lastY: 0,
      displayX: 0,
      displayY: 0
    }

    let displayCtx = null
    let offscreenCanvas = null
    let offscreenCtx = null
    let displayWidth = 0
    let displayHeight = 0
    let naturalWidth = 0
    let naturalHeight = 0

    const redrawMaskPreview = () => {
      if (!displayCtx || !maskCanvas.value || !offscreenCanvas) return
      displayCtx.clearRect(0, 0, displayWidth, displayHeight)
      displayCtx.save()
      displayCtx.globalAlpha = 1
      displayCtx.drawImage(offscreenCanvas, 0, 0, displayWidth, displayHeight)
      displayCtx.restore()
    }

    const brushPreviewStyle = ref({
      width: '20px',
      height: '20px',
      left: '0px',
      top: '0px'
    })

    const updateBrushPreview = (event) => {
      const rect = maskCanvas.value?.getBoundingClientRect()
      if (!rect) return null
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      pointerState.displayX = Math.max(0, Math.min(displayWidth, localX))
      pointerState.displayY = Math.max(0, Math.min(displayHeight, localY))
      brushPreviewStyle.value = {
        width: `${brushSize.value}px`,
        height: `${brushSize.value}px`,
        left: `${pointerState.displayX - (brushSize.value / 2)}px`,
        top: `${pointerState.displayY - (brushSize.value / 2)}px`
      }
      return rect
    }

    const handleImageLoad = async () => {
      await nextTick()
      if (baseImageRef.value && maskCanvas.value) {
        const img = baseImageRef.value
        const canvas = maskCanvas.value

        displayWidth = img.clientWidth
        displayHeight = img.clientHeight
        naturalWidth = img.naturalWidth || img.clientWidth
        naturalHeight = img.naturalHeight || img.clientHeight

        canvas.width = displayWidth
        canvas.height = displayHeight
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`

        displayCtx = canvas.getContext('2d')
        offscreenCanvas = document.createElement('canvas')
        offscreenCanvas.width = naturalWidth
        offscreenCanvas.height = naturalHeight
        offscreenCtx = offscreenCanvas.getContext('2d')
        offscreenCtx.lineCap = 'round'
        offscreenCtx.lineJoin = 'round'

        if (props.initialMask) {
          loadInitialMask()
        } else {
          redrawMaskPreview()
        }
      }
    }

    const loadInitialMask = () => {
      const img = new Image()
      img.onload = () => {
        if (!offscreenCtx) return
        offscreenCtx.clearRect(0, 0, naturalWidth, naturalHeight)
        offscreenCtx.drawImage(img, 0, 0, naturalWidth, naturalHeight)
        redrawMaskPreview()
      }
      img.src = props.initialMask
    }

    const fillContiguousRegion = (x, y) => {
      if (!offscreenCtx || !offscreenCanvas) return
      const width = offscreenCanvas.width
      const height = offscreenCanvas.height
      const startX = Math.max(0, Math.min(width - 1, Math.round(x)))
      const startY = Math.max(0, Math.min(height - 1, Math.round(y)))
      const imageData = offscreenCtx.getImageData(0, 0, width, height)
      const data = imageData.data
      const stack = [[startX, startY]]
      const visited = new Uint8Array(width * height)
      const alphaThreshold = 8

      while (stack.length) {
        const [currentX, currentY] = stack.pop()
        if (currentX < 0 || currentY < 0 || currentX >= width || currentY >= height) {
          continue
        }
        const visitIndex = (currentY * width) + currentX
        if (visited[visitIndex]) {
          continue
        }
        visited[visitIndex] = 1

        const pixelIndex = visitIndex * 4
        if (data[pixelIndex + 3] > alphaThreshold) {
          continue
        }

        data[pixelIndex] = 255
        data[pixelIndex + 1] = 255
        data[pixelIndex + 2] = 255
        data[pixelIndex + 3] = 255

        stack.push([currentX + 1, currentY])
        stack.push([currentX - 1, currentY])
        stack.push([currentX, currentY + 1])
        stack.push([currentX, currentY - 1])
      }

      offscreenCtx.putImageData(imageData, 0, 0)
    }

    const toNaturalPoint = (event) => {
      const rect = updateBrushPreview(event) || maskCanvas.value?.getBoundingClientRect()
      if (!rect) return null
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const x = (localX / Math.max(1, rect.width)) * naturalWidth
      const y = (localY / Math.max(1, rect.height)) * naturalHeight
      return {
        x: Math.max(0, Math.min(naturalWidth, x)),
        y: Math.max(0, Math.min(naturalHeight, y))
      }
    }

    const stampBrush = (x, y) => {
      if (!offscreenCtx) return
      const scale = Math.max(
        naturalWidth / Math.max(1, displayWidth),
        naturalHeight / Math.max(1, displayHeight)
      )
      const radius = Math.max(0.5, (brushSize.value * scale) / 2)
      offscreenCtx.save()
      offscreenCtx.globalCompositeOperation = brushMode.value === 'erase' ? 'destination-out' : 'source-over'
      offscreenCtx.fillStyle = 'rgba(255, 255, 255, 1)'
      offscreenCtx.beginPath()
      offscreenCtx.arc(x, y, radius, 0, Math.PI * 2)
      offscreenCtx.fill()
      offscreenCtx.restore()
    }

    const startDrawing = (e) => {
      if (!offscreenCtx) return
      const point = toNaturalPoint(e)
      if (!point) return
      if (brushMode.value === 'fill') {
        fillContiguousRegion(point.x, point.y)
        redrawMaskPreview()
        return
      }
      isDrawing.value = true
      pointerState.lastX = point.x
      pointerState.lastY = point.y
      stampBrush(point.x, point.y)
      redrawMaskPreview()
    }

    const draw = (e) => {
      if (!isDrawing.value || !offscreenCtx) return
      const point = toNaturalPoint(e)
      if (!point) return

      offscreenCtx.save()
      offscreenCtx.globalCompositeOperation = brushMode.value === 'erase' ? 'destination-out' : 'source-over'
      offscreenCtx.strokeStyle = 'rgba(255, 255, 255, 1)'
      offscreenCtx.lineWidth = Math.max(
        1,
        brushSize.value * Math.max(
          naturalWidth / Math.max(1, displayWidth),
          naturalHeight / Math.max(1, displayHeight)
        )
      )
      offscreenCtx.beginPath()
      offscreenCtx.moveTo(pointerState.lastX, pointerState.lastY)
      offscreenCtx.lineTo(point.x, point.y)
      offscreenCtx.stroke()
      offscreenCtx.restore()

      pointerState.lastX = point.x
      pointerState.lastY = point.y
      redrawMaskPreview()
    }

    const handlePointerMove = (e) => {
      showBrushPreview.value = brushMode.value !== 'fill'
      updateBrushPreview(e)
      if (isDrawing.value) {
        draw(e)
      }
    }

    const handlePointerEnter = (e) => {
      showBrushPreview.value = brushMode.value !== 'fill'
      updateBrushPreview(e)
    }

    const handlePointerLeave = () => {
      showBrushPreview.value = false
      stopDrawing()
    }

    const stopDrawing = () => {
      if (!isDrawing.value) return
      isDrawing.value = false
    }

    const clearMask = () => {
      if (offscreenCtx) {
        offscreenCtx.clearRect(0, 0, naturalWidth, naturalHeight)
        redrawMaskPreview()
      }
    }

    const handleSave = () => {
      if (offscreenCanvas) {
        const maskDataUrl = offscreenCanvas.toDataURL('image/png')
        emit('save-mask', maskDataUrl, maskInverted.value)
      }
    }

    const handleClose = () => {
      emit('close')
    }

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'b':
        case 'B':
          brushMode.value = 'paint'
          break
        case 'e':
        case 'E':
          brushMode.value = 'erase'
          break
        case 'f':
        case 'F':
          brushMode.value = 'fill'
          break
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            clearMask()
          }
          break
        case 'Escape':
          handleClose()
          break
        case 'Enter':
          if (e.ctrlKey || e.metaKey) {
            handleSave()
          }
          break
      }
    }

    onMounted(() => {
      nextTick(() => {
        if (props.baseImage) {
          handleImageLoad()
        }
      })
      document.addEventListener('keydown', handleKeyDown)
    })

    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeyDown)
    })

    return {
      baseImageRef,
      maskCanvas,
      isDrawing,
      showBrushPreview,
      brushSize,
      brushMode,
      brushPreviewStyle,

      maskInverted,
      closeIcon,
      handleImageLoad,
      startDrawing,
      draw,
      handlePointerMove,
      handlePointerEnter,
      handlePointerLeave,
      stopDrawing,
      clearMask,
      handleSave,
      handleClose
    }
  }
}
</script>

<style scoped>
canvas {
  image-rendering: pixelated;
}
</style>
