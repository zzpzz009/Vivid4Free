<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div v-if="isLoading" class="flex items-center justify-center h-32">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-schemes-primary mx-auto mb-2" />
        <div class="text-schemes-on-surface-variant text-sm">加载中...</div>
      </div>
    </div>

    <div v-else-if="displayImages.length === 0" class="flex flex-col items-center justify-center h-32 text-center">
      <img :src="imageIcon" alt="No Usage Data" class="w-12 h-12 mb-2 opacity-50" />
      <div class="text-schemes-on-surface-variant text-sm">还没有使用过图片</div>
      <div class="text-schemes-on-surface-variant text-xs mt-1">在图库中使用图片后会显示在这里</div>
    </div>

    <div v-else class="flex-1 min-h-0 w-full">
      <div v-if="isExpanded" class="w-full">
        <MasonryGrid
          :images="displayImages"
          :min-column-width="160"
          :gap="12"
          :max-columns="4"
          :show-actions="false"
          :primary-icon="jdcl"
          :secondary-icon="jck"
          :fallback-icon="imageIcon"
          @click="openPreview"
          @menu="openMenu"
          @primary="selectImage"
          @secondary="selectCkImage"
        />
      </div>

      <div v-else class="flex flex-col gap-3 w-full">
        <GalleryCard
          v-for="imageData in displayImages"
          :key="imageData.url"
          :image="imageData"
          variant="folded"
          :primary-icon="jdcl"
          :secondary-icon="jck"
          :fallback-icon="imageIcon"
          :clickable="true"
          :show-actions="false"
          @click="openPreview"
          @menu="openMenu"
          @primary="selectImage"
          @secondary="selectCkImage"
        />
      </div>
    </div>

    <div v-if="menuVisible" class="fixed inset-0 z-[210]" @click="closeMenu">
      <div class="absolute rounded-lg border border-schemes-outline-variant bg-schemes-surface px-2 py-2 shadow-lg" :style="menuStyle" @click.stop>
        <button type="button" class="w-full text-left px-2 py-2 text-xs text-schemes-on-surface hover:bg-schemes-surface-container rounded" @click="menuPreview">预览</button>
        <button type="button" class="w-full text-left px-2 py-2 text-xs text-schemes-on-surface hover:bg-schemes-surface-container rounded" @click="menuPrimary">设为主图</button>
        <button type="button" class="w-full text-left px-2 py-2 text-xs text-schemes-on-surface hover:bg-schemes-surface-container rounded" @click="menuSecondary">设为参考图</button>
        <button type="button" class="w-full text-left px-2 py-2 text-xs text-schemes-on-surface hover:bg-schemes-surface-container rounded" @click="menuOpenOriginal">查看原图</button>
        <button type="button" class="w-full text-left px-2 py-2 text-xs text-schemes-on-surface hover:bg-schemes-surface-container rounded" @click="menuCopy">复制链接</button>
      </div>
    </div>

    <ImagePreviewModal :visible="previewVisible" :image="previewImage" @close="closePreview" @primary="previewPrimary" @secondary="previewSecondary" />
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { icons } from '../utils/assets.js'
import { useImageUsage } from '../composables/useImageUsage.js'
import { useImageStore,useXMStore } from '@/stores'
import { useImagePreviewMenu } from '@/composables/useImagePreviewMenu.js'
import xmAPI from '../api/xmapi.js'
import { probeImageMeta } from '../utils/imageMeta.js'
import GalleryCard from './GalleryCard.vue'
import MasonryGrid from './MasonryGrid.vue'
import ImagePreviewModal from './ui/ImagePreviewModal.vue'

