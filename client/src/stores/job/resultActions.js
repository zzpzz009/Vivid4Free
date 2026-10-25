import { buildOutputFromResultImages } from './urlNormalize.js'
import { api } from '../../api/index.js'

export const createResultActions = (ctx) => {
  const {
    jobs,
    getDisplayProgressById,
    mergeJobInput,
    updateJob,
    addJob,
    progressMap,
    queuePositionMap,
    scheduleQueuePositionCommit,
    currentJobId,
    setStatusMessage,
    setGenerating,
    setCurrentJobId,
    resetStatus,
    scheduleRunNextSubmission,
    sleep
  } = ctx

  const upsertHistoryRecord = (record) => {
    if (!record?.id) return
    const existing = jobs.find((j) => j?.id === record.id)
    const nextProgress =
      record.status === 'completed' ? 100 : getDisplayProgressById(record.id)
    const nextResultImages =
      Array.isArray(record.resultImages) && record.resultImages.length > 0
        ? record.resultImages
        : Array.isArray(record.output?.resultUrls) &&
            record.output.resultUrls.length > 0
          ? record.output.resultUrls
          : existing?.resultImages
    const nextOutput =
      record.output ||
      buildOutputFromResultImages(nextResultImages) ||
      existing?.output
    const nextInput = mergeJobInput(existing?.input || {}, record.input || {})
    if (existing) {
      updateJob(record.id, {
        status: record.status,
        progress: nextProgress,
        input: nextInput,
        output: nextOutput,
        resultImages: nextResultImages,
        completedAt: record.completedAt || existing.completedAt
      })
      return
    }
    addJob({
      id: record.id,
      title: '远端任务',
      description: '历史同步任务',
      workflowId: 'comfy',
      status: record.status,
      progress: nextProgress,
      origin: record.origin || 'jobsAPI',
      createdAt: record.createdAt || new Date().toISOString(),
      completedAt: record.completedAt || null,
      input: nextInput,
      output: nextOutput || null,
      resultImages: nextResultImages || []
    })
  }

  const completeGeneration = (jobData) => {
    // 更新 jobs 列表中的对应任务
    const jobIndex = jobs.findIndex((job) => job.id === jobData.id)
    if (jobIndex >= 0) {
      const resultImages = jobData.resultImages || jobs[jobIndex].resultImages
      const nextOutput =
        jobData.output ||
        buildOutputFromResultImages(resultImages) ||
        jobs[jobIndex].output
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        status: 'completed',
        progress: 100,
        stage: '已完成',
        completedAt: new Date().toISOString(),
        resultImages,
        output: nextOutput,
        allowTempOutput:
          jobData.allowTempOutput ?? jobs[jobIndex].allowTempOutput
      }
      progressMap.value = {
        ...progressMap.value,
        [jobData.id]: 100
      }
      const nextQueue = { ...queuePositionMap.value }
      delete nextQueue[jobData.id]
      scheduleQueuePositionCommit(nextQueue)
    }

    // 如果是当前任务，更新状态消息并延迟重置
    if (jobData.id === currentJobId.value) {
      setStatusMessage('生成完成！', 'success')
      setGenerating(false)
      setCurrentJobId(null)

      // 延迟重置文字状态
      setTimeout(() => {
        resetStatus()
      }, 5000) // 延长显示时间到5秒
    }
    scheduleRunNextSubmission()
  }

  const failGeneration = (jobId, error) => {
    // 更新 jobs 列表中的对应任务
    const jobIndex = jobs.findIndex((job) => job.id === jobId)
    if (jobIndex >= 0) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        status: 'failed',
        progress: 0,
        errorMessage: error,
        completedAt: new Date().toISOString()
      }
      const nextQueue = { ...queuePositionMap.value }
      delete nextQueue[jobId]
      scheduleQueuePositionCommit(nextQueue)
    }

    // 如果是当前任务，更新状态消息并延迟重置
    if (jobId === currentJobId.value) {
      setStatusMessage('生成失败：' + error, 'error')
      setCurrentJobId(null)
      setGenerating(false)

      // 延迟重置文字状态
      setTimeout(() => {
        resetStatus()
      }, 5000)
    }
    scheduleRunNextSubmission()
  }

  const getLegacyComfyResult = async (promptId, options = {}) => {
    const maxAttempts = Number.isFinite(Number(options?.maxAttempts))
      ? Math.max(1, Number(options.maxAttempts))
      : 1
    const retryDelayMs = Number.isFinite(Number(options?.retryDelayMs))
      ? Math.max(0, Number(options.retryDelayMs))
      : 0
    let lastError = null

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const result = await api.jobs.getJobResults(promptId)
        const normalized = result?.data ? result : { data: result }
        if (
          normalized?.data &&
          typeof normalized.data === 'object' &&
          Object.keys(normalized.data).length > 0
        ) {
          return normalized
        }
      } catch (error) {
        lastError = error
      }

      if (attempt < maxAttempts - 1 && retryDelayMs > 0) {
        await sleep(retryDelayMs)
      }
    }

    if (lastError) {
      throw lastError
    }
    return { data: {} }
  }

  return {
    upsertHistoryRecord,
    completeGeneration,
    failGeneration,
    getLegacyComfyResult
  }
}
