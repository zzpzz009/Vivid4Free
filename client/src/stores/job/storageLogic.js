export const createStorageLogic = (ctx) => {
  const {
    jobs,
    JOB_STORAGE_KEY,
    parseJobsFromStorage,
    normalizeJobStatus,
    progressMap,
    queuePositionMap,
    ensureQueuePolling,
    stopQueuePolling,
    saveJobsToStorageImpl,
    useComfyBridgeMode,
    isActiveStatus,
    toTimestampMs,
    setCurrentJobId
  } = ctx

  const saveJobsToStorage = () => {
    saveJobsToStorageImpl(jobs)
  }

  const loadJobsFromStorage = () => {
    try {
      const stored = localStorage.getItem(JOB_STORAGE_KEY)
      if (stored) {
        const { jobs: normalizedJobs, progressMap: nextProgress } = parseJobsFromStorage(stored)
        if (normalizedJobs.length > 0) {
          jobs.splice(0, jobs.length, ...normalizedJobs)
          saveJobsToStorage()
          progressMap.value = nextProgress
        }
      }
    } catch (error) {
      console.error('Failed to load jobs from localStorage:', error)
    }
    ensureQueuePolling()
  }

  const mapApiJobToStoreJob = (apiJob) => ({
    id: apiJob.id,
    title: apiJob.title,
    description: apiJob.description,
    workflowId: apiJob.workflowId,
    status: normalizeJobStatus(apiJob.status),
    progress: apiJob.progress || 0,
    stage: apiJob.stage,
    errorMessage: apiJob.errorMessage,
    createdAt: apiJob.createdAt,
    updatedAt: apiJob.updatedAt,
    completedAt: apiJob.completedAt,
    origin: apiJob.origin || 'jobsAPI',
    input: {
      prompt: apiJob.parameters?.prompt || '',
      floorplanPath: apiJob.inputImages?.[0] ? `/api/files/${apiJob.inputImages[0]}` : null,
      stylePath: apiJob.inputImages?.[1] ? `/api/files/${apiJob.inputImages[1]}` : null,
      floorplanFile: apiJob.inputImages?.[0] || null,
      styleFile: apiJob.inputImages?.[1] || null
    },
    output: normalizeJobStatus(apiJob.status) === 'completed' && apiJob.resultImages?.length > 0 ? {
      imageUrl: `/api/jobs/${apiJob.id}/results/${apiJob.resultImages[0].split('/').pop()}`,
      apiImageUrl: `/api/jobs/${apiJob.id}/results/${apiJob.resultImages[0].split('/').pop()}`,
      resultUrls: apiJob.resultImages.map((filePath) =>
        `/api/jobs/${apiJob.id}/results/${filePath.split('/').pop()}`
      )
    } : null,
    parameters: apiJob.parameters,
    inputImages: apiJob.inputImages,
    resultImages: apiJob.resultImages
  })

  const mergeBridgeJobs = (incomingJobs) => {
    const merged = new Map(
      jobs
        .filter((job) => !isActiveStatus(job?.status))
        .map((job) => [job.id, job])
    )
    incomingJobs.forEach((job) => {
      const previous = merged.get(job.id) || {}
      merged.set(job.id, {
        ...previous,
        ...job
      })
    })
    return Array.from(merged.values()).sort((a, b) =>
      toTimestampMs(b.completedAt || b.updatedAt || b.createdAt) - toTimestampMs(a.completedAt || a.updatedAt || a.createdAt)
    )
  }

  const loadJobsFromServer = async (api) => {
    try {
      const data = await api.jobs.getJobs()

      if (!data?.success || !data.data?.jobs) {
        console.warn('No jobs data found in API response')
        loadJobsFromStorage()
        return
      }

      const convertedJobs = data.data.jobs.map((apiJob) => mapApiJobToStoreJob(apiJob))
      const sortedJobs = convertedJobs.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      const nextJobs = (useComfyBridgeMode || data?.bridge === true)
        ? mergeBridgeJobs(sortedJobs)
        : sortedJobs

      jobs.splice(0, jobs.length, ...nextJobs)
      saveJobsToStorage()
      console.log('Jobs loaded from server:', jobs.length)
    } catch (error) {
      console.error('Failed to load jobs from server:', error)
      loadJobsFromStorage()
    }
  }

  const clearJobs = () => {
    jobs.splice(0, jobs.length)
    setCurrentJobId(null)
    progressMap.value = {}
    queuePositionMap.value = {}
    localStorage.removeItem(JOB_STORAGE_KEY)
    stopQueuePolling()
  }

  return {
    saveJobsToStorage,
    loadJobsFromStorage,
    loadJobsFromServer,
    clearJobs
  }
}
