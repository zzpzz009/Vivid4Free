<template>
  <div
    ref="containerEl"
    class="relative w-full"
    :style="{ height: `${layoutHeight}px` }"
  >
    <div
      v-for="item in layoutItems"
      :key="item.key"
      data-testid="gallery-expanded-item"
      role="button"
      tabindex="0"
      :aria-label="item.image?.name || '选择图片'"
      class="absolute overflow-hidden rounded-lg border border-schemes-outline-variant bg-schemes-surface-container"
      :style="item.style"
      @click="handleClick(item.key, item.image)"
      @keydown.enter.prevent="handleClick(item.key, item.image)"
      @keydown.space.prevent="handleClick(item.key, item.image)"
      @keydown="handleMenuKeydown(item.image, $event)"
      @dblclick.stop="emitDblClick(item.image)"
      @contextmenu.prevent="emitMenu(item.image, $event)"
      @pointerdown="handlePointerDown(item.key, item.image, $event)"
      @pointerup="handlePointerUp(item.key)"
      @pointercancel="handlePointerUp(item.key)"
      @pointerleave="handlePointerUp(item.key)"
      @pointermove="handlePointerMove(item.key, $event)"
    >
      <img
        v-if="item.backgroundSrc"
        :src="item.backgroundSrc"
        alt=""
        class="absolute inset-0 h-full w-full scale-110 object-cover blur-md"
        aria-hidden="true"
      />
      <div v-else class="absolute inset-0" :style="item.backgroundColorStyle" aria-hidden="true" />
      <img
        :src="item.image?.url || ''"
        :alt="item.image?.name || ''"
        class="relative z-10 h-full w-full object-contain select-none"
        :style="{ imageOrientation: 'from-image' }"
        draggable="true"
        loading="lazy"
        decoding="async"
        @dragstart.stop="handleDragStart(item.image, $event)"
      />
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
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createLongPressMenuController } from '@/utils/longPressMenuController.js'
import { getDragFile } from '@/utils/dragImageCache.js'

