export const createSubmissionQueue = (ctx) => {
  const {
    pendingSubmissionQueue,
    updateJob,
    addJob,
    jobs,
    progressMap,
    queuePositionMap,
    scheduleQueuePositionCommit,
    setCurrentJobId,
    saveJobsToStorage,
    ensureQueuePolling,
    submissionDispatching,
    hasActiveSubmittedJob,
    failGeneration,
    resetStaleGeneratingStateWrapper,
    isGenerating,
    resetStaleActiveSubmittedJobsWrapper,
    MAX_PENDING_SUBMISSIONS,
    createLocalQueuedId
  } = ctx

  const refreshPendingQueueStage = () => {
    pendingSubmissionQueue.value.forEach((item, index) => {
      updateJob(item.placeholderId, {
        pendingSubmission: true,
        status: 'queued',
        progress: 0,
        stage: '排队中',
        stageInfo: index === 0 ? '等待前序任务完成' : `前方还有${index}个任务`
      })
    })
  }

  const removePendingSubmissionById = (placeholderId) => {
    const idx = pendingSubmissionQueue.value.findIndex(
      (item) => item.placeholderId === placeholderId
    )
    if (idx >= 0) {
      pendingSubmissionQueue.value.splice(idx, 1)
      refreshPendingQueueStage()
      return true
    }
    return false
  }

  const scheduleRunNextSubmission = () => {
    setTimeout(() => {
      void runNextSubmissionIfIdle()
    }, 0)
  }

  const replacePlaceholderWithSubmittedJob = (placeholderId, jobData) => {
    if (!placeholderId) {
      addJob({
        ...jobData,
        pendingSubmission: false
      })
      return jobData.id
    }

    const existingIndex = jobs.findIndex((item) => item.id === placeholderId)
    if (existingIndex < 0) {
      addJob({
        ...jobData,
        pendingSubmission: false
      })
      return jobData.id
    }

    const prev = jobs[existingIndex]
    const nextId = jobData.id
    jobs[existingIndex] = {
      ...prev,
      ...jobData,
      id: nextId,
      pendingSubmission: false,
      status: jobData.status || 'queued',
      progress: Number.isFinite(Number(jobData.progress))
        ? Number(jobData.progress)
        : 0,
      updatedAt: new Date().toISOString()
    }

    const nextProgressMap = { ...progressMap.value }
    const previousProgress = nextProgressMap[placeholderId]
    delete nextProgressMap[placeholderId]
    nextProgressMap[nextId] = Number.isFinite(Number(jobData.progress))
      ? Math.max(0, Math.min(100, Number(jobData.progress)))
      : Number.isFinite(Number(previousProgress))
        ? Number(previousProgress)
        : 0
    progressMap.value = nextProgressMap

    const nextQueueMap = { ...queuePositionMap.value }
    const previousQueue = nextQueueMap[placeholderId]
    delete nextQueueMap[placeholderId]
    if (Number.isFinite(Number(previousQueue))) {
      nextQueueMap[nextId] = Number(previousQueue)
      scheduleQueuePositionCommit(nextQueueMap)
    }

    setCurrentJobId(nextId)
    saveJobsToStorage()
    ensureQueuePolling()
    return nextId
  }

  const runNextSubmissionIfIdle = async () => {
    if (submissionDispatching.value) return
    if (!pendingSubmissionQueue.value.length) return
    if (hasActiveSubmittedJob()) return

    const next = pendingSubmissionQueue.value.shift()
    refreshPendingQueueStage()
    if (!next) return

    submissionDispatching.value = true
    updateJob(next.placeholderId, {
      pendingSubmission: false,
      stage: '准备中',
      stageInfo: '即将开始',
      progress: 0
    })

    try {
      const result = await next.executor(next.placeholderId)
      if (!result?.success) {
        failGeneration(next.placeholderId, result?.error || '任务提交失败')
      }
    } catch (error) {
      failGeneration(next.placeholderId, error?.message || '任务提交失败')
    } finally {
      submissionDispatching.value = false
      refreshPendingQueueStage()
      if (!hasActiveSubmittedJob()) {
        scheduleRunNextSubmission()
      }
    }
  }

  const enqueueSubmissionIfBusy = (meta) => {
    if (!submissionDispatching.value) {
      resetStaleGeneratingStateWrapper()
    }
    if (
      !submissionDispatching.value &&
      !isGenerating.value &&
      hasActiveSubmittedJob()
    ) {
      resetStaleActiveSubmittedJobsWrapper()
    }
    const hasBusyJob =
      hasActiveSubmittedJob() ||
      submissionDispatching.value ||
      isGenerating.value
    if (!hasBusyJob) return null
    if (pendingSubmissionQueue.value.length >= MAX_PENDING_SUBMISSIONS) {
      return { success: false, error: '以达到排队上限' }
    }

    const placeholderId = createLocalQueuedId()
    addJob({
      id: placeholderId,
      title: meta.title,
      description: meta.description || '',
      workflowId: meta.workflowId || 'archviz-preview',
      status: 'queued',
      progress: 0,
      stage: '排队中',
      stageInfo: '等待前序任务完成',
      isPreview: Boolean(meta.isPreview),
      origin: 'localQueue',
      input: meta.input,
      pendingSubmission: true,
      createdAt: new Date().toISOString()
    })

    pendingSubmissionQueue.value.push({
      placeholderId,
      executor: meta.executor
    })
    refreshPendingQueueStage()
    return { success: true, queued: true, jobId: placeholderId }
  }

  return {
    refreshPendingQueueStage,
    removePendingSubmissionById,
    scheduleRunNextSubmission,
    replacePlaceholderWithSubmittedJob,
    runNextSubmissionIfIdle,
    enqueueSubmissionIfBusy
  }
}
