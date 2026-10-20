<template>
  <Teleport to="body">
    <div v-if="visible" data-testid="image-preview-modal" class="fixed inset-0 z-[200]">
      <div class="absolute inset-0 bg-black/60" @click="$emit('close')" />
      <div class="absolute inset-4 flex items-center justify-center">
        <div class="w-full max-w-5xl max-h-[90vh] bg-schemes-surface rounded-lg overflow-hidden flex flex-col">
          <div data-testid="image-preview-toolbar" class="flex items-center px-4 py-3 border-b border-schemes-outline-variant" :class="showTitle ? 'justify-between' : 'justify-end'">
            <div v-if="showTitle" class="text-schemes-on-surface text-sm truncate">
              {{ title }}
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="showActions"
                type="button"
                class="rounded bg-schemes-surface-container px-3 py-1.5 text-xs text-schemes-on-surface hover:bg-schemes-surface-container-high"
                @click="$emit('primary', image)"
              >
                设为主图
              </button>
              <button
                v-if="showActions"
                type="button"
                class="rounded bg-schemes-surface-container px-3 py-1.5 text-xs text-schemes-on-surface hover:bg-schemes-surface-container-high"
                @click="$emit('secondary', image)"
              >
                设为参考图
              </button>
              <button
                v-if="imageUrl"
                type="button"
                class="rounded bg-schemes-surface-container px-3 py-1.5 text-xs text-schemes-on-surface hover:bg-schemes-surface-container-high"
                @click="openOriginal"
              >
                查看原图
              </button>
              <button
                type="button"
                ref="closeButton"
                class="w-8 h-8 inline-flex items-center justify-center rounded bg-schemes-surface-container text-schemes-on-surface hover:bg-schemes-surface-container-high"
                aria-label="关闭预览"
                title="关闭"
                @click="$emit('close')"
              >
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
          </div>
          <div
            ref="viewportEl"
            class="flex-1 min-h-0 overflow-hidden flex items-center justify-center bg-schemes-surface-container-lowest p-4"
            :style="{ touchAction: 'none' }"
            @wheel.prevent="onWheel"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <img
              v-if="imageUrl"
              :src="imageUrl"
              :alt="title"
              class="block max-w-[calc(100vw-4rem)] max-h-[calc(100vh-10rem)] object-contain"
              :style="imageStyle"
              draggable="false"
            >
            <div v-else class="text-schemes-on-surface-variant text-sm">
              无可用图片
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

export default {
  name: 'ImagePreviewModal',
  props: {
    visible: { type: Boolean, default: false },
    image: { type: Object, default: null },
    showActions: { type: Boolean, default: true },
    showTitle: { type: Boolean, default: true },
    returnFocusElement: { type: Object, default: null }
  },
  emits: ['close', 'primary', 'secondary'],
  setup(props, { emit }) {
    const imageUrl = computed(() => props.image?.url || props.image?.path || '')
    const title = computed(() => props.image?.name || imageUrl.value || '')
    const viewportEl = ref(null)
    const closeButton = ref(null)
    let returnFocusTarget = null
    const scale = ref(1)
    const offset = ref({ x: 0, y: 0 })
    const panning = ref(false)
    const panStart = ref({ x: 0, y: 0 })
    const panOrigin = ref({ x: 0, y: 0 })
    const pointerId = ref(null)

    const resetView = () => {
      scale.value = 1
      offset.value = { x: 0, y: 0 }
      panning.value = false
      pointerId.value = null
    }

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

    const onWheel = (event) => {
      if (!props.visible || !imageUrl.value) return
      const prevScale = scale.value
      const isZoomIn = (event?.deltaY ?? 0) < 0
      const factor = isZoomIn ? 1.12 : 1 / 1.12
      const nextScale = clamp(prevScale * factor, 1, 6)
      if (nextScale === prevScale) return

      if (isZoomIn) {
        scale.value = nextScale
        return
      }

      if (nextScale <= 1) {
        resetView()
        return
      }

      const ratio = (nextScale - 1) / Math.max(1e-6, prevScale - 1)
      offset.value = { x: offset.value.x * ratio, y: offset.value.y * ratio }
      scale.value = nextScale
    }

    const onPointerDown = (event) => {
      if (!props.visible || !imageUrl.value) return
      if (scale.value <= 1) return
      if (!event?.isPrimary) return
      pointerId.value = event.pointerId
      panning.value = true
      panStart.value = { x: event.clientX, y: event.clientY }
      panOrigin.value = { x: offset.value.x, y: offset.value.y }
      try {
        viewportEl.value?.setPointerCapture?.(event.pointerId)
      } catch {
        void 0
      }
    }

    const onPointerMove = (event) => {
      if (!panning.value) return
      if (pointerId.value !== event.pointerId) return
      const dx = (event.clientX ?? 0) - panStart.value.x
      const dy = (event.clientY ?? 0) - panStart.value.y
      offset.value = { x: panOrigin.value.x + dx, y: panOrigin.value.y + dy }
    }

    const onPointerUp = (event) => {
      if (pointerId.value !== null && event?.pointerId !== undefined && pointerId.value !== event.pointerId) return
      panning.value = false
      pointerId.value = null
    }

    const cursorStyle = computed(() => {
      if (!props.visible || !imageUrl.value) return 'default'
      if (scale.value <= 1) return 'default'
      return panning.value ? 'grabbing' : 'grab'
    })

    const imageStyle = computed(() => ({
      imageOrientation: 'from-image',
      transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0) scale(${scale.value})`,
      cursor: cursorStyle.value
    }))

    const onKeydown = (event) => {
      if (!props.visible) return
      if (event?.key === 'Escape') emit('close')
    }
    watch(
      () => props.visible,
      (next) => {
        if (!next) {
          resetView()
          const target = returnFocusTarget
          returnFocusTarget = null
          if (target?.isConnected) window.requestAnimationFrame(() => target.focus?.())
        }
        if (next) {
          returnFocusTarget = props.returnFocusElement || document.activeElement
          window.requestAnimationFrame(() => closeButton.value?.focus?.())
        }
        if (next) window.addEventListener('keydown', onKeydown)
        else window.removeEventListener('keydown', onKeydown)
      },
      { immediate: true }
    )
    watch(
      () => imageUrl.value,
      () => resetView()
    )
    onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
    const openOriginal = () => {
      if (!imageUrl.value) return
      window.open(imageUrl.value, '_blank', 'noopener,noreferrer')
    }
    return { imageUrl, title, openOriginal, viewportEl, closeButton, onWheel, onPointerDown, onPointerMove, onPointerUp, imageStyle }
  }
}
</script>
