<template>
  <div
    data-testid="gallery-card"
    class="relative overflow-hidden rounded-lg border border-schemes-outline-variant bg-schemes-surface-container"
    :class="outerClass"
    :style="outerStyle"
    @click="handleClick"
    @contextmenu.prevent="handleMenu"
    @pointerdown="handlePointerDown"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
    @pointerleave="handlePointerCancel"
    @pointermove="handlePointerMove"
  >
    <img
      v-if="backgroundSrc"
      :src="backgroundSrc"
      alt=""
      class="absolute inset-0 h-full w-full scale-110 object-cover blur-md"
      aria-hidden="true"
    />
    <div
      v-else
      class="absolute inset-0"
      :style="backgroundColorStyle"
      aria-hidden="true"
    />
    <img
      :src="imgSrc"
      :alt="image?.name || ''"
      class="relative z-10 h-full w-full transition-opacity duration-200"
      :class="[imageFitClass, imageClass, isLoaded ? 'opacity-100' : 'opacity-0']"
      :style="imageStyle"
      @error="handleError"
      @load="handleLoad"
      draggable="true"
      @dragstart.stop="handleDragStart"
      loading="lazy"
      decoding="async"
    />
    <div v-if="showSkeleton" class="absolute inset-0 z-20 animate-pulse bg-schemes-surface-container-high opacity-60" />
    <div v-if="hasError" class="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
      <button type="button" class="rounded-full bg-white/70 px-3 py-1.5 text-xs text-black backdrop-blur-sm" @click.stop="retryLoad">
        重试
      </button>
    </div>
    <div v-if="showActions" class="absolute right-1 top-1 z-30 flex items-center gap-2">
      <button type="button" class="rounded-full bg-white/60 p-1.5 backdrop-blur-sm" @click.stop="emitPrimary">
        <img :src="primaryIcon" alt="" class="h-4 w-4" />
      </button>
      <button type="button" class="rounded-full bg-white/60 p-1.5 backdrop-blur-sm" @click.stop="emitSecondary">
        <img :src="secondaryIcon" alt="" class="h-4 w-4" />
      </button>
    </div>
    
    <!-- Workflow Type Badge -->
    <div v-if="workflowBadge" class="absolute top-0 left-0 z-40 pointer-events-none">
      <!-- 左上角小三角形状的深色背景 (无透明度, 缩小一半) -->
      <div 
        class="w-0 h-0 border-t-[24px] border-r-[24px] border-t-[#0f0d13] border-r-transparent rounded-tl-lg"
      ></div>
      <!-- 定位在三角中心区域的彩色文字 -->
      <span 
        class="absolute top-[2px] left-[2px] text-[8px] font-bold -rotate-45"
        :style="{ color: workflowBadge.color }"
      >{{ workflowBadge.text }}</span>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { getDragFile, warmDragFile } from '@/utils/dragImageCache.js'

