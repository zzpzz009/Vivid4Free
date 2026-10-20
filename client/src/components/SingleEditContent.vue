<template>
  <div class="flex flex-1 min-h-0">
    <div class="flex h-full min-h-0 shrink-0 flex-col">
      <div class="px-4 pt-4 pb-2">
        <div class="flex w-[265px] items-center gap-1 rounded-corner-medium bg-schemes-surface-container p-1">
          <button
            v-for="mode in editModes"
            :key="mode.id"
            type="button"
            class="min-w-0 flex-1 rounded-lg px-3 py-2 text-center text-sm transition-colors"
            :class="currentEditMode.id === mode.id ? 'bg-schemes-primary-container text-schemes-on-primary-container font-semibold' : 'text-schemes-on-surface-variant hover:bg-schemes-surface-container-high'"
            @click="currentEditMode = mode"
          >
            {{ mode.name }}
          </button>
        </div>
        <div v-if="currentEditMode.supportsMask && maskPreviewUrl" class="mt-2 flex items-center gap-2 text-xs">
          <span class="rounded-full bg-schemes-surface-container px-2 py-1 text-schemes-on-surface-variant">
            已绘制蒙版
          </span>
        </div>
      </div>

      <UnifiedSidebar
        class="min-h-0 flex-1"
        mode="workspace"
        :multiple-images="false"
        :multiple-references="false"
        :show-advanced-params="false"
        :show-brush-button="currentEditMode.supportsMask"
        :show-action-dropdown="false"
        :show-reference-upload="currentEditMode.supportsReference"
        :show-random-seed="currentEditMode.showRandomSeed"
        :show-reference-strength="currentEditMode.showReferenceStrength"
        :show-color-match-strength="currentEditMode.showColorMatchStrength"
        :show-add-scene="currentEditMode.showAddScene"
        :show-output-size="currentEditMode.supportsOutputSize"
        :show-redraw="currentEditMode.supportsRedraw"
        :preview-upscale-run-state="previewUpscaleRunState"
        :base-image-with-mask="baseImageWithMask"
        :mask-image="maskPreviewUrl"
        :image-upload-title="currentEditMode.imageUploadTitle"
        image-upload-subtitle="将图像拖到这里上传\n或 点我选择图片"
        :reference-upload-title="currentEditMode.referenceUploadTitle"
        reference-upload-subtitle="将图像拖到这里上传\n或 点我选择图片"
        :prompt-label="currentEditMode.promptLabel"
        :default-prompt-text="currentEditMode.defaultPromptText"
        primary-action-label="生成"
        :generate-button-text="currentEditMode.actionText"
        :external-reference-image="uploadedReferenceFile"
        @upload-image="handleImageUpload"
        @upload-reference="handleReferenceUpload"
        @clear-image="handleClearImage"
        @clear-reference="handleClearReference"
        @prompt-change="handleSingleEditPromptChange"
        @size-change="handleSizeChange"
        @generate="handleRun"
        @preview="handleRun"
        @cancel-rw="handleCancel"
        @open-mask-editor="openMaskEditor"
      >
        <template #extra-controls>
          <div v-if="currentEditMode.id === 'outpaint'" class="w-[265px] space-y-3">
            <div class="pl-1 text-sm font-medium text-schemes-on-surface-variant">
              扩图范围
            </div>
            <div class="grid grid-cols-2 gap-2">
              <label
                v-for="field in outpaintFields"
                :key="field.key"
                class="rounded-xl bg-schemes-surface-container px-3 py-2 transition-colors hover:bg-schemes-surface-container-high"
              >
                <div class="mb-1 text-xs font-medium text-schemes-on-surface-variant">
                  {{ field.label }}
                </div>
                <div class="relative">
                  <input
                    v-model.number="outpaintValues[field.key]"
                    type="number"
                    min="0"
                    step="1"
                    class="h-9 w-full rounded-lg border border-transparent bg-schemes-surface px-3 py-1.5 pr-9 text-sm text-schemes-on-surface outline-none transition-all focus:border-schemes-primary"
                    placeholder="0"
                    @blur="normalizeOutpaintValue(field.key)"
                  >
                  <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-schemes-outline">
                    px
                  </span>
                </div>
              </label>
            </div>
          </div>
        </template>
      </UnifiedSidebar>
    </div>

    <WorkspaceCanvasPanel
      ref="canvasPanel"
      :original-image="uploadedImage?.preview"
      :result-image="resultImage"
      :comparison-position="comparisonPosition"
      @position-change="handleComparisonPositionChange"
      @image-select="selectimg"
      @preview-select="handleHistoryPreviewSelect"
    />

    <MaskEditorModal
      v-if="isMaskEditorVisible && uploadedImage?.preview"
      :base-image="uploadedImage.preview"
      :initial-mask="maskPreviewUrl"
      @save-mask="handleMaskSave"
      @close="closeMaskEditor"
    />
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import UnifiedSidebar from './UnifiedSidebar.vue'
import WorkspaceCanvasPanel from './workspace/WorkspaceCanvasPanel.vue'
import MaskEditorModal from './MaskEditorModal.vue'
import { useWorkspaceAssetInputs } from '@/composables/workspace/useWorkspaceAssetInputs.js'
import { useSingleEditTaskOrchestrator } from '@/composables/workspace/useSingleEditTaskOrchestrator.js'
import { useToast } from '@/utils/toast.js'
import { singleEditModes } from '@/config/singleEditModes.js'
import { useAssetStore } from '@/stores'

