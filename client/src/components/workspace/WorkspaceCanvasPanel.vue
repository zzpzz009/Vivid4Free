<template>
  <div class="flex-1 flex flex-col relative mx-5 my-4 min-h-0">
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
      class="flex items-center justify-center w-full h-full"
    >
      <div class="text-schemes-on-surface-variant text-center">
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

export default {
  name: 'WorkspaceCanvasPanel',
  components: {
    HistorySection,
    ImageComparisonVue
  },
  props: {
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
