<template>
  <div class="status-bar pr-4 pl-4 flex flex-col gap-1 items-start justify-center w-full shrink-0">
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
<script setup>
import { computed } from 'vue'
import { useJobStore, useUIStore } from '@/stores'
const uiStore = useUIStore()
const isDev = import.meta.env.DEV
const store = useJobStore()
const job = computed(() => store.currentJob)
const state = computed(() => job.value?.status === 'processing' ? 'running' : job.value?.status)
const isLoading = computed(() => ['submitting', 'queued', 'running'].includes(state.value))
const currentStatusMessage = computed(() => {
  if (state.value === 'running') return `${job.value.stageInfo || '生成中'} · 进度 ${Math.round(Number(job.value.progress) || 0)}%`
  if (state.value === 'submitting') return '正在提交任务…'
  if (state.value === 'submission_unknown') return '提交状态待确认，请核对当前任务'
  if (state.value === 'queued') return '任务排队中'
  if (state.value === 'completed') return '任务已完成'
  if (state.value === 'cancelled') return '任务已取消'
  if (state.value === 'failed') return job.value.errorMessage || '任务失败，请检查后重试'
  const ready = uiStore.skin === 'animal-island' ? '准备就绪' : 'Ready'
  return store.statusMessage === 'Ready' ? ready : store.statusMessage || ready
})
const currentStatusType = computed(() => state.value === 'failed' ? 'error' : state.value === 'completed' ? 'success' : isLoading.value ? 'active' : store.statusType || 'info')
</script>
