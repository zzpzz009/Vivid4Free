<template>
  <div class="flex flex-1 min-h-0">
    <UnifiedSidebar
      mode="workspace"
      :multiple-images="false"
      :multiple-references="false"
      :show-advanced-params="true"
      :show-brush-button="false"
      :preview-upscale-run-state="previewUpscaleRunState"
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
      :original-image="uploadedImage?.preview"
      :result-image="previewimgurl"
      :comparison-position="comparisonPosition"
      @position-change="handleComparisonPositionChange"
      @image-select="selectimg"
      @preview-select="handleHistoryPreviewSelect"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import UnifiedSidebar from './UnifiedSidebar.vue'
import WorkspaceCanvasPanel from './workspace/WorkspaceCanvasPanel.vue'
import { useWorkspaceAssetInputs } from '@/composables/workspace/useWorkspaceAssetInputs.js'
import { useWorkspaceTaskOrchestrator } from '@/composables/workspace/useWorkspaceTaskOrchestrator.js'

export default {
  name: 'WorkspaceContent',
  components: {
    UnifiedSidebar,
    WorkspaceCanvasPanel
  },
  setup() {
    const canvasPanel = ref(null)
    const comparisonPosition = ref(50)

    const handleComparisonPositionChange = (position) => {
      if (typeof position === 'number' && Number.isFinite(position)) {
        comparisonPosition.value = Math.max(0, Math.min(100, position))
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
      previewUpscaleRunState,
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

    return {
      canvasPanel,
      comparisonPosition,
      uploadedReferenceFile,
      uploadedImage,
      previewimgurl,
      previewUpscaleRunState,
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
