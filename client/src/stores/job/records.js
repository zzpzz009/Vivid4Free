import { buildInputPathFromInputImage } from './inputPayload.js'
import { normalizeJobStatus } from './statusNormalize.js'
import { buildOutputFromResultImages } from './urlNormalize.js'
import { normalizeProgressValue } from './statusNormalize.js'

export const createRecords = (ctx) => {
  const {
    getActiveApiOrigin,
    jobs,
    progressMap,
    isActiveStatus,
    queuePositionMap,
    scheduleQueuePositionCommit,
    saveJobsToStorage,
    ensureQueuePolling,
    isTerminalStatus,
    scheduleRunNextSubmission
  } = ctx

  const addJob = (jobData) => {
    const normalizedStatus = normalizeJobStatus(jobData.status || 'queued')
    const job = {
      id: jobData.id,
      title: jobData.title,
      description: jobData.description,
      workflowId: jobData.workflowId,
      status: normalizedStatus,
      progress: jobData.progress || 0,
      stage: jobData.stage,
      stageInfo: jobData.stageInfo,
      errorMessage: jobData.errorMessage,
      createdAt: jobData.createdAt || new Date().toISOString(),
      updatedAt: jobData.updatedAt,
      completedAt: jobData.completedAt,
      pendingSubmission: Boolean(jobData.pendingSubmission),
      origin: jobData.origin || getActiveApiOrigin(),
      isPreview: Boolean(jobData.isPreview),
      allowTempOutput: Boolean(jobData.allowTempOutput),

      // Input data structure
      input: {
        ...(jobData.input || {}),
        prompt: jobData.parameters?.prompt || '',
        floorplanPath:
          jobData.input?.floorplanPath ||
          buildInputPathFromInputImage(jobData.inputImages?.[0], 'input'),
        stylePath:
          jobData.input?.stylePath ||
          buildInputPathFromInputImage(jobData.inputImages?.[1], 'input'),
        floorplanFile: jobData.inputImages?.[0] || null,
        styleFile: jobData.inputImages?.[1] || null
      },

      // Output data structure
      output:
        jobData.output ||
        (normalizedStatus === 'completed'
          ? buildOutputFromResultImages(jobData.resultImages)
          : null),

      // Original data
      parameters: jobData.parameters,
      inputImages: jobData.inputImages,
      resultImages: jobData.resultImages
    }

    // Check if job already exists
    const existingIndex = jobs.findIndex((item) => item.id === jobData.id)

    if (existingIndex >= 0) {
      // Update existing job
      jobs[existingIndex] = job
    } else {
      // Add new job to the beginning
      jobs.unshift(job)
    }

    if (Number.isFinite(Number(job.progress))) {
      progressMap.value = {
        ...progressMap.value,
        [job.id]: normalizeProgressValue(job.progress, 0)
      }
    }
    if (!isActiveStatus(job.status)) {
      const nextQueue = { ...queuePositionMap.value }
      delete nextQueue[job.id]
      scheduleQueuePositionCommit(nextQueue)
    }

    saveJobsToStorage()
    ensureQueuePolling()
  }

  const updateJob = (jobId, updates) => {
    const existingIndex = jobs.findIndex((item) => item.id === jobId)

    if (existingIndex >= 0) {
      const prev = jobs[existingIndex]
      const nextStatus = normalizeJobStatus(updates?.status ?? prev.status)
      let nextProgress = updates?.progress
      if (Number.isFinite(Number(nextProgress))) {
        nextProgress = Math.min(100, Math.max(0, Number(nextProgress)))
      } else {
        nextProgress = undefined
      }

      if (
        normalizeJobStatus(prev.status) === 'running' &&
        nextStatus === normalizeJobStatus(prev.status) &&
        typeof nextProgress === 'number'
      ) {
        const prevProgress = Number.isFinite(Number(prev.progress))
          ? Number(prev.progress)
          : 0
        nextProgress = Math.max(prevProgress, nextProgress)
      }

      jobs[existingIndex] = {
        ...prev,
        ...updates,
        status: nextStatus,
        ...(typeof nextProgress === 'number' ? { progress: nextProgress } : {}),
        updatedAt: new Date().toISOString()
      }
      if (typeof nextProgress === 'number') {
        progressMap.value = {
          ...progressMap.value,
          [jobId]: normalizeProgressValue(nextProgress, 0)
        }
      }
      const finalStatus = nextStatus
      const prevWasActive =
        isActiveStatus(prev.status) && !prev.pendingSubmission
      const nowPendingSubmission =
        updates?.pendingSubmission ?? prev.pendingSubmission
      const nextIsActive = isActiveStatus(finalStatus) && !nowPendingSubmission
      if (!isActiveStatus(finalStatus)) {
        const nextQueue = { ...queuePositionMap.value }
        delete nextQueue[jobId]
        scheduleQueuePositionCommit(nextQueue)
      }
      saveJobsToStorage()
      ensureQueuePolling()
      if (prevWasActive && !nextIsActive && isTerminalStatus(finalStatus)) {
        scheduleRunNextSubmission()
      }
    }
  }

  return { addJob, updateJob }
}