const outpaintFields = [
  { key: 'left', label: '往左扩' },
  { key: 'top', label: '往上扩' },
  { key: 'right', label: '往右扩' },
  { key: 'bottom', label: '往下扩' }
]

export default {
  name: 'SingleEditContent',
  components: {
    UnifiedSidebar,
    WorkspaceCanvasPanel,
    MaskEditorModal
  },
  setup() {
    const { info, success, error } = useToast()
    const assetStore = useAssetStore()
    const { maskFile } = storeToRefs(assetStore)
    const canvasPanel = ref(null)
    const comparisonPosition = ref(50)
    const currentEditMode = ref(singleEditModes[0])
    const isMaskEditorVisible = ref(false)
    const outpaintValues = ref({
      left: 200,
      top: 0,
      right: 200,
      bottom: 0
    })

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
    } = useWorkspaceAssetInputs({
      shouldResizeFile: (type) => !(type === 'dcl' && currentEditMode.value?.id === 'inpaint')
    })

    const maskPreviewUrl = computed(() => maskFile.value?.preview || '')
    const baseImageWithMask = computed(() => uploadedImage.value?.preview || null)

    const {
      previewimgurl: resultImage,
      previewUpscaleRunState,
      setPromptValue,
      handleGenerate,
      handleCancel,
      handleHistoryPreviewSelect
    } = useSingleEditTaskOrchestrator({
      uploadedImage,
      uploadedReferenceFile,
      outpaintValues,
      syncOriginalImage: (imageUrl) => {
        canvasPanel.value?.syncOriginalImage(imageUrl)
      }
    })

    const normalizeOutpaintValue = (key) => {
      const current = Number(outpaintValues.value[key] ?? 0)
      outpaintValues.value[key] = Number.isFinite(current) ? Math.max(0, Math.round(current)) : 0
    }

    watch(currentEditMode, async (nextMode) => {
      if (!nextMode?.supportsMask) {
        isMaskEditorVisible.value = false
        await assetStore.clearMask()
      }
      if (!nextMode?.supportsReference) {
        await handleClearReference()
      }
    }, { immediate: true })

    const handleSingleEditPromptChange = (newPrompt) => {
      handlePromptChange(newPrompt)
      setPromptValue(newPrompt)
    }

    const handleRun = async () => {
      await handleGenerate(currentEditMode.value)
    }

    const openMaskEditor = () => {
      if (!currentEditMode.value.supportsMask) {
        return
      }
      if (!uploadedImage.value?.preview) {
        info('请先上传待处理图片，再绘制蒙版')
        return
      }
      isMaskEditorVisible.value = true
    }

    const closeMaskEditor = () => {
      isMaskEditorVisible.value = false
    }

    const handleMaskSave = async (maskDataUrl) => {
      try {
        const maskBlob = await fetch(maskDataUrl).then((response) => response.blob())
        const nextMaskFile = new File([maskBlob], 'single-edit-mask.png', { type: 'image/png' })
        const result = await assetStore.setMaskFile(nextMaskFile)
        if (!result?.success) {
          throw new Error(result?.error || '蒙版保存失败')
        }
        isMaskEditorVisible.value = false
        success('蒙版已保存')
      } catch (err) {
        error(`蒙版保存失败：${err.message || '未知错误'}`)
      }
    }

    const handleSingleEditClearImage = async () => {
      await handleClearImage()
      await assetStore.clearMask()
      isMaskEditorVisible.value = false
    }

    return {
      canvasPanel,
      comparisonPosition,
      currentEditMode,
      editModes: singleEditModes,
      outpaintFields,
      outpaintValues,
      isMaskEditorVisible,
      uploadedReferenceFile,
      uploadedImage,
      resultImage,
      previewUpscaleRunState,
      maskPreviewUrl,
      baseImageWithMask,
      handleComparisonPositionChange,
      normalizeOutpaintValue,
      handleImageUpload,
      handleReferenceUpload,
      handleClearImage: handleSingleEditClearImage,
      handleClearReference,
      handleSingleEditPromptChange,
      handleSizeChange,
      handleRun,
      openMaskEditor,
      closeMaskEditor,
      handleMaskSave,
      handleCancel,
      handleHistoryPreviewSelect,
      selectimg
    }
  }
}
</script>
