<template>
  <div class="flex flex-1 min-h-0">
    <UnifiedSidebar
      mode="workspace"
      :multiple-images="false"
      :multiple-references="false"
      :show-advanced-params="true"
      :show-brush-button="false"
      :preview-upscale-run-state="previewUpscaleRunState"
      :submitting="isSubmitting"
      :engine-ready="engineReady"
      generate-button-text="生成"
      :external-reference-image="uploadedReferenceFile"
      @upload-image="handleImageUpload"
      @upload-reference="handleReferenceUpload"
      @clear-image="handleClearImage"
      @clear-reference="handleClearReference"
      @prompt-change="handlePromptChange"
      @size-change="handleSizeChange"
      @generate="handleUpscale"
      @preview="handlePreview"
      @cancel-rw="handleCancel"
    />

    <WorkspaceCanvasPanel
      ref="canvasPanel"
      :original-image="previewOriginalImage"
      :result-image="previewimgurl"
      :comparison-position="comparisonPosition"
      @position-change="handleComparisonPositionChange"
      @image-select="selectimg"
      @preview-select="handleHistoryPreviewSelect"
    />
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import UnifiedSidebar from './UnifiedSidebar.vue'
import WorkspaceCanvasPanel from './workspace/WorkspaceCanvasPanel.vue'
import { useWorkspaceAssetInputs } from '@/composables/workspace/useWorkspaceAssetInputs.js'
import { useWorkspaceTaskOrchestrator } from '@/composables/workspace/useWorkspaceTaskOrchestrator.js'
import { useUIStore } from '@/stores/useUIStore.js'
import { useJobStore } from '@/stores/useJobStore.js'

export default {
  name: 'WorkspaceContent',
  components: {
    UnifiedSidebar,
    WorkspaceCanvasPanel
  },
  props: {
    engineReady: { type: Boolean, default: true }
  },
  setup() {
    const uiStore = useUIStore()
    const jobStore = useJobStore()
    const canvasPanel = ref(null)
    const comparisonPosition = computed({
      get: () => uiStore.comparisonSliderPosition,
      set: (value) => uiStore.setComparisonSliderPosition(value)
    })

    const handleComparisonPositionChange = (position) => {
      if (typeof position === 'number' && Number.isFinite(position)) {
        uiStore.setComparisonSliderPosition(position)
      }
    }

    const {
      uploadedReferenceFile,
      uploadedImage,
      handleImageUpload,
      handleReferenceUpload,
      handleClearImage,
      handleClearReference,
      handlePromptChange,
      handleSizeChange,
      selectimg
    } = useWorkspaceAssetInputs()

    const {
      previewimgurl,
      previewOriginalImage,
      previewUpscaleRunState,
      isSubmitting,
      handleUpscale,
      handlePreview,
      handleCancel,
      handleHistoryPreviewSelect
    } = useWorkspaceTaskOrchestrator({
      uploadedImage,
      uploadedReferenceFile,
      syncOriginalImage: (imageUrl) => {
        canvasPanel.value?.syncOriginalImage(imageUrl)
      }
    })

    onMounted(() => jobStore.loadJobsFromStorage())

    return {
      canvasPanel,
      comparisonPosition,
      uploadedReferenceFile,
      uploadedImage,
      previewimgurl,
      previewOriginalImage,
      previewUpscaleRunState,
      isSubmitting,
      handleComparisonPositionChange,
      handleImageUpload,
      handleReferenceUpload,
      handleClearImage,
      handleClearReference,
      handlePromptChange,
      handleSizeChange,
      selectimg,
      handleUpscale,
      handlePreview,
      handleCancel,
      handleHistoryPreviewSelect
    }
  }
}
</script>