export default {
  name: 'GalleryExpandedGrid',
  props: {
    images: { type: Array, default: () => [] },
    minColumnWidth: { type: Number, default: 160 },
    gap: { type: Number, default: 12 },
    rowHeight: { type: Number, default: 120 },
    showActions: { type: Boolean, default: false },
    primaryIcon: { type: String, default: '' },
    secondaryIcon: { type: String, default: '' }
  },
  emits: ['click', 'dblclick', 'primary', 'secondary', 'menu'],
  setup(props, { emit }) {
    const containerEl = ref(null)
    const containerWidth = ref(0)
    const layoutHeight = ref(0)
    const positions = ref([])

    let resizeObserver = null
    const recalcWidth = () => {
      const nextWidth = Math.floor(containerEl.value?.clientWidth || 0)
      if (!nextWidth || nextWidth === containerWidth.value) return
      containerWidth.value = nextWidth
    }

    const rebuildLayout = () => {
      const list = Array.isArray(props.images) ? props.images : []
      const width = Math.max(0, Math.floor(containerWidth.value || 0))
      const gap = Math.max(0, Math.floor(Number(props.gap) || 0))
      const baseHeight = Math.max(80, Math.floor(Number(props.rowHeight) || 120))
      const fallbackAspectRatio = 1.5

      if (!width || !list.length) {
        positions.value = []
        layoutHeight.value = 0
        return
      }

      const next = []
      let x = 0
      let y = 0

      for (let i = 0; i < list.length; i++) {
        const image = list[i]
        const aspectRatio = Number.isFinite(Number(image?.aspectRatio)) && Number(image?.aspectRatio) > 0 ? Number(image.aspectRatio) : fallbackAspectRatio
        let itemWidth = Math.round(baseHeight * aspectRatio)
        itemWidth = Math.max(72, itemWidth)
        if (itemWidth > width) itemWidth = width
        const needsWrap = x > 0 && x + itemWidth > width
        if (needsWrap) {
          x = 0
          y += baseHeight + gap
        }
        next.push({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(itemWidth),
          height: baseHeight
        })
        x += itemWidth + gap
      }

      positions.value = next
      layoutHeight.value = Math.max(0, y + baseHeight)
    }

    const layoutItems = computed(() => {
      const list = Array.isArray(props.images) ? props.images : []
      return list.map((image, idx) => {
        const pos = positions.value[idx]
        const x = pos?.x ?? 0
        const y = pos?.y ?? 0
        const w = pos?.width ?? 0
        const h = pos?.height ?? 0
        const key = image?.path || image?.url || `${idx}`
        const backgroundSrc = typeof image?.lqip === 'string' && image.lqip ? image.lqip : ''
        const color = image?.dominantColor
        const backgroundColorStyle = typeof color === 'string' && color ? { backgroundColor: color } : { backgroundColor: 'rgba(255,255,255,0.06)' }
        return {
          key,
          image,
          backgroundSrc,
          backgroundColorStyle,
          style: {
            transform: `translate3d(${x}px, ${y}px, 0)`,
            width: `${w}px`,
            height: `${h}px`
          }
        }
      })
    })

    const longPress = createLongPressMenuController({ onMenu: (image, event) => emitMenu(image, event) })

    const handlePointerDown = (key, image, event) => longPress.handlePointerDown(key, image, event)
    const handlePointerMove = (key, event) => longPress.handlePointerMove(key, event)
    const handlePointerUp = (key) => longPress.handlePointerUp(key)

    const handleClick = (key, image) => {
      if (longPress.shouldSuppressClick(key)) return
      emit('click', image)
    }

    const emitDblClick = (image) => emit('dblclick', image)
    const emitPrimary = (image) => emit('primary', image)
    const emitSecondary = (image) => emit('secondary', image)
    const emitMenu = (image, event) => {
      const triggerElement = event?.currentTarget || event?.target?.closest?.('[data-testid="gallery-expanded-item"]') || null
      const rect = triggerElement?.getBoundingClientRect?.()
      emit('menu', { image, x: event?.clientX || (rect ? rect.left + 12 : 0), y: event?.clientY || (rect ? rect.top + Math.min(36, rect.height) : 0), triggerElement })
    }
    const handleMenuKeydown = (image, event) => {
      if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return
      event.preventDefault()
      event.stopPropagation()
      const target = event.target?.closest?.('[data-testid="gallery-expanded-item"]') || event.currentTarget
      const rect = target?.getBoundingClientRect?.()
      emit('menu', { image, x: rect ? rect.left + 12 : 0, y: rect ? rect.top + Math.min(36, rect.height) : 0, triggerElement: target })
    }

    const handleDragStart = (image, event) => {
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
      containerWidth.value = Math.floor(containerEl.value?.clientWidth || 0)
      rebuildLayout()
      if (containerEl.value && 'ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => {
          recalcWidth()
          rebuildLayout()
        })
        resizeObserver.observe(containerEl.value)
      }
    })

    watch(
      () => props.images,
      () => rebuildLayout(),
      { deep: false }
    )

    watch(
      () => props.rowHeight,
      () => rebuildLayout()
    )

    watch(
      () => props.gap,
      () => rebuildLayout()
    )

    onBeforeUnmount(() => {
      longPress.destroy()
      if (resizeObserver && containerEl.value) resizeObserver.unobserve(containerEl.value)
      if (resizeObserver) resizeObserver.disconnect()
    })

    return {
      containerEl,
      layoutHeight,
      layoutItems,
      handleClick,
      emitDblClick,
      emitPrimary,
      emitSecondary,
      emitMenu,
      handleMenuKeydown,
      handlePointerDown,
      handlePointerUp,
      handlePointerMove,
      handleDragStart
    }
  }
}
</script>
