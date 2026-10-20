import { BASE_URL } from '@/api/apiUtils.js'

export const createApiWrappers = (ctx) => {
  const { api, addJob, normalizeJobStatus, getActiveApiOrigin, replacePlaceholderWithSubmittedJob, setCurrentJobId, setGenerating, resetStaleGeneratingState, resetStaleActiveSubmittedJobs, ensureComfyReadyForNewRun, hasActiveSubmittedJob, submissionDispatching, isGenerating, enqueueSubmissionIfBusy, pendingSubmissionQueue, getOutputUrl, getOutputUrls } = ctx

const generateAPI = async (floorplanFile, styleFile, prompt = '', workflowId = 'archviz-preview', advancedParameters = {}, advancedParameterFiles = {}) => {
    // 准备上传的文件列表
    const filesToUpload = []

    if (floorplanFile) {
      filesToUpload.push(floorplanFile)
    }
    if (styleFile) {
      filesToUpload.push(styleFile)
    }
    if (advancedParameterFiles.wireframeImage) {
      filesToUpload.push(advancedParameterFiles.wireframeImage)
    }
    if (advancedParameterFiles.materialImage) {
      filesToUpload.push(advancedParameterFiles.materialImage)
    }

    if (filesToUpload.length === 0) {
      throw new Error('No files to upload')
    }

    // 上传文件到后端
    const uploadFormData = new FormData()
    filesToUpload.forEach(file => {
      uploadFormData.append('files', file)
    })

    const uploadResponse = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      body: uploadFormData
    })

    if (!uploadResponse.ok) {
      throw new Error(`File upload failed: ${uploadResponse.status}: ${uploadResponse.statusText}`)
    }

    const uploadResult = await uploadResponse.json()
    const uploadedFiles = uploadResult.data?.files || uploadResult.files || []

    // 文件参数映射
    // floorplanFile = 主图/待处理图片（界面上的"待处理图片"）
    // styleFile = 参考图片（界面上的"参考图片"）
    const fileParameters = {}
    if (uploadedFiles.length > 0) {
      // 主图（floorplanFile）→ input_image（第一个上传的文件）
      if (floorplanFile && uploadedFiles.length >= 1) {
        fileParameters.input_image = uploadedFiles[0].fileId
      }

      // 参考图（styleFile）→ reference_image（第二个上传的文件）
      if (styleFile && uploadedFiles.length >= 2) {
        fileParameters.reference_image = uploadedFiles[1].fileId
      }
    }

    // 创建作业
    const jobData = {
      title: `${workflowId} - ${prompt.substring(0, 50)}`,
      description: prompt,
      workflowId: workflowId,
      parameters: {
        prompt: prompt,
        ...advancedParameters,  // 直接使用高级参数，不做映射
        ...fileParameters       // 添加文件参数映射
      },
      inputImages: uploadedFiles.map(file => file.fileId)
    }

    const response = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jobData)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      jobId: result.data?.id || result.id,
      promptId: result.data?.id || result.id, // 兼容性
      message: result.message || 'Job created successfully'
    }
  }

const generateWithMaskAPI = async (floorplanFile, styleFile, maskFile, prompt = '', workflowId = 'local-repaint', advancedParameters = {}, advancedParameterFiles = {}) => {
    const formData = new FormData()

    if (floorplanFile) formData.append('floorplan', floorplanFile)
    if (styleFile) formData.append('style', styleFile)
    if (maskFile) formData.append('mask', maskFile)

    if (advancedParameterFiles.wireframeImage) {
      formData.append('wireframe', advancedParameterFiles.wireframeImage)
    }
    if (advancedParameterFiles.materialImage) {
      formData.append('material', advancedParameterFiles.materialImage)
    }

    formData.append('prompt', prompt)
    formData.append('workflowId', workflowId)
    formData.append('parameters', JSON.stringify({ maskMode: true, ...advancedParameters }))

    // 首先上传文件
    const uploadFormData = new FormData()
    uploadFormData.append('files', floorplanFile)
    uploadFormData.append('files', styleFile)
    uploadFormData.append('files', maskFile)

    // 添加高级参数文件
    if (advancedParameterFiles.wireframeImage) {
      uploadFormData.append('files', advancedParameterFiles.wireframeImage)
    }
    if (advancedParameterFiles.materialImage) {
      uploadFormData.append('files', advancedParameterFiles.materialImage)
    }

    // 上传文件到后端
    const uploadResponse = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      body: uploadFormData
    })

    if (!uploadResponse.ok) {
      throw new Error(`File upload failed: ${uploadResponse.status}: ${uploadResponse.statusText}`)
    }

    const uploadResult = await uploadResponse.json()
    const uploadedFiles = uploadResult.data || uploadResult.files || []

    // 创建作业（带蒙版）
    const jobData = {
      title: `${workflowId} - ${prompt.substring(0, 50)}`,
      description: prompt,
      workflowId: workflowId,
      parameters: {
        prompt: prompt,
        maskMode: true,
        ...advancedParameters
      },
      inputImages: uploadedFiles.map(file => file.fileId)
    }

    const response = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jobData)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      jobId: result.data?.id || result.id,
      promptId: result.data?.id || result.id, // 兼容性
      message: result.message || 'Job created successfully'
    }
  }

