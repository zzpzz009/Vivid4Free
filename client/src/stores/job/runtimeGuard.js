import { ref } from 'vue'
import { normalizeJobStatus } from './statusNormalize.js'

export const createRuntimeGuard = (ctx) => {
  const {
    api,
    jobs,
    isGenerating,
    currentJobId,
    pendingSubmissionQueue,
    submissionDispatching,
    updateJob,
    clearGeneration,
    refreshPendingQueueStage,
    resetPreviewUpscaleRunState
  } = ctx

  const ACTIVE_JOB_STALE_MS = 2 * 60 * 1000
  const REMOTE_QUEUE_ZOMBIE_MS = 90 * 1000
  const REMOTE_QUEUE_RECOVERY_WAIT_MS = 1500

  const lastRemoteQueueFingerprint = ref('')
  const lastRemoteQueueChangeAt = ref(0)

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  
  const getActivePromptId = () => {
    if (typeof window === 'undefined') return null
    return window.prompt_id || null
  }

  const isActiveStatus = (status) => ['queued', 'running'].includes(normalizeJobStatus(status))
  const isTerminalStatus = (status) => ['completed', 'failed', 'cancelled'].includes(normalizeJobStatus(status))

  const updateRemoteQueueSnapshot = (queueState) => {
    const fingerprint = JSON.stringify({
      runningIds: queueState?.runningIds || [],
      pendingIds: queueState?.pendingIds || []
    })
    if (!queueState?.totalCount) {
      lastRemoteQueueFingerprint.value = ''
      lastRemoteQueueChangeAt.value = 0
      return
    }
    if (lastRemoteQueueFingerprint.value !== fingerprint) {
      lastRemoteQueueFingerprint.value = fingerprint
      lastRemoteQueueChangeAt.value = Date.now()
    }
  }

  const hasActiveSubmittedJob = () => jobs.some((job) => isActiveStatus(job?.status) && !job?.pendingSubmission)

  const hasLocalSubmittedWork = () => (
    hasActiveSubmittedJob()
    || submissionDispatching.value
    || isGenerating.value
    || Boolean(currentJobId.value)
    || Boolean(getActivePromptId())
    || pendingSubmissionQueue.value.length > 0
  )

  const buildRemoteQueueBusyMessage = (queueState) => {
    const parts = []
    if (queueState?.runningCount) parts.push(`运行中 ${queueState.runningCount}`)
    if (queueState?.pendingCount) parts.push(`排队中 ${queueState.pendingCount}`)
    const detail = parts.join('，') || '存在未结束任务'
    return `ComfyUI 后端仍有任务未结束（${detail}）`
  }

  const markRecoveredJobsCancelled = (reason) => {
    const now = new Date().toISOString()
    jobs.forEach((job) => {
      if (!job) return
      if (job.pendingSubmission || isActiveStatus(job.status)) {
        updateJob(job.id, {
          pendingSubmission: false,
          status: 'cancelled',
          stage: '已清理',
          stageInfo: reason,
          errorMessage: reason,
          updatedAt: now,
          completedAt: now,
          progress: 0
        })
      }
    })
  }

  const getRemoteQueueStats = async () => {
    const queueState = await api.jobs.getComfyQueueState()
    updateRemoteQueueSnapshot(queueState)
    return queueState
  }

  const detectZombieComfyRun = async (queueState = null) => {
    const nextQueueState = queueState || await getRemoteQueueStats()
    if (!nextQueueState.totalCount) {
      return {
        isZombie: false,
        stableMs: 0,
        queueState: nextQueueState
      }
    }
    const stableMs = lastRemoteQueueChangeAt.value ? Date.now() - lastRemoteQueueChangeAt.value : 0
    return {
      isZombie: !hasLocalSubmittedWork() && stableMs >= REMOTE_QUEUE_ZOMBIE_MS,
      stableMs,
      queueState: nextQueueState
    }
  }

  const recoverZombieComfyRun = async ({ queueState = null, preserveRunState = false, reason = '检测到僵尸任务，已自动清理' } = {}) => {
    const nextQueueState = queueState || await getRemoteQueueStats()
    if (!nextQueueState.totalCount) {
      return { success: true, recovered: false, queueState: nextQueueState }
    }
    if (nextQueueState.runningIds.length > 0) {
      const activePromptId = getActivePromptId()
      const targetPromptId = activePromptId && nextQueueState.runningIds.includes(activePromptId)
        ? activePromptId
        : nextQueueState.runningIds[0]
      await api.jobs.interruptComfyRunningJob(targetPromptId || null)
    }
    if (nextQueueState.pendingIds.length > 0) {
      await api.jobs.clearComfyPendingJobs(nextQueueState.pendingIds)
    }
    await api.jobs.freeComfyRuntime()
    await sleep(REMOTE_QUEUE_RECOVERY_WAIT_MS)
    const afterRecoveryQueueState = await getRemoteQueueStats()
    if (afterRecoveryQueueState.totalCount) {
      return { success: false, recovered: false, queueState: afterRecoveryQueueState }
    }
    pendingSubmissionQueue.value.splice(0, pendingSubmissionQueue.value.length)
    if (typeof refreshPendingQueueStage === 'function') refreshPendingQueueStage()
    markRecoveredJobsCancelled(reason)
    if (typeof clearGeneration === 'function') clearGeneration()
    if (!preserveRunState && typeof resetPreviewUpscaleRunState === 'function') {
      resetPreviewUpscaleRunState()
    }
    return { success: true, recovered: true, queueState: afterRecoveryQueueState }
  }

  const ensureComfyReadyForNewRun = async (setStatusMessage) => {
    const queueState = await getRemoteQueueStats()
    if (!queueState.totalCount) {
      return { success: true, recovered: false, queueState }
    }
    const zombieState = await detectZombieComfyRun(queueState)
    if (!zombieState.isZombie) {
      throw new Error(buildRemoteQueueBusyMessage(queueState))
    }
    const recovered = await recoverZombieComfyRun({
      queueState,
      preserveRunState: true,
      reason: '检测到僵尸任务，已自动清理'
    })
    if (!recovered.success) {
      throw new Error('检测到疑似僵尸任务，但自动清理未完成，请稍后重试或手动清理 ComfyUI 队列')
    }
    if (typeof setStatusMessage === 'function') {
      setStatusMessage('已清理残留任务，准备重新提交...', 'info')
    }
    return recovered
  }

  const isStaleActiveSubmittedJob = (job) => {
    if (!isActiveStatus(job?.status) || job?.pendingSubmission) return false
    const anchor = job?.updatedAt || job?.createdAt
    if (!anchor) return true
    const ts = new Date(anchor).getTime()
    if (!Number.isFinite(ts)) return true
    return Date.now() - ts > ACTIVE_JOB_STALE_MS
  }

  const resetStaleActiveSubmittedJobs = (failGeneration) => {
    const staleJobs = jobs.filter((job) => isStaleActiveSubmittedJob(job))
    staleJobs.forEach((job) => {
      if (typeof failGeneration === 'function') {
        failGeneration(job.id, '任务状态过期，已自动重置，请重试')
      }
    })
    return staleJobs.length
  }

  const resetStaleGeneratingState = (failGeneration) => {
    if (!isGenerating.value) return false
    const currentJob = jobs.find((job) => job.id === currentJobId.value)
    if (!currentJob) {
      if (typeof clearGeneration === 'function') clearGeneration()
      return true
    }
    if (isTerminalStatus(currentJob.status) || isStaleActiveSubmittedJob(currentJob)) {
      if (isStaleActiveSubmittedJob(currentJob)) {
        if (typeof failGeneration === 'function') failGeneration(currentJob.id, '任务状态过期，已自动重置，请重试')
      } else {
        if (typeof clearGeneration === 'function') clearGeneration()
      }
      return true
    }
    return false
  }

  return {
    hasActiveSubmittedJob,
    getRemoteQueueStats,
    detectZombieComfyRun,
    recoverZombieComfyRun,
    ensureComfyReadyForNewRun,
    isStaleActiveSubmittedJob,
    resetStaleActiveSubmittedJobs,
    resetStaleGeneratingState
  }
}
