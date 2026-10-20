<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div v-if="isLoading" class="flex items-center justify-center h-32">
      <div class="text-schemes-on-surface-variant">加载中...</div>
    </div>
    <div v-else-if="currentImages.length === 0" class="flex items-center justify-center h-32">
      <div class="text-center">
        <img :src="imageIcon" alt="No Images" class="w-12 h-12 mb-2 opacity-50 mx-auto" />
        <div class="text-schemes-on-surface-variant text-sm">暂无图片</div>
        <div class="text-schemes-on-surface-variant text-xs mt-1">点击顶部“导入图库”添加本地图片</div>
      </div>
    </div>
    <div v-else class="flex-1 min-h-0 w-full">
      <div v-if="isExpanded" class="w-full flex flex-col gap-3">
        <div class="w-full flex items-center justify-between gap-3">
          <input
            v-model="searchText"
            type="text"
            placeholder="搜索图片..."
            class="pod-input pod-input-sm pod-input-filled flex-1 max-w-[360px]"
          >
          <div class="text-xs text-schemes-on-surface-variant whitespace-nowrap">{{ filteredImages.length }}/{{ currentImages.length }}</div>
        </div>
        <GalleryExpandedGrid
          :images="filteredImages"
          :gap="8"
          :row-height="150"
          :show-actions="false"
          :primary-icon="jdcl"
          :secondary-icon="jck"
          @click="handleImageClick"
          @dblclick="handleImageDblClick"
          @menu="openMenu"
          @primary="selectImage"
          @secondary="selectCkImage"
        />
      </div>
      <div v-else class="flex flex-col gap-3 w-full">
        <GalleryCard
          v-for="image in currentImages"
          :key="image.path || image.url"
          :image="image"
          variant="folded"
          :clickable="true"
          :show-actions="false"
          :primary-icon="jdcl"
          :secondary-icon="jck"
          :fallback-icon="imageIcon"
          @click="handleImageClick"
          @dblclick.stop="handleImageDblClick(image)"
          @menu="openMenu"
          @primary="selectImage"
          @secondary="selectCkImage"
        />
      </div>
    </div>
    <ImageActionsMenu
      :visible="menuVisible"
      :position="menuStyle"
      @close="closeMenu"
      @primary="menuPrimary"
      @secondary="menuSecondary"
      @preview="menuPreview"
      @open-original="menuOpenOriginal"
      @copy="menuCopy"
    />
    <ImagePreviewModal
      :visible="previewVisible"
      :image="previewImage"
      :return-focus-element="previewReturnFocus"
      @close="closePreview"
      @primary="previewPrimary"
      @secondary="previewSecondary"
    />
  </div>
</template>

<script>
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { icons } from '../utils/assets.js'
import { useGalleryStore } from '../stores/useGalleryStore.js'
import { useUIStore } from '@/stores/useUIStore.js'
import { useImageStore } from '../stores'
import { useXMStore } from '@/stores/xmStore.js'
import { useToast } from '@/utils/toast.js'
import { useImagePreviewMenu } from '@/composables/useImagePreviewMenu.js'
import GalleryCard from './GalleryCard.vue'
import GalleryExpandedGrid from './GalleryExpandedGrid.vue'
import ImagePreviewModal from './ui/ImagePreviewModal.vue'
import ImageActionsMenu from './ui/ImageActionsMenu.vue'
export default {
  name: 'GalleryPanel',
  components: { GalleryCard, GalleryExpandedGrid, ImagePreviewModal, ImageActionsMenu },
  props: {
    active: { type: Boolean, default: true },
    isExpanded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['image-select'],
  setup(props, { emit }) {
    const { info } = useToast()
    const galleryStore = useGalleryStore()
    const uiStore = useUIStore()
    const { currentImages, isLoading } = storeToRefs(galleryStore)
    const searchText = computed({
      get: () => uiStore.gallerySearchText,
      set: (value) => uiStore.setGallerySearchText(value)
    })

    const filteredImages = computed(() => {
      const list = Array.isArray(currentImages.value) ? currentImages.value : []
      const q = String(searchText.value || '').trim().toLowerCase()
      if (!q) return list
      return list.filter((img) => {
        const name = String(img?.name || '').toLowerCase()
        const path = String(img?.path || '').toLowerCase()
        const url = String(img?.url || '').toLowerCase()
        return name.includes(q) || path.includes(q) || url.includes(q)
      })
    })
    const jdcl = icons.jdcl
    const jck = icons.jck
    const imageIcon = icons.image || icons.reference

    const clickimg = (image) => {
      const xm  = useXMStore()
      emit('image-select', image,function(result){
        if(!xm.dclimg){
          xm.savedclimg(result.name)
          const imageStore = useImageStore()
          image.preview = image.url;
          imageStore.setUploadedImageFile(image)
          return;
        }else if(!xm.ckimg){
          xm.saveckimg(result.name)
          const imageStore = useImageStore()
          image.preview = image.url;
          imageStore.setUploadedReferenceFile(image)
          return;
        }else{
          info('已经有图片选中了')
          return;
        }
      })
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
      previewReturnFocus,
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

    watch(() => props.active, (active) => {
      if (!active) {
        closeMenu()
        closePreview()
      }
    })

    let clickTimer = 0
    const handleImageClick = (image) => {
      if (clickTimer) window.clearTimeout(clickTimer)
      clickTimer = window.setTimeout(() => {
        clickTimer = 0
        clickimg(image)
      }, 240)
    }

    const handleImageDblClick = (image) => {
      if (clickTimer) {
        window.clearTimeout(clickTimer)
        clickTimer = 0
      }
      if (image) openPreview(image)
    }

    onMounted(async () => {
      await galleryStore.loadCategories()
    })

    return {
      isLoading,
      currentImages,
      searchText,
      filteredImages,
      imageIcon,
      selectImage,
      selectCkImage,
      clickimg,
      handleImageClick,
      handleImageDblClick,
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
