<template>
  <div ref="containerEl" class="relative w-full" :style="{ height: `${layoutHeight}px` }">
    <div
      v-for="item in visibleItems"
      :key="item.key"
      data-testid="masonry-item"
      class="absolute"
      :style="item.style"
      :ref="(el) => observeItem(item.key, el, item.image)"
      @click="emitClick(item.key, item.image)"
      @dblclick.stop="emitDblClick(item.key, item.image)"
      @contextmenu.prevent="emitMenu(item.image, $event)"
      @pointerdown="handlePointerDown(item.key, item.image, $event)"
      @pointerup="handlePointerUp(item.key)"
      @pointercancel="handlePointerUp(item.key)"
      @pointerleave="handlePointerUp(item.key)"
      @pointermove="handlePointerMove(item.key, $event)"
    >
      <div class="relative h-full w-full overflow-hidden rounded-lg border border-schemes-outline-variant bg-schemes-surface-container">
        <img
          v-if="item.backgroundSrc"
          :src="item.backgroundSrc"
          alt=""
          class="absolute inset-0 h-full w-full scale-110 object-cover blur-md"
          aria-hidden="true"
        />
        <div v-else class="absolute inset-0" :style="item.backgroundColorStyle" aria-hidden="true" />
        <img
          v-if="item.mainSrc"
          :src="item.mainSrc"
          :alt="item.image?.name || ''"
          class="relative z-10 h-full w-full object-contain select-none transition-opacity duration-200"
          :class="item.isLoaded ? 'opacity-100' : 'opacity-0'"
          :style="{ imageOrientation: 'from-image' }"
          draggable="true"
          @dragstart.stop="handleDragStart(item.key, item.image, $event)"
          loading="lazy"
          decoding="async"
          @load="() => markLoaded(item.key, item.image)"
          @error="(e) => handleError(e, item.image)"
        />
        <div v-if="item.showSkeleton" class="absolute inset-0 z-20 animate-pulse bg-schemes-surface-container-high opacity-60" />
        <div v-if="item.showRetry" class="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
          <button type="button" class="rounded-full bg-white/70 px-3 py-1.5 text-xs text-black backdrop-blur-sm" @click.stop="retryLoad(item.key, item.image)">
            重试
          </button>
        </div>
        <div v-if="showActions" class="absolute right-1 top-1 z-30 flex items-center gap-2">
          <button type="button" class="rounded-full bg-white/60 p-1.5 backdrop-blur-sm" @click.stop="emitPrimary(item.image)">
            <img :src="primaryIcon" alt="" class="h-4 w-4" />
          </button>
          <button type="button" class="rounded-full bg-white/60 p-1.5 backdrop-blur-sm" @click.stop="emitSecondary(item.image)">
            <img :src="secondaryIcon" alt="" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { computeMasonryLayout } from '../utils/masonry.js'
import { createImageLoadController } from '../utils/imageLoadController.js'
import { createLongPressMenuController } from '../utils/longPressMenuController.js'
import { getDragFile, warmDragFile } from '@/utils/dragImageCache.js'