export default {
  name: 'FavoritesPanel',
  components: { GalleryCard, MasonryGrid, ImagePreviewModal },
  props: {
    isExpanded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['image-select'],
  setup(props, { emit }) {
    const { clearUsageData, isLoading } = useImageUsage()

    const displayImages = ref(JSON.parse(localStorage.getItem('cyimg')) || [])
    const imageIcon = icons.image || icons.reference
    const jdcl = icons.jdcl
    const jck = icons.jck
    const checkImages = async () => {
      try {
        const result = await xmAPI.filterfiles(JSON.parse(localStorage.getItem('cyimg')) || [])
        return Array.isArray(result?.data?.images) ? result.data.images : []
      } catch (_) {
        return JSON.parse(localStorage.getItem('cyimg')) || []
      }
    }
    const updateDisplayImages = async () => {
      try {
        displayImages.value = await checkImages()
        void enrichDisplayImages(displayImages.value)
      } catch (_) {
        displayImages.value = []
      }
    }

    const normalizeFavorites = (images) => {
      const list = Array.isArray(images) ? images : []
      return list.map((img, index) => {
        if (!img || typeof img !== 'object') return img
        const url = img.url
        return {
          id: img.id ?? url ?? `${index}`,
          name: img.name ?? url ?? `${index}`,
          path: img.path ?? url ?? `${index}`,
          url,
          width: img.width ?? null,
          height: img.height ?? null,
          aspectRatio: img.aspectRatio ?? null,
          dominantColor: img.dominantColor ?? null,
          lqip: img.lqip ?? null,
          status: img.status ?? 'idle'
        }
      })
    }

    const enrichDisplayImages = async (images) => {
      const normalized = normalizeFavorites(images)
      displayImages.value = normalized
      const targets = normalized.slice(0, 30).filter((img) => img && typeof img.url === 'string' && (!img.aspectRatio || !img.lqip || !img.dominantColor))
      const queue = targets.slice()
      const workers = new Array(Math.min(4, queue.length)).fill(0).map(async () => {
        while (queue.length) {
          const item = queue.shift()
          if (!item) continue
          try {
            item.status = 'loading'
            const meta = await probeImageMeta(item.url, { computeDominantColor: true, computeLqip: true })
            if (meta) {
              item.width = meta.width ?? item.width
              item.height = meta.height ?? item.height
              item.aspectRatio = meta.aspectRatio ?? item.aspectRatio
              item.exifOrientation = meta.exifOrientation ?? item.exifOrientation
              item.dominantColor = meta.dominantColor ?? item.dominantColor
              item.lqip = meta.lqip ?? item.lqip
            }
            item.status = 'ready'
          } catch {
            item.status = 'error'
          }
        }
      })
      await Promise.all(workers)
    }
    
    const selectImage = (image) => {
      const xm  = useXMStore()
      xm.deldcl()
      const imageStore = useImageStore()
      imageStore.clearImage()
      image.preview = image.url;
      imageStore.setUploadedImageFile(image)
            xm.savedclimg(image.name)
      emit('image-select', {image,type:'dcl'})
    }

    const selectCkImage = (image) => {
      const xm  = useXMStore()
      xm.delck()
      const imageStore = useImageStore()
      imageStore.clearReference()
      image.preview = image.url;
      imageStore.setUploadedReferenceFile(image)
            xm.saveckimg(image.name)
      emit('image-select', {image,type:'ck'})
    }

    const previewPrimary = (image) => {
      selectImage(image)
      closePreview()
    }

    const previewSecondary = (image) => {
      selectCkImage(image)
      closePreview()
    }

    const {
      previewVisible,
      previewImage,
      openPreview,
      closePreview,
      menuVisible,
      menuStyle,
      openMenu,
      closeMenu,
      menuPreview,
      menuPrimary,
      menuSecondary,
      menuCopy,
      menuOpenOriginal
    } = useImagePreviewMenu({ onPrimary: selectImage, onSecondary: selectCkImage })

    const clearAllUsage = async () => {
      if (confirm('确定要清空所有使用统计吗？此操作不可撤销。')) {
        await clearUsageData()
        updateDisplayImages()
      }
    }

    onMounted(async () => {
      // Ensure data is loaded before updating display
      if (isLoading.value) {
        await new Promise(resolve => {
          const unwatch = watch(isLoading, (newValue) => {
            if (!newValue) {
              unwatch()
              resolve()
            }
          })
        })
      }
      updateDisplayImages()
    })

    watch(isLoading, (newValue, oldValue) => {
      if (oldValue && !newValue) {
        updateDisplayImages()
      }
    })
    return {
      displayImages,
      isLoading,
      imageIcon,
      selectImage,
      selectCkImage,
      clearAllUsage,
      updateDisplayImages,
      jdcl,
      jck,
      previewVisible,
      previewImage,
      openPreview,
      closePreview,
      previewPrimary,
      previewSecondary,
      menuVisible,
      menuStyle,
      openMenu,
      closeMenu,
      menuPreview,
      menuPrimary,
      menuSecondary,
      menuCopy,
      menuOpenOriginal
    }
  }
}
</script>
