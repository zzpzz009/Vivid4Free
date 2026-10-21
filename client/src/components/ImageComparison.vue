<template>
  <div
    ref="comparisonRef"
    class="relative w-full h-full overflow-hidden rounded-xl cursor-ew-resize"
    @mouseenter="handleHoverEnter"
    @mouseleave="handleHoverLeave"
    @mousemove="handleHoverMove"
  >
    <!-- Original Image (Left Side) -->
    <div
      class="absolute inset-0 overflow-hidden image-clip-left"
      :class="{ 'no-transition': isDragging || isHovering }"
      :style="{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }"
    >
      <img
        v-if="savedOriginalImage"
        :src="savedOriginalImage"
        alt="Original Image"
        class="w-full h-full object-contain"
        draggable="false"
      >
      <div 
        v-else
        class="w-full h-full flex items-center justify-center bg-schemes-surface-container-low text-schemes-on-surface-variant"
      >
        <div class="text-center">
          <div class="text-sm">
            原图
          </div>
          <div class="text-xs opacity-70 mt-1">
            暂无图片
          </div>
        </div>
      </div>
    </div>

    <!-- Result Image (Right Side) -->
    <div
      class="absolute inset-0 overflow-hidden image-clip-right"
      :class="{ 'no-transition': isDragging || isHovering }"
      :style="{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }"
    >
      <img
        v-if="resultImage"
        :src="resultImage"
        alt="Result Image"
        class="w-full h-full object-contain"
        draggable="false"
      >
      <div 
        v-else
        class="w-full h-full flex items-center justify-center bg-schemes-surface-container-low text-schemes-on-surface-variant"
      >
        <div class="text-center">
          <div class="text-sm">
            结果图
          </div>
          <div class="text-xs opacity-70 mt-1">
            暂无图片
          </div>
        </div>
      </div>
    </div>

    <!-- Divider Line -->
    <div 
      class="absolute top-0 bottom-0 w-px bg-schemes-outline-variant shadow-md z-10 pointer-events-none"
      :style="{ left: `${sliderPosition}%` }"
    >
      <!-- Divider Handle -->
      <div 
        role="slider" tabindex="0" aria-label="原图与结果图分界" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="Math.round(sliderPosition)" @keydown="handleSliderKeydown" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-schemes-surface-container-high rounded-full shadow-sm border border-schemes-outline-variant pointer-events-auto flex items-center justify-center"
        @mousedown="startDragging"
        @touchstart="startDragging"
      >
        <div class="flex gap-[3px]">
          <div class="w-[2px] h-3 bg-schemes-outline rounded-full" />
          <div class="w-[2px] h-3 bg-schemes-outline rounded-full" />
        </div>
      </div>
    </div>

    <!-- Labels -->
    <div class="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
      原图
    </div>
    <div class="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs navs">
      结果图
    </div>
  </div>
</template>

<script>
import { ref, onUnmounted, watch } from 'vue'