export default {
  name: 'GalleryCard',
  props: {
    image: { type: Object, required: true },
    variant: { type: String, default: 'folded' },
    clickable: { type: Boolean, default: false },
    showActions: { type: Boolean, default: true },
    primaryIcon: { type: String, default: '' },
    secondaryIcon: { type: String, default: '' },
    fallbackIcon: { type: String, default: '' }
  },
  emits: ['click', 'primary', 'secondary', 'menu'],
  setup(props, { emit }) {
    const isFolded = computed(() => props.variant === 'folded')
    const imgSrc = ref(props.image?.url || '')
    const isLoaded = ref(false)
    const hasError = ref(false)
    const retryCount = ref(0)
    const longPressTimer = ref(0)
    const suppressNextClick = ref(false)
    const pressPos = ref({ x: 0, y: 0 })

    const outerClass = computed(() => {
      if (isFolded.value) return 'w-full'
      return 'w-[140px] sm:w-[165px]'
    })

    const outerStyle = computed(() => {
      const aspectRatio = isFolded.value ? '16/9' : '1/1'
      return { aspectRatio }
    })

    const imageClass = computed(() => (props.clickable ? 'cursor-pointer select-none' : 'select-none'))
    const imageFitClass = computed(() => (isFolded.value ? 'object-cover' : 'object-contain'))

    const backgroundSrc = computed(() => (typeof props.image?.lqip === 'string' && props.image.lqip ? props.image.lqip : ''))

    const backgroundColorStyle = computed(() => {
      const color = props.image?.dominantColor
      if (typeof color === 'string' && color) return { backgroundColor: color }
      return { backgroundColor: 'rgba(255,255,255,0.06)' }
    })

    const showSkeleton = computed(() => props.image?.status === 'loading')
    const imageStyle = computed(() => ({ imageOrientation: 'from-image' }))

    const workflowBadge = computed(() => {
      const wid = (props.image?.workflowId && props.image.workflowId !== 'unknown') ? props.image.workflowId : (props.image?.origin || '')
      const lower = wid.toLowerCase()
      
      // 兼容一些老的无状态/没有正确保存 workflowId 的放大流兜底逻辑
      const isFallbackUpscale = (!wid || wid === 'unknown' || lower === 'comfy-history' || lower === 'degraded-legacy' || lower === 'job') && 
                                props.image?.output?.resultUrls?.[0]?.includes('upscale')

      // 参考 UI用色标准：
      // EX(扩图): 蓝 --color-blue-500 -> #60A5FA
      // RE(局部重绘): 绿 --color-emerald-500 -> #10b981
      // ED(图像编辑): 紫亮 --color-purple-light -> #C5AEF6
      // UP(放大): 香蕉黄 --color-banana-100 -> #F9E76D
      // PR(预览): 红 --color-red-400 -> #ff6b6b

      if (lower.includes('outpaint')) {
        return { text: 'EX', color: '#60A5FA' } // 蓝
      }
      if (lower.includes('inpaint') || lower.includes('repaint')) {
        return { text: 'RE', color: '#10b981' } // 绿
      }
      if (lower.includes('image-edit') || lower.includes('single-edit') || lower.includes('imageedit')) {
        return { text: 'ED', color: '#C5AEF6' } // 紫亮
      }
      if (lower.includes('upscale') || lower.includes('generate') || lower === 'sc' || lower === 'archviz-upscale' || isFallbackUpscale) {
        return { text: 'UP', color: '#F9E76D' } // 香蕉黄
      }
      if (lower.includes('preview') || lower === 'yl') {
        return { text: 'PR', color: '#ff6b6b' } // 红
      }
      return null
    })

    watch(
      () => props.image?.url,
      (nextUrl) => {
        imgSrc.value = nextUrl || ''
        isLoaded.value = false
        hasError.value = false
        retryCount.value = 0
      }
    )

    const handleError = (_event) => {
      hasError.value = true
      isLoaded.value = false
      imgSrc.value = ''
    }

    const handleLoad = () => {
      hasError.value = false
      isLoaded.value = true
      const url = imgSrc.value || props.image?.url || props.image?.path
      if (url) {
        warmDragFile(url, props.image?.name).catch(() => null)
      }
    }

    const retryLoad = () => {
      const url = props.image?.url || ''
      if (!url) return
      retryCount.value += 1
      hasError.value = false
      isLoaded.value = false
      imgSrc.value = ''
      requestAnimationFrame(() => {
        const sep = url.includes('?') ? '&' : '?'
        imgSrc.value = `${url}${sep}retry=${retryCount.value}`
      })
      console.debug('[gallery] retry', { url, attempt: retryCount.value })
    }

    const handleClick = () => {
      if (!props.clickable) return
      if (suppressNextClick.value) {
        suppressNextClick.value = false
        return
      }
      emit('click', props.image)
    }

    const emitPrimary = () => emit('primary', props.image)
    const emitSecondary = () => emit('secondary', props.image)

    const emitMenu = (event) => {
      if (!props.clickable) return
      const x = event?.clientX ?? 0
      const y = event?.clientY ?? 0
      emit('menu', { image: props.image, x, y })
    }

    const clearLongPressTimer = () => {
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value)
        longPressTimer.value = 0
      }
    }

    const handlePointerDown = (event) => {
      if (!props.clickable) return
      if (event?.button === 2) return
      pressPos.value = { x: event?.clientX ?? 0, y: event?.clientY ?? 0 }
      clearLongPressTimer()
      longPressTimer.value = window.setTimeout(() => {
        suppressNextClick.value = true
        emitMenu(event)
      }, 520)
    }

    const handlePointerMove = (event) => {
      if (!longPressTimer.value) return
      const dx = Math.abs((event?.clientX ?? 0) - pressPos.value.x)
      const dy = Math.abs((event?.clientY ?? 0) - pressPos.value.y)
      if (dx > 8 || dy > 8) clearLongPressTimer()
    }

    const handlePointerUp = () => clearLongPressTimer()
    const handlePointerCancel = () => clearLongPressTimer()
    const handleMenu = (event) => emitMenu(event)

    const handleDragStart = (event) => {
      clearLongPressTimer()
      const url = props.image?.url || props.image?.path
      if (!url || !event?.dataTransfer) return
      const name = props.image?.name || ''
      const file = getDragFile(url)
      if (file && event.dataTransfer.items?.add) {
        try {
          event.dataTransfer.items.add(file)
        } catch (e) {
          void e
        }
      }
      const payload = JSON.stringify({
        url,
        name,
        path: props.image?.path || ''
      })
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData('application/x-va-image', payload)
      event.dataTransfer.setData('text/uri-list', url)
      event.dataTransfer.setData('text/plain', url)
      event.dataTransfer.setData('text/html', `<img src="${url}">`)
      event.dataTransfer.setData('DownloadURL', `image:${name || 'image'}:${url}`)
    }

    return {
      outerClass,
      outerStyle,
      imageClass,
      imageFitClass,
      imgSrc,
      isLoaded,
      hasError,
      backgroundSrc,
      backgroundColorStyle,
      showSkeleton,
      imageStyle,
      workflowBadge,
      handleClick,
      emitPrimary,
      emitSecondary,
      handleError,
      handleLoad,
      retryLoad,
      handlePointerDown,
      handlePointerUp,
      handlePointerCancel,
      handlePointerMove,
      handleMenu,
      handleDragStart
    }
  }
}
</script>
