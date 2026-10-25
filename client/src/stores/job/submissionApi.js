import { api } from '../../api/index.js'
import { normalizeJobStatus } from './statusNormalize.js'

export const createSubmissionApi = (ctx) => {
  const {
    addJob,
    getActiveApiOrigin,
    replacePlaceholderWithSubmittedJob,
    setCurrentJobId,
    setGenerating,
    resetStaleGeneratingStateWrapper,
    resetStaleActiveSubmittedJobsWrapper,
    ensureComfyReadyForNewRunWrapper,
    hasActiveSubmittedJob,
    submissionDispatching,
    isGenerating,
    enqueueSubmissionIfBusy,
    pendingSubmissionQueue
  } = ctx

  const generateAPI = async (
    floorplanFile,
    styleFile,
    prompt = '',
    workflowId = 'archviz-preview',
    advancedParameters = {},
    advancedParameterFiles = {}
  ) => {
    throw new Error('该旧版任务入口未在桌面客户端开放，请使用工作台预览或放大')
  }

  const generateWithMaskAPI = async (
    floorplanFile,
    styleFile,
    maskFile,
    prompt = '',
    workflowId = 'local-repaint',
    advancedParameters = {},
    advancedParameterFiles = {}
  ) => {
    throw new Error('该旧版任务入口未在桌面客户端开放，请使用工作台预览或放大')
  }

  const batchGenerateAPI = async (
    images,
    references,
    prompt = '',
    workflowId = 'archviz-preview'
  ) => {
    throw new Error('该旧版任务入口未在桌面客户端开放，请使用工作台预览或放大')
  }

  const createJobViaAPI = async (options) => {
    try {
      const response = await api.jobs.createGenerationJob(options)
      const job = response.data

      // 添加到本地存储
      addJob({
        id: job.jobId,
        status: normalizeJobStatus(job.status) || 'queued',
        origin: job.origin || getActiveApiOrigin(),
        ...options
      })

      return job
    } catch (error) {
      console.error('Failed to create job via API:', error)
      throw error
    }
  }

  const submitLegacyComfyJob = async ({
    payload,
    title,
    description,
    workflowId,
    input = {},
    isPreview = false,
    placeholderId = null
  }) => {
    const response = await api.jobs.createGenerationJob({
      payload,
      title,
      description,
      workflowId,
      input,
      isPreview
    })
    const promptId = response?.data?.jobId || response?.data?.id
    if (!promptId) {
      throw new Error('未获取到任务ID')
    }
    const adoptedJobId = replacePlaceholderWithSubmittedJob(placeholderId, {
      id: promptId,
      title: title || `任务 ${promptId}`,
      description: description || '',
      workflowId: workflowId || 'jobsAPI',
      status: 'queued',
      progress: 0,
      isPreview,
      origin: 'jobsAPI',
      input,
      createdAt: new Date().toISOString(),
      pendingSubmission: false
    })
    setCurrentJobId(adoptedJobId)
    setGenerating(true)
    return { success: true, promptId: adoptedJobId }
  }

  const createLegacyComfyJob = async ({
    payload,
    title,
    description,
    workflowId,
    input = {},
    isPreview = false,
    rejectIfBusy = false
  }) => {
    if (rejectIfBusy) {
      resetStaleGeneratingStateWrapper()
      resetStaleActiveSubmittedJobsWrapper()
      await ensureComfyReadyForNewRunWrapper()
    }
    if (
      rejectIfBusy &&
      (hasActiveSubmittedJob() ||
        submissionDispatching.value ||
        isGenerating.value)
    ) {
      throw new Error('当前已有任务运行中')
    }
    const queuedResult = enqueueSubmissionIfBusy({
      title: title || '排队任务',
      description: description || '',
      workflowId: workflowId || 'legacy',
      isPreview,
      input,
      executor: async (placeholderId) =>
        submitLegacyComfyJob({
          payload,
          title,
          description,
          workflowId,
          input,
          isPreview,
          placeholderId
        })
    })

    if (queuedResult?.success === false) {
      throw new Error(queuedResult.error || '提交失败')
    }
    if (queuedResult?.queued) {
      return new Promise((resolve, reject) => {
        const queueItem = pendingSubmissionQueue.value.find(
          (item) => item.placeholderId === queuedResult.jobId
        )
        if (!queueItem) {
          reject(new Error('排队任务不存在'))
          return
        }
        queueItem.executor = async (placeholderId) => {
          try {
            const result = await submitLegacyComfyJob({
              payload,
              title,
              description,
              workflowId,
              input,
              isPreview,
              placeholderId
            })
            resolve(result)
            return { success: true, ...result }
          } catch (error) {
            reject(error)
            throw error
          }
        }
      })
    }

    submissionDispatching.value = true
    try {
      return await submitLegacyComfyJob({
        payload,
        title,
        description,
        workflowId,
        input,
        isPreview
      })
    } finally {
      submissionDispatching.value = false
    }
  }

  return {
    generateAPI,
    generateWithMaskAPI,
    batchGenerateAPI,
    createJobViaAPI,
    submitLegacyComfyJob,
    createLegacyComfyJob
  }
}
