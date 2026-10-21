<template>
  <div class="workspace-canvas flex-1 flex flex-col relative mx-5 my-4 min-h-0">
    <div
      v-show="resultImage"
      class="previvewimgp pt-2 pr-2.5 pb-2 pl-2.5 flex flex-col gap-2.5 items-center justify-center self-stretch shrink-0 w-5 relative"
    >
      <ImageComparisonVue
        ref="imageComparison"
        :original-image="originalImage"
        :result-image="resultImage"
        :initial-position="comparisonPosition"
        class="w-full h-full"
        @position-change="emit('position-change', $event)"
      />
    </div>

    <div
      v-show="!resultImage"
      class="canvas-empty flex items-center justify-center w-full h-full"
    >
      <div v-if="uiStore.skin === 'animal-island'" class="island-canvas-welcome">
        <div class="island-seascape" aria-hidden="true">
          <span class="island-sun"><IslandIcon name="Sun" :size="49" /></span>
          <span class="island-cloud"><IslandIcon name="Cloud" :size="55" /></span>
          <span class="island-sea island-sea-back" /><span class="island-sea island-sea-front" />
          <span class="island-boat"><IslandIcon name="Sailboat" :size="108" /></span>
          <span class="island-sprig"><IslandIcon name="Leaf" :size="36" /></span>
        </div>
        <h3>{{ actionLabel }}效果将在这里显示</h3>
        <p>{{ actionLabel === '放大' ? '从左侧选择主图，开始放大。' : '从左侧选择图片，调整参数后开始预览。' }}</p>
      </div>
      <div v-else class="text-schemes-on-surface-variant text-center">
        <div class="font-m3-body-large-emphasized-font-family text-m3-body-large-emphasized-font-size mb-2">
          请上传图片开始处理
        </div>
        <div class="font-m3-body-small-font-family text-m3-body-small-font-size">
          在左侧面板中选择待处理图片
        </div>
      </div>
    </div>

    <HistorySection
      @image-select="handleImageSelect"
      @preview-select="emit('preview-select', $event)"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import HistorySection from '../HistorySection.vue'
import ImageComparisonVue from '../ImageComparison.vue'
import { Icon as IslandIcon } from 'animal-island-vue'
import { useUIStore } from '@/stores/useUIStore.js'

export default {
  name: 'WorkspaceCanvasPanel',
  components: {
    HistorySection,
    ImageComparisonVue,
    IslandIcon
  },
  props: {
    actionLabel: { type: String, default: '预览' },
    originalImage: {
      type: String,
      default: ''
    },
    resultImage: {
      type: String,
      default: ''
    },
    comparisonPosition: {
      type: Number,
      default: 50
    }
  },
  setup(props, { emit, expose }) {
    const imageComparison = ref(null)

    const handleImageSelect = (...args) => {
      emit('image-select', ...args)
    }

    const syncOriginalImage = (imageUrl) => {
      if (imageComparison.value && typeof imageComparison.value.updateSavedImage === 'function') {
        imageComparison.value.updateSavedImage(imageUrl)
      }
    }

    expose({
      syncOriginalImage
    })

    return {
      uiStore: useUIStore(),
      emit,
      imageComparison,
      handleImageSelect
    }
  }
}
</script>

<style scoped>
.previvewimgp {
  flex: 1;
  width: 100%;
}
</style>
