<template>
  <footer class="status-bar" role="status" aria-live="polite">
    <span class="status-dot" :class="[`status-${currentStatusType}`, { loading: isLoading }]" aria-hidden="true" />
    <span>{{ currentStatusMessage }}</span>
  </footer>
</template>
<script setup>
import { computed } from 'vue'
import { useJobStore } from '@/stores'
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
  return store.statusMessage === 'Ready' ? '就绪' : store.statusMessage || '就绪'
})
const currentStatusType = computed(() => state.value === 'failed' ? 'error' : state.value === 'completed' ? 'success' : isLoading.value ? 'active' : store.statusType || 'info')
</script>
<style scoped>
.status-bar{display:flex;align-items:center;gap:var(--space-2);flex:none;min-height:32px;padding:var(--space-2) var(--space-4);border-top:1px solid var(--border-color);background:var(--workspace-bg-header);color:var(--text-secondary);font-size:11px;line-height:16px}.status-dot{width:8px;height:8px;flex:none;border-radius:var(--border-radius-circle);background:var(--text-muted)}.status-success{background:var(--ui-green-color)}.status-error{background:var(--color-red-500)}.status-active{background:var(--brand-primary)}.loading{border:2px solid var(--border-color);border-top-color:var(--brand-primary);background:transparent;animation:status-spin 1s linear infinite}@keyframes status-spin{to{transform:rotate(360deg)}}
</style>
