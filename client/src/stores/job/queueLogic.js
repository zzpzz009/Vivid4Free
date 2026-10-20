import { extractJobsArray, pickJobId } from './helpers.js'

export const createQueueLogic = (ctx) => {
  const {
    api,
    jobs,
    liveSyncEnabled,
    comfyWsConnected,
    historySyncHint,
    queuePositionMap,
    scheduleQueuePositionCommit,
    normalizeJobStatus,
    updateJob,
    addJob,
    pullRecentHistory,
    hasActiveQueueJobs,
    hydrateHistoryByIds
  } = ctx

  let queuePollTimer = null
  let recentPollTimer = null
  let recentPollIntervalMs = 0

  const stopQueuePolling = () => {
    if (queuePollTimer) {
      clearInterval(queuePollTimer)
      queuePollTimer = null
    }
  }

  const syncQueuedPositions = (queuedJobs = []) => {
    const snapshot = {}
    queuedJobs.forEach((item, index) => {
      const id = pickJobId(item)
      if (!id) return
      snapshot[id] = index + 1
    })
    scheduleQueuePositionCommit(snapshot)
  }

  const upsertActiveJobs = (activeJobs = []) => {
    activeJobs.forEach((apiJob) => {
      const id = pickJobId(apiJob)
      if (!id) return
      const existing = jobs.find((j) => j.id === id)
      const status = normalizeJobStatus(apiJob.status)
      const rawProgress = Number(apiJob.progress)
      const safeProgress = Number.isFinite(rawProgress)
        ? Math.min(100, Math.max(0, rawProgress))
        : (existing?.progress || 0)
      if (existing) {
        updateJob(id, {
          status,
          progress: safeProgress,
          stage: apiJob.stage || existing.stage || (status === 'queued' ? '排队中' : '生成中'),
          stageInfo: apiJob.stageInfo || existing.stageInfo || (status === 'queued' ? '等待资源' : `进度 ${safeProgress}%`)
        })
        return
      }
      addJob({
        id,
        title: apiJob.title || '远端任务',
        description: apiJob.description || '',
        workflowId: apiJob.workflowId || 'comfy',
        status,
        progress: safeProgress,
        stage: apiJob.stage || (status === 'queued' ? '排队中' : '生成中'),
        stageInfo: apiJob.stageInfo || (status === 'queued' ? '等待资源' : `进度 ${safeProgress}%`),
        origin: apiJob.origin || 'jobsAPI',
        createdAt: apiJob.createdAt || new Date().toISOString()
      })
    })
  }

  const runQueueSyncTick = async () => {
    if (!liveSyncEnabled.value) return
    try {
      const [queuedRes, runningRes] = await Promise.all([
        api.jobs.getQueuedJobs({ limit: 50 }),
        api.jobs.getProcessingJobs({ limit: 50 })
      ])

      const queuedJobs = extractJobsArray(queuedRes)
      const runningJobs = extractJobsArray(runningRes)
      syncQueuedPositions(queuedJobs)
      upsertActiveJobs([...queuedJobs, ...runningJobs])

      // 如果后端队列完全为空，但前端仍有认为处于活动状态的任务（由于 localStorage 残留或后端重启丢失）
      // 必须主动清理这些僵尸状态，否则前端会一直卡在“任务运行中”且阻止新任务提交
      if (queuedJobs.length === 0 && runningJobs.length === 0 && hasActiveQueueJobs()) {
        const activeIds = jobs.filter(j => ['queued', 'running', 'processing'].includes(j.status)).map(j => j.id)
        const recoveredItems = await hydrateHistoryByIds(activeIds)
        const recoveredIdSet = new Set(recoveredItems.map((item) => String(item?.id || '')))
        activeIds.filter((id) => !recoveredIdSet.has(String(id))).forEach(id => {
          updateJob(id, {
            status: 'failed',
            stage: '已中止',
            stageInfo: '后端重启或任务丢失',
            progress: 0,
            errorMessage: '检测到后端队列为空，该任务已丢失，请重新提交'
          })
        })
      }

      if (queuedJobs.length === 0 && runningJobs.length === 0 && !hasActiveQueueJobs()) {
        stopQueuePolling()
        await pullRecentHistory(3)
        const nextQueue = { ...queuePositionMap.value }
        Object.keys(nextQueue).forEach((id) => {
          const exists = jobs.find((j) => j.id === id && ['queued', 'running', 'processing'].includes(j.status))
          if (!exists) delete nextQueue[id]
        })
        scheduleQueuePositionCommit(nextQueue)
      }
    } catch (error) {
      console.error('JobsAPI queue polling failed:', error)
    }
  }

  const ensureQueuePolling = () => {
    if (!liveSyncEnabled.value) return
    if (!hasActiveQueueJobs()) {
      stopQueuePolling()
      return
    }
    if (queuePollTimer) return
    runQueueSyncTick()
    queuePollTimer = setInterval(() => {
      runQueueSyncTick()
    }, 2000)
  }

  const stopRecentPolling = () => {
    if (recentPollTimer) {
      clearInterval(recentPollTimer)
      recentPollTimer = null
    }
    recentPollIntervalMs = 0
  }

  const ensureRecentPolling = () => {
    if (!liveSyncEnabled.value) {
      stopRecentPolling()
      return
    }
    const nextInterval = hasActiveQueueJobs() ? 2000 : 10000
    if (recentPollTimer && recentPollIntervalMs === nextInterval) return
    if (recentPollTimer) {
      clearInterval(recentPollTimer)
      recentPollTimer = null
    }
    recentPollIntervalMs = nextInterval
    recentPollTimer = setInterval(() => {
      pullRecentHistory(3)
    }, nextInterval)
  }

  const startHistoryLiveSync = async (options = {}) => {
    liveSyncEnabled.value = true
    if (options?.defaultInputUrl || options?.defaultStyleUrl || options?.forceInit) {
      await ctx.initHistory(options)
    }
    ensureQueuePolling()
    ensureRecentPolling()
    comfyWsConnected.value = false
    historySyncHint.value = ''
  }

  const stopHistoryLiveSync = () => {
    liveSyncEnabled.value = false
    stopQueuePolling()
    stopRecentPolling()
    historySyncHint.value = ''
    comfyWsConnected.value = false
  }

  const syncComfyQueue = async () => ({ success: false })

  return {
    syncComfyQueue,
    stopQueuePolling,
    runQueueSyncTick,
    ensureQueuePolling,
    stopRecentPolling,
    ensureRecentPolling,
    startHistoryLiveSync,
    stopHistoryLiveSync
  }
}