const batchGenerateAPI = async (images, references, prompt = '', workflowId = 'archviz-preview') => {
    // 首先上传所有文件
    const uploadFormData = new FormData()

    images.forEach((image) => {
      const file = image.file || image
      uploadFormData.append('files', file)
    })

    references.forEach((ref) => {
      const file = ref.file || ref
      uploadFormData.append('files', ref)
    })

    // 上传文件到后端
    const uploadResponse = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      body: uploadFormData
    })

    if (!uploadResponse.ok) {
      throw new Error(`File upload failed: ${uploadResponse.status}: ${uploadResponse.statusText}`)
    }

    const uploadResult = await uploadResponse.json()
    const uploadedFiles = uploadResult.data || uploadResult.files || []

    // 计算组合数量：m 张图片 × n 张参考图 = m×n 个任务
    const totalCombinations = images.length * references.length

    // 创建批量作业 - 支持 m×n 组合
    const jobData = {
      title: `Batch ${workflowId} - ${images.length}×${references.length} combinations`,
      description: `Batch generation: ${totalCombinations} combinations (${images.length} images × ${references.length} references)`,
      workflowId: workflowId,
      parameters: {
        prompt: prompt,
        batchMode: true,
        imageCount: images.length,
        referenceCount: references.length,
        totalCombinations: totalCombinations
      },
      inputImages: uploadedFiles.map(file => file.fileId)
    }

    const response = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jobData)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      jobId: result.data?.id || result.id,
      promptId: result.data?.id || result.id, // 兼容性
      message: `Batch job created successfully - ${totalCombinations} combinations`
    }
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

const submitLegacyComfyJob = async ({ payload, title, description, workflowId, input = {}, isPreview = false, placeholderId = null }) => {
    const response = await api.jobs.createGenerationJob({ payload, title, description, workflowId, input, isPreview })
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

const createLegacyComfyJob = async ({ payload, title, description, workflowId, input = {}, isPreview = false, rejectIfBusy = false }) => {
    if (rejectIfBusy) {
      resetStaleGeneratingState()
      resetStaleActiveSubmittedJobs()
      await ensureComfyReadyForNewRun()
    }
    if (rejectIfBusy && (hasActiveSubmittedJob() || submissionDispatching.value || isGenerating.value)) {
      throw new Error('当前已有任务运行中')
    }
    const queuedResult = enqueueSubmissionIfBusy({
      title: title || '排队任务',
      description: description || '',
      workflowId: workflowId || 'legacy',
      isPreview,
      input,
      executor: async (placeholderId) => submitLegacyComfyJob({ payload, title, description, workflowId, input, isPreview, placeholderId })
    })

    if (queuedResult?.success === false) {
      throw new Error(queuedResult.error || '提交失败')
    }
    if (queuedResult?.queued) {
      return new Promise((resolve, reject) => {
        const queueItem = pendingSubmissionQueue.value.find((item) => item.placeholderId === queuedResult.jobId)
        if (!queueItem) {
          reject(new Error('排队任务不存在'))
          return
        }
        queueItem.executor = async (placeholderId) => {
          try {
            const result = await submitLegacyComfyJob({ payload, title, description, workflowId, input, isPreview, placeholderId })
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
      return await submitLegacyComfyJob({ payload, title, description, workflowId, input, isPreview })
    } finally {
      submissionDispatching.value = false
    }
  }

const getLegacyComfyResult = async (promptId) => {
    const result = await api.jobs.getJobResults(promptId)
    return result?.data ? result : { data: result }
  }

  return {
    generateAPI,
    generateWithMaskAPI,
    batchGenerateAPI,
    createJobViaAPI,
    submitLegacyComfyJob,
    createLegacyComfyJob,
    getLegacyComfyResult
  }
}