export default {
  name: 'ImageComparison',
  props: {
    originalImage: {
      type: String,
      default: null
    },
    resultImage: {
      type: String,
      default: null
    },
    initialPosition: {
      type: Number,
      default: 50,
      validator: (value) => value >= 0 && value <= 100
    }
  },
  emits: ['position-change'],
  setup(props, { emit }) {
    // const originalImage1 = ref(null)
    // var internalOriginalImage = ref(Object.assign({},props).originalImage)
    const savedOriginalImage = ref(null)
    if (props.originalImage) {
      savedOriginalImage.value = props.originalImage
      // savedOriginalImage.value = window.thissc.dcl;
    }

    watch(() => props.originalImage, (newVal) => {
      savedOriginalImage.value = newVal || null
    }, { immediate: true })
    const updateSavedImage = (newImageSrc) => {
      savedOriginalImage.value = newImageSrc || null
    }
    // nextTick(() => {
    //   internalOriginalImage = ref(props.originalImage)
    // })
    const sliderPosition = ref(props.initialPosition)
    const isDragging = ref(false)
    const containerRef = ref(null)
    const comparisonRef = ref(null)
    const isHovering = ref(false)
    let hoverRaf = 0
    let pendingClientX = null
    let bounceRaf = 0
    let bounceTimer = 0

    const clampPercentage = (value) => Math.max(0, Math.min(100, value))

    const cancelBounce = () => {
      if (bounceRaf) {
        cancelAnimationFrame(bounceRaf)
        bounceRaf = 0
      }
      if (bounceTimer) {
        window.clearTimeout(bounceTimer)
        bounceTimer = 0
      }
    }

    const updateSliderFromClientX = (clientX) => {
      const container = comparisonRef.value || containerRef.value
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      sliderPosition.value = percentage
      emit('position-change', percentage)
    }

    const handleSliderKeydown = (event) => {
      const increments = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }
      if (event.key === 'Home' || event.key === 'End' || increments[event.key]) {
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : clampPercentage(sliderPosition.value + increments[event.key] * (event.shiftKey ? 10 : 2))
        sliderPosition.value = next
        emit('position-change', next)
      }
    }

    const startDragging = (event) => {
      cancelBounce()
      isDragging.value = true
      event.preventDefault()

      // Store reference to the container element
      containerRef.value = comparisonRef.value || event.target.closest('.relative')

      // Add global event listeners
      document.addEventListener('mousemove', handleDrag)
      document.addEventListener('mouseup', stopDragging)
      document.addEventListener('touchmove', handleDrag)
      document.addEventListener('touchend', stopDragging)
    }

    const handleDrag = (event) => {
      if (!isDragging.value) return

      event.preventDefault()

      const clientX = event.type.includes('touch')
        ? event.touches[0].clientX
        : event.clientX
      updateSliderFromClientX(clientX)
    }

    const stopDragging = () => {
      isDragging.value = false
      containerRef.value = null

      // Remove global event listeners
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', stopDragging)
      document.removeEventListener('touchmove', handleDrag)
      document.removeEventListener('touchend', stopDragging)
    }

    const handleHoverEnter = () => {
      cancelBounce()
      isHovering.value = true
    }

    const handleHoverLeave = () => {
      isHovering.value = false
      pendingClientX = null
      if (hoverRaf) {
        cancelAnimationFrame(hoverRaf)
        hoverRaf = 0
      }

      cancelBounce()
      if (isDragging.value) return

      const settlePosition = Number(sliderPosition.value)
      const direction = settlePosition < 50 ? -1 : 1
      const overshoot = clampPercentage(settlePosition + direction * 1.2)
      if (Math.abs(overshoot - settlePosition) < 0.001) return

      bounceRaf = requestAnimationFrame(() => {
        bounceRaf = 0
        sliderPosition.value = overshoot
        emit('position-change', overshoot)
        bounceTimer = window.setTimeout(() => {
          bounceTimer = 0
          sliderPosition.value = settlePosition
          emit('position-change', settlePosition)
        }, 110)
      })
    }

    const handleHoverMove = (event) => {
      if (!isHovering.value || isDragging.value) return
      pendingClientX = event.clientX
      if (hoverRaf) return
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0
        if (pendingClientX == null) return
        updateSliderFromClientX(pendingClientX)
      })
    }
    // const uploadimg = ()=>{
    //   originalImage1.value = props.originalImage
    // }
    // 提供给父组件的方法：更新原始图片
    // const updateOriginalImage = (imageSrc) => {
    //   if (imageSrc) {
    //     internalOriginalImage = imageSrc
    //   }
    // }
    // defineExpose({
    //   // uploadimg
    //   updateOriginalImage
    // });

    // onMounted(() => {
    //   // debugger;
    //   uploadimg()
    // })


    // Cleanup on unmount
    onUnmounted(() => {
      cancelBounce()
      if (isDragging.value) {
        stopDragging()
      }
    })

    // Watch for prop changes
    const updatePosition = (newPosition) => {
      const next = clampPercentage(Number(newPosition))
      if (Number.isFinite(next) && next !== sliderPosition.value) sliderPosition.value = next
    }

    watch(() => props.initialPosition, updatePosition)

    return {
      // originalImage1,
      sliderPosition,
      isDragging,
      isHovering,
      containerRef,
      comparisonRef,
      startDragging,
      handleDrag,
      handleHoverEnter,
      handleHoverLeave,
      handleHoverMove,
      handleSliderKeydown,

      updateSavedImage,
      savedOriginalImage,
      stopDragging
      
    }
  }
}
</script>

<style scoped>
.navs{
  width:22em;
  pointer-events:none;
  background:transparent;
  text-align: right;
}
/* Prevent text selection during drag */
.relative {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* Smooth transitions when not dragging */
.image-clip-left,
.image-clip-right {
  transition: clip-path 0.15s ease-out;
  will-change: clip-path;
}

/* Disable transitions during dragging for immediate response */
.image-clip-left.no-transition,
.image-clip-right.no-transition {
  transition: none;
}

/* Cursor styles */
.cursor-ew-resize {
  cursor: ew-resize;
}

.cursor-ew-resize:active {
  cursor: grabbing;
}
</style>
