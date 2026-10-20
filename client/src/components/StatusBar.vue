<template>
  <div class="pr-4 pl-4 flex flex-col gap-1 items-start justify-center w-full shrink-0">
    <div class="border-solid border-schemes-outline-variant border-t border-r-0 border-b-0 border-l-0 self-stretch shrink-0 h-0 relative -mt-px" />
    <div class="flex items-center justify-between w-full py-2">
      <div class="flex items-center gap-2">
        <!-- Loading spinner when generating -->
        <div
          v-if="isLoading"
          class="animate-spin rounded-full h-3 w-3 border-b-2 border-schemes-primary"
        />

        <!-- Status icon based on status type -->
        <div
          v-else-if="currentStatusType === 'success'"
          class="w-3 h-3 rounded-full bg-green-500"
        />
        <div
          v-else-if="currentStatusType === 'error'"
          class="w-3 h-3 rounded-full bg-red-500"
        />
        <div
          v-else-if="currentStatusType === 'warning'"
          class="w-3 h-3 rounded-full bg-yellow-500"
        />
        <div
          v-else
          class="w-3 h-3 rounded-full bg-schemes-outline-variant"
        />

        <!-- Status message -->
        <div class="text-schemes-outline-variant text-left font-m3-label-small-font-family text-m3-label-small-font-size leading-m3-label-small-line-height font-m3-label-small-font-weight letter-spacing-m3-label-small">
          {{ currentStatusMessage }}
        </div>
      </div>

      <div v-if="isDev" class="flex items-center gap-2">
        <button
          type="button"
          class="px-2 py-1 rounded-full border border-schemes-outline-variant text-[10px] leading-[12px] text-schemes-on-surface-variant hover:bg-state-layers-secondary-opacity-08"
          @click="uiStore.toggleUseGenerationMock()"
        >
          {{ uiStore.useGenerationMock ? 'MOCK: ON' : 'MOCK: OFF' }}
        </button>
        <button
          v-if="uiStore.useGenerationMock"
          type="button"
          class="px-2 py-1 rounded-full border border-schemes-outline-variant text-[10px] leading-[12px] text-schemes-primary hover:bg-state-layers-secondary-opacity-08"
          @click="uiStore.cycleMockScenario()"
        >
          {{ `SCENE: ${uiStore.mockScenario}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useJobStore, useUIStore } from '@/stores'

export default {
  name: 'StatusBar',
  setup() {
    // 直接使用 JobStore，不再依赖 props
    const jobStore = useJobStore()
    const uiStore = useUIStore()
    const { currentJob, statusMessage, isGenerating, statusType } = storeToRefs(jobStore)
    const isLoading = isGenerating
    const isDev = import.meta.env.DEV
    const normalizeStatus = (status) => (status === 'processing' ? 'running' : status)

    // 计算当前状态信息
    const currentStatusMessage = computed(() => {
      if (currentJob.value) {
        const currentStatus = normalizeStatus(currentJob.value.status)
        if (currentStatus === 'running') {
          const progress = currentJob.value.progress || 0
          const stage = currentJob.value.stageInfo || '处理中'
          return `${stage} - ${progress}%`
        }
        if (currentStatus === 'queued') {
          return '任务排队中...'
        }
        if (currentStatus === 'completed') {
          return 'Ready'  // 完成后回到就绪状态，不需要额外提示
        }
        if (currentStatus === 'failed') {
          return currentJob.value.errorMessage || '生成失败'
        }
      }
      return statusMessage.value || 'Ready'
    })

    const currentStatusType = computed(() => {
      if (currentJob.value) {
        switch (normalizeStatus(currentJob.value.status)) {
          case 'running':
          case 'queued':
            return 'info'
          case 'completed':
            return 'info'  // 完成状态使用普通样式，不需要特殊高亮
          case 'failed':
            return 'error'
          default:
            return 'info'
        }
      }
      return statusType.value || 'info'
    })

    return {
      currentStatusMessage,
      currentStatusType,
      isLoading,
      isDev,
      uiStore
    }
  }
}
</script>
