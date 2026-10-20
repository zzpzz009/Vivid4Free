import { computed } from 'vue'

export const createComputedState = (ctx) => {
  const {
    isGenerating,
    prompt,
    previewUpscaleRunState,
    currentJobId,
    jobs,
    getStageInfo,
    normalizeJobStatus,
    historyArchiveItems,
    normalizeHistoryItem,
    normalizePendingHistoryItem,
    mergeHistoryItems
  } = ctx

  const canGenerate = computed(() => {
    return !isGenerating.value && prompt.value.trim().length > 0
  })

  const canPreview = computed(() => {
    return !isGenerating.value
  })

  const isPreviewUpscaleBusy = computed(() => previewUpscaleRunState.value !== 'idle')

  const previewUpscaleActiveKind = computed(() => {
    if (previewUpscaleRunState.value === 'previewing') return 'preview'
    if (previewUpscaleRunState.value === 'upscaling') return 'upscale'
    return null
  })

  const currentJob = computed(() => {
    if (!currentJobId.value) return null

    const job = jobs.find((item) => item.id === currentJobId.value)
    if (!job) return null

    return {
      ...job,
      stageInfo: getStageInfo(job)
    }
  })

  const generationProgress = computed(() => {
    return currentJob.value?.progress || 0
  })

  const historyItems = computed(() => {
    const normalizedJobs = Array.isArray(jobs)
      ? jobs.map((item) => normalizeHistoryItem(item, item?.origin || 'job')).filter(Boolean)
      : []
    const mergedStableItems = mergeHistoryItems([normalizedJobs, historyArchiveItems.value])
    const stableIds = new Set(mergedStableItems.map((item) => item.id))
    const pendingHistoryItems = Array.isArray(jobs)
      ? jobs
          .map((item) => normalizePendingHistoryItem(item, item?.origin || 'job'))
          .filter((item) => item && !stableIds.has(item.id))
      : []
    return [...pendingHistoryItems, ...mergedStableItems]
      .sort((a, b) => (new Date(b.completedAt || b.createdAt || b.timestamp).getTime() || 0) - (new Date(a.completedAt || a.createdAt || a.timestamp).getTime() || 0))
  })

  const queuedJobs = () => jobs.filter((job) => job.status === 'queued')

  const processingJobs = () => jobs.filter((job) => normalizeJobStatus(job.status) === 'running')

  const completedJobs = () => jobs.filter((job) => job.status === 'completed')

  const failedJobs = () => jobs.filter((job) => job.status === 'failed')

  return {
    canGenerate,
    canPreview,
    isPreviewUpscaleBusy,
    previewUpscaleActiveKind,
    currentJob,
    generationProgress,
    historyItems,
    queuedJobs,
    processingJobs,
    completedJobs,
    failedJobs
  }
}