export default {
  name: 'MasonryGrid',
  props: {
    images: { type: Array, default: () => [] },
    minColumnWidth: { type: Number, default: 160 },
    gap: { type: Number, default: 12 },
    maxColumns: { type: Number, default: 4 },
    showActions: { type: Boolean, default: true },
    primaryIcon: { type: String, default: '' },
    secondaryIcon: { type: String, default: '' },
    fallbackIcon: { type: String, default: '' }
  },
  emits: ['click', 'dblclick', 'primary', 'secondary', 'menu'],
  setup(props, { emit }) {
    const containerEl = ref(null)
    const containerWidth = ref(0)
    const layoutHeight = ref(0)
    const positions = ref([])

    const visibleCount = ref(0)
    let rafId = 0
    let resizeObserver = null

    const controller = createImageLoadController({
      maxConcurrentLoads: 6,
      debug: (event, payload) => console.debug('[gallery]', event, payload)
    })
    const shouldLoad = controller.shouldLoad
    const loadedKeys = controller.loadedKeys
    const errorKeys = controller.errorKeys

    let firstScreenReported = false
    const mountTs = (performance?.now?.() ?? Date.now())
    const longPress = createLongPressMenuController({
      onMenu: (image, event) => {
        const x = event?.clientX ?? 0
        const y = event?.clientY ?? 0
        emit('menu', { image, x, y })
      }
    })

    const scheduleFrameRender = () => {
      if (rafId) cancelAnimationFrame(rafId)
      const total = Array.isArray(props.images) ? props.images.length : 0
      const step = 60
      const tick = () => {
        visibleCount.value = Math.min(total, visibleCount.value + step)
        if (visibleCount.value < total) {
          rafId = requestAnimationFrame(tick)
        }
      }
      visibleCount.value = Math.min(total, step)
      if (visibleCount.value < total) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const rebuildLayout = () => {
      const layout = computeMasonryLayout(props.images, containerWidth.value, {
        minColumnWidth: props.minColumnWidth,
        gap: props.gap,
        maxColumns: props.maxColumns,
        maxHeightFactor: 2.5
      })
      positions.value = layout.positions
      layoutHeight.value = layout.height
      scheduleFrameRender()
      preloadAboveFold()
    }

    const preloadAboveFold = () => {
      const list = Array.isArray(props.images) ? props.images : []
      const preloadCount = Math.min(list.length, 18)
      for (let i = 0; i < preloadCount; i++) {
        const image = list[i]
        const key = image?.path || image?.url || `${i}`
        controller.requestLoad(key, image)
      }
    }

    const visibleItems = computed(() => {
      const list = Array.isArray(props.images) ? props.images : []
      const count = Math.min(list.length, visibleCount.value)
      const sliced = list.slice(0, count)
      return sliced.map((image, idx) => {
        const pos = positions.value[idx]
        const x = pos?.x ?? 0
        const y = pos?.y ?? 0
        const w = pos?.width ?? containerWidth.value
        const h = pos?.height ?? 64
        const lqip = typeof image?.lqip === 'string' && image.lqip ? image.lqip : ''
        const dominantColor = typeof image?.dominantColor === 'string' && image.dominantColor ? image.dominantColor : 'rgba(255,255,255,0.06)'
        const key = image?.path || image?.url || `${idx}`
        const isLoaded = loadedKeys.value.has(key)
        const hasError = errorKeys.value.has(key)
        const mainSrc = shouldLoad.value.has(key) ? image?.url : ''
        return {
          key,
          image,
          backgroundSrc: lqip,
          backgroundColorStyle: { backgroundColor: dominantColor },
          mainSrc,
          isLoaded,
          showSkeleton: image?.status === 'loading' && !isLoaded,
          showRetry: hasError,
          style: {
            transform: `translate3d(${x}px, ${y}px, 0)`,
            width: `${w}px`,
            height: `${h}px`
          }
        }
      })
    })

    const handleError = (event, image) => {
      if (event?.target) event.target.src = ''
      const key = image?.path || image?.url
      if (key) controller.markError(key, image)
    }

    const retryLoad = (key, image) => {
      controller.retry(key, image)
    }

    const markLoaded = (key, image) => {
      controller.markLoaded(key, image)
      const url = image?.url || image?.path
      if (url) warmDragFile(url, image?.name).catch(() => null)
      if (!firstScreenReported && loadedKeys.value.size >= Math.min(12, visibleCount.value || 12)) {
        firstScreenReported = true
        const now = (performance?.now?.() ?? Date.now())
        console.debug('[gallery] first-screen loaded', { loaded: loadedKeys.value.size, ms: Math.round(now - mountTs) })
      }
    }

    const observeItem = (key, el, image) => controller.observe(key, el, image)

    const emitClick = (key, image) => {
      if (longPress.shouldSuppressClick(key)) return
      emit('click', image)
    }
    const emitDblClick = (key, image) => {
      handlePointerUp(key)
      emit('dblclick', image)
    }
    const emitPrimary = (image) => emit('primary', image)
    const emitSecondary = (image) => emit('secondary', image)
    const emitMenu = (image, event) => emit('menu', { image, x: event?.clientX ?? 0, y: event?.clientY ?? 0 })
    const handlePointerDown = (key, image, event) => longPress.handlePointerDown(key, image, event)
    const handlePointerMove = (key, event) => longPress.handlePointerMove(key, event)
    const handlePointerUp = (key) => longPress.handlePointerUp(key)
    const handleDragStart = (key, image, event) => {
      handlePointerUp(key)
      const url = image?.url || image?.path
      if (!url || !event?.dataTransfer) return
      const name = image?.name || ''
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
        path: image?.path || ''
      })
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData('application/x-va-image', payload)
      event.dataTransfer.setData('text/uri-list', url)
      event.dataTransfer.setData('text/plain', url)
      event.dataTransfer.setData('text/html', `<img src="${url}">`)
      event.dataTransfer.setData('DownloadURL', `image:${name || 'image'}:${url}`)
    }

    onMounted(() => {
      if (containerEl.value && 'ResizeObserver' in window) {
        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0]
          const nextWidth = Math.floor(entry.contentRect.width)
          if (!nextWidth || nextWidth === containerWidth.value) return
          containerWidth.value = nextWidth
          rebuildLayout()
        })
        resizeObserver.observe(containerEl.value)
      }
      const initialWidth = containerEl.value?.clientWidth || 0
      containerWidth.value = initialWidth
      rebuildLayout()
    })

    const urlsKey = computed(() => {
      const list = Array.isArray(props.images) ? props.images : []
      return list.map((img) => (typeof img?.url === 'string' && img.url ? img.url : (typeof img?.path === 'string' ? img.path : ''))).join('\n')
    })

    const ratiosKey = computed(() => {
      const list = Array.isArray(props.images) ? props.images : []
      return list.map((img) => (Number.isFinite(img?.aspectRatio) ? String(img.aspectRatio) : '')).join('|')
    })

    watch(urlsKey, () => {
      firstScreenReported = false
      controller.reset()
      rebuildLayout()
    })

    watch(ratiosKey, () => {
      rebuildLayout()
    })

    onBeforeUnmount(() => {
      if (resizeObserver && containerEl.value) resizeObserver.unobserve(containerEl.value)
      if (resizeObserver) resizeObserver.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
      controller.disconnect()
      longPress.destroy()
    })

    return {
      containerEl,
      layoutHeight,
      visibleItems,
      observeItem,
      emitClick,
      emitDblClick,
      emitPrimary,
      emitSecondary,
      emitMenu,
      handlePointerDown,
      handlePointerUp,
      handlePointerMove,
      handleDragStart,
      retryLoad,
      markLoaded,
      handleError
    }
  }
}
</script>
