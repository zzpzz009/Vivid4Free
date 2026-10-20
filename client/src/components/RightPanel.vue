<template>
  <div
    class="h-full flex flex-col overflow-x-hidden transition-all duration-200 ease-out"
    :class="variant === 'docked' ? 'mx-4' : 'w-full'"
    :style="variant === 'docked' ? { width: isExpanded ? '360px' : 'var(--right-toolbar-controls-width)', maxWidth: isExpanded ? '90vw' : undefined } : undefined"
  >
    <div
      ref="scrollArea"
      class="rounded-lg flex flex-col gap-2.5 items-start justify-start w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      :class="isExpanded ? 'p-0 bg-transparent' : (variant === 'docked' ? 'pt-4 pb-8 px-0 bg-transparent' : 'py-4 px-0 bg-transparent')"
      :style="isExpanded ? undefined : { width: 'calc(100% + var(--scrollbar-size))', marginRight: 'calc(var(--scrollbar-size) * -1)' }"
      @scroll.passive="rememberScroll"
    >
      <FavoritesPanel
        v-show="activeTab === 'common'"
        :active="activeTab === 'common'"
        class="w-full"
        :is-expanded="isExpanded"
        @image-select="selectImage"
      />
      <GalleryPanel
        v-show="activeTab === 'gallery'"
        :active="activeTab === 'gallery'"
        class="w-full"
        :is-expanded="isExpanded"
        @image-select="selectImage"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useUIStore } from '@/stores/useUIStore.js'
import GalleryPanel from './GalleryPanel.vue'
import FavoritesPanel from './FavoritesPanel.vue'

defineProps({
  variant: { type: String, default: 'docked' },
  activeTab: { type: String, default: 'common' },
  isExpanded: { type: Boolean, default: false }
})
const emit = defineEmits(['image-select'])

const uiStore = useUIStore()
const scrollArea = ref(null)
const rememberScroll = (event) => uiStore.setRightPanelScrollTop(event.currentTarget.scrollTop)

const normalizeSelection = (payload) => {
  if (!payload) return { image: null, type: 'ck' }
  if (payload.image) return { image: payload.image, type: payload.type || 'ck' }
  return { image: payload, type: 'ck' }
}

const savebd = (image) => {
  if (!image) return
  const url = image.url || image.path || ''
  if (!url) return
  let data = []
  try { data = JSON.parse(localStorage.getItem('cyimg')) || [] } catch {}
  const index = data.findIndex((item) => item.url === url)
  if (index < 0) data.push({ url, count: 1 })
  else data[index].count = (Number(data[index].count) || 0) + 1
  data.sort((a, b) => b.count - a.count)
  localStorage.setItem('cyimg', JSON.stringify(data))
}

const selectImage = (payload, callback) => {
  const selection = normalizeSelection(payload)
  if (!selection.image) return
  savebd(selection.image)
  emit('image-select', selection, callback)
}

onMounted(() => {
  if (scrollArea.value) scrollArea.value.scrollTop = uiStore.rightPanelScrollTop
})
</script>
