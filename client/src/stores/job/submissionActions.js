import { useUIStore } from '../useUIStore.js'
import { images } from '@/utils/assets.js'

export const createSubmissionActions = (ctx) => {
  const {
    ensureMockEngineSubscribed,
    mockEngine,
    replacePlaceholderWithSubmittedJob,
    startGeneration,
    updateJob,
    jobs,
    buildMockGenerationStagePlan,
    scheduleMockCancel,
    prompt,
    setStatusMessage,
    advancedParameters,
    generateWithMaskAPI,
    generateAPI,
    getActiveApiOrigin,
    addJob,
    enqueueSubmissionIfBusy,
    buildQueuedInputSnapshot,
    submissionDispatching,
    hasActiveSubmittedJob,
    scheduleRunNextSubmission,
    batchGenerateAPI
  } = ctx

  const validateGenerationParams = (params) => {
    const { floorplanFile, styleFile, prompt } = params
    const errors = []

    if (!floorplanFile) {
      errors.push('请上传平面图')
    }

    if (!styleFile) {
      errors.push('请上传风格参考图')
    }

    if (!prompt || prompt.trim().length === 0) {
      errors.push('请输入提示词')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  const validateBatchGenerationParams = (params) => {
    const { images, references, prompt } = params
    const errors = []

    if (!images || images.length === 0) {
      errors.push('请上传至少一张图片')
    }

    if (!references || references.length === 0) {
      errors.push('请上传至少一张参考图')
    }

    // 移除数量相同的限制 - 批量预览是 m×n 的组合
    // 每张图片会与每张参考图进行组合生成

    if (!prompt || prompt.trim().length === 0) {
      errors.push('请输入提示词')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  const handleMockGenerationStart = (
    assetStore,
    placeholderId,
    uiStore,
    currentPrompt,
    currentAdvancedParams
  ) => {
    if (!import.meta.env.DEV) throw new Error('模拟任务仅用于开发环境')
    ensureMockEngineSubscribed()
    const job = mockEngine.createJob({
      title: `模拟生成 ${currentPrompt.substring(0, 20)}`,
      description: currentPrompt,
      workflowId: assetStore.maskFile ? 'local-repaint' : 'archviz-preview',
      status: 'queued',
      parameters: { prompt: currentPrompt, ...currentAdvancedParams }
    })

    const adoptedJobId = replacePlaceholderWithSubmittedJob(placeholderId, {
      id: job.id,
      title: job.title,
      description: job.description,
      workflowId: job.workflowId,
      status: 'queued',
      createdAt: job.createdAt,
      parameters: job.parameters,
      inputImages: [],
      resultImages: [],
      pendingSubmission: false
    })
    startGeneration(adoptedJobId)

    const inputFloorplanPath =
      assetStore.floorplanFile?.preview || assetStore.floorplanFile?.url || null
    const inputStylePath =
      assetStore.styleFile?.preview || assetStore.styleFile?.url || null
    updateJob(adoptedJobId, {
      origin: 'mock',
      input: {
        ...(jobs.find((j) => j.id === adoptedJobId)?.input || {}),
        prompt: currentPrompt,
        floorplanPath: inputFloorplanPath,
        stylePath: inputStylePath
      }
    })

    const scenario = uiStore.mockScenario
    const totalMs = 60000 + Math.floor(Math.random() * 60001)
    const startOptions = {
      resultImages: [],
      stagePlan: buildMockGenerationStagePlan(totalMs),
      tickMs: 500
    }
    if (scenario === 'fail') {
      startOptions.failAtPercent = uiStore.mockFailAtPercent
      startOptions.failMessage = '模拟失败'
    }
    if (scenario === 'randomFail') {
      const rate = Number.isFinite(Number(uiStore.mockFailRate))
        ? Number(uiStore.mockFailRate)
        : 0
      if (Math.random() < Math.min(1, Math.max(0, rate))) {
        startOptions.failAtPercent = Math.floor(10 + Math.random() * 75)
        startOptions.failMessage = '模拟失败（随机）'
      }
    }
    if (scenario === 'cancel') {
      scheduleMockCancel(adoptedJobId, uiStore.mockCancelAfterMs, '模拟取消')
    }
    mockEngine.startJob(adoptedJobId, startOptions)
    return { success: true, jobId: adoptedJobId, mock: true }
  }

  const executeGenerationNow = async (assetStore, options = {}) => {
    try {
      const uiStore = useUIStore()
      // 参数验证
      const validation = validateGenerationParams({
        floorplanFile: assetStore.floorplanFile?.file,
        styleFile: assetStore.styleFile?.file,
        prompt: prompt.value
      })

      if (!validation.valid) {
        setStatusMessage(validation.errors.join(', '), 'error')
        return { success: false, errors: validation.errors }
      }

      const placeholderId = options?.placeholderId || null

      if (import.meta.env.DEV && uiStore.useGenerationMock) {
        return handleMockGenerationStart(
          assetStore,
          placeholderId,
          uiStore,
          prompt.value,
          advancedParameters.value
        )
      }

      let result
      if (assetStore.maskFile) {
        // 蒙版生成
        result = await generateWithMaskAPI(
          assetStore.floorplanFile.file,
          assetStore.styleFile.file,
          assetStore.maskFile.file,
          prompt.value,
          'local-repaint',
          advancedParameters.value,
          {
            wireframeImage: assetStore.wireframeFile?.file,
            materialImage: assetStore.materialFile?.file
          }
        )
      } else {
        // 普通生成
        result = await generateAPI(
          assetStore.floorplanFile.file,
          assetStore.styleFile.file,
          prompt.value,
          'archviz-preview',
          advancedParameters.value,
          {
            wireframeImage: assetStore.wireframeFile?.file,
            materialImage: assetStore.materialFile?.file
          }
        )
      }

      if (result.success) {
        // 开始生成流程
        const adoptedJobId = replacePlaceholderWithSubmittedJob(placeholderId, {
          id: result.jobId,
          title: `生成任务 ${result.jobId}`,
          description: prompt.value,
          workflowId: assetStore.maskFile ? 'local-repaint' : 'archviz-preview',
          status: 'queued',
          origin: getActiveApiOrigin(),
          createdAt: new Date().toISOString(),
          floorplanFile: assetStore.floorplanFile,
          styleFile: assetStore.styleFile,
          maskFile: assetStore.maskFile,
          wireframeFile: assetStore.wireframeFile,
          materialFile: assetStore.materialFile,
          prompt: prompt.value,
          parameters: advancedParameters.value,
          pendingSubmission: false
        })
        startGeneration(adoptedJobId)

        return { success: true, jobId: adoptedJobId }
      } else {
        setStatusMessage('生成失败：' + (result.error || '未知错误'), 'error')
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Generation failed:', error)
      setStatusMessage('生成失败：' + error.message, 'error')
      return { success: false, error: error.message }
    }
  }

  const executeGeneration = async (assetStore, options = {}) => {
    if (options?.mode === 'workspace-upscale') {
      const uiStore = useUIStore()
      if (!assetStore?.floorplanFile?.file) {
        setStatusMessage('请上传待处理图片', 'error')
        return { success: false, error: '缺少必要文件' }
      }

      const workflowId = options?.workflowId || 'sc'
      const title =
        options?.title || `生成任务 ${new Date().toLocaleTimeString()}`
      const description = options?.description || '洗图放大'
      const promptText = options?.promptFallback || prompt.value || '洗图放大'

      if (import.meta.env.DEV && uiStore.useGenerationMock) {
        ensureMockEngineSubscribed()
        const job = mockEngine.createJob({
          title,
          description,
          workflowId,
          status: 'queued',
          parameters: { prompt: promptText }
        })

        startGeneration(job.id)
        addJob({
          id: job.id,
          title: job.title,
          description: job.description,
          workflowId: job.workflowId,
          status: 'queued',
          createdAt: job.createdAt,
          parameters: job.parameters,
          inputImages: [],
          resultImages: []
        })

        const inputFloorplanPath =
          assetStore.floorplanFile?.preview ||
          assetStore.floorplanFile?.url ||
          null
        updateJob(job.id, {
          origin: 'mock',
          input: {
            ...(jobs.find((j) => j.id === job.id)?.input || {}),
            prompt: promptText,
            floorplanPath: inputFloorplanPath
          }
        })

        const pool = Object.values(images)
        const picked =
          pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
        const resultUrls = picked ? [picked] : []
        const totalMs = 30000 + Math.floor(Math.random() * 30001)
        const stagePlan = buildMockGenerationStagePlan(totalMs)
        const scenario = uiStore.mockScenario
        const startOptions = {
          resultImages: resultUrls,
          stagePlan,
          tickMs: 500
        }
        if (scenario === 'fail') {
          startOptions.failAtPercent = uiStore.mockFailAtPercent
          startOptions.failMessage = '模拟失败'
        }
        if (scenario === 'randomFail') {
          const rate = Number.isFinite(Number(uiStore.mockFailRate))
            ? Number(uiStore.mockFailRate)
            : 0
          if (Math.random() < Math.min(1, Math.max(0, rate))) {
            startOptions.failAtPercent = Math.floor(10 + Math.random() * 75)
            startOptions.failMessage = '模拟失败（随机）'
          }
        }
        if (scenario === 'cancel') {
          scheduleMockCancel(job.id, uiStore.mockCancelAfterMs, '模拟取消')
        }
        mockEngine.startJob(job.id, startOptions)
        return { success: true, jobId: job.id, mock: true }
      }
    }

    const queuedResult = enqueueSubmissionIfBusy({
      title: `生成任务 ${new Date().toLocaleTimeString()}`,
      description: prompt.value,
      workflowId: assetStore?.maskFile ? 'local-repaint' : 'archviz-preview',
      input: buildQueuedInputSnapshot(assetStore),
      executor: async (placeholderId) =>
        executeGenerationNow(assetStore, { placeholderId })
    })
    if (queuedResult) return queuedResult

    submissionDispatching.value = true
    try {
      return await executeGenerationNow(assetStore)
    } finally {
      submissionDispatching.value = false
      if (!hasActiveSubmittedJob()) scheduleRunNextSubmission()
    }
  }

  const executeBatchGeneration = async (assetStore) => {
    try {
      const uiStore = useUIStore()
      // 参数验证
      const validation = validateBatchGenerationParams({
        images: assetStore.floorplanFiles,
        references: assetStore.styleFiles,
        prompt: prompt.value
      })

      if (!validation.valid) {
        setStatusMessage(validation.errors.join(', '), 'error')
        return { success: false, errors: validation.errors }
      }

      if (import.meta.env.DEV && uiStore.useGenerationMock) {
        ensureMockEngineSubscribed()
        const totalCombinations =
          assetStore.floorplanFiles.length * assetStore.styleFiles.length
        const job = mockEngine.createJob({
          title: `模拟批量生成 ${prompt.value.substring(0, 20)}`,
          description: `批量生成 ${totalCombinations} 个组合 (${assetStore.floorplanFiles.length} 张图片 × ${assetStore.styleFiles.length} 张参考图)`,
          workflowId: 'archviz-preview',
          status: 'queued',
          parameters: { prompt: prompt.value }
        })

        startGeneration(job.id)
        addJob({
          id: job.id,
          title: job.title,
          description: job.description,
          workflowId: job.workflowId,
          status: 'queued',
          createdAt: job.createdAt,
          parameters: job.parameters,
          inputImages: [],
          resultImages: []
        })

        updateJob(job.id, {
          origin: 'mock',
          isBatch: true,
          totalCombinations
        })

        const scenario = uiStore.mockScenario
        const totalMs = 60000 + Math.floor(Math.random() * 60001)
        const startOptions = {
          resultImages: [],
          stagePlan: buildMockGenerationStagePlan(totalMs),
          tickMs: 500
        }
        if (scenario === 'fail') {
          startOptions.failAtPercent = uiStore.mockFailAtPercent
          startOptions.failMessage = '模拟失败'
        }
        if (scenario === 'randomFail') {
          const rate = Number.isFinite(Number(uiStore.mockFailRate))
            ? Number(uiStore.mockFailRate)
            : 0
          if (Math.random() < Math.min(1, Math.max(0, rate))) {
            startOptions.failAtPercent = Math.floor(10 + Math.random() * 75)
            startOptions.failMessage = '模拟失败（随机）'
          }
        }
        if (scenario === 'cancel') {
          scheduleMockCancel(job.id, uiStore.mockCancelAfterMs, '模拟取消')
        }
        mockEngine.startJob(job.id, startOptions)
        return { success: true, jobId: job.id, mock: true }
      }

      const result = await batchGenerateAPI(
        assetStore.floorplanFiles,
        assetStore.styleFiles,
        prompt.value,
        'archviz-preview'
      )

      if (result.success) {
        // 开始生成流程
        startGeneration(result.jobId)

        // 计算组合数量
        const totalCombinations =
          assetStore.floorplanFiles.length * assetStore.styleFiles.length

        // 添加任务到列表
        addJob({
          id: result.jobId,
          title: `批量生成任务 ${result.jobId}`,
          description: `批量生成 ${totalCombinations} 个组合 (${assetStore.floorplanFiles.length} 张图片 × ${assetStore.styleFiles.length} 张参考图)`,
          workflowId: 'archviz-preview',
          status: 'queued',
          origin: getActiveApiOrigin(),
          createdAt: new Date().toISOString(),
          floorplanFiles: assetStore.floorplanFiles,
          styleFiles: assetStore.styleFiles,
          prompt: prompt.value,
          isBatch: true,
          totalCombinations: totalCombinations
        })

        return { success: true, jobId: result.jobId }
      } else {
        setStatusMessage(
          '批量生成失败：' + (result.error || '未知错误'),
          'error'
        )
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Batch generation failed:', error)
      setStatusMessage('批量生成失败：' + error.message, 'error')
      return { success: false, error: error.message }
    }
  }

  const executePreviewNow = async (assetStore, options = {}) => {
    try {
      const uiStore = useUIStore()
      // 参数验证（预览不需要提示词）
      if (!assetStore.floorplanFile?.file || !assetStore.styleFile?.file) {
        setStatusMessage('请上传平面图和风格参考图', 'error')
        return { success: false, error: '缺少必要文件' }
      }

      const placeholderId = options?.placeholderId || null

      if (import.meta.env.DEV && uiStore.useGenerationMock) {
        ensureMockEngineSubscribed()
        const job = mockEngine.createJob({
          title: `模拟预览 ${prompt.value.substring(0, 20) || 'preview'}`,
          description: '快速预览',
          workflowId: 'archviz-preview',
          status: 'queued',
          parameters: { prompt: prompt.value || '建筑可视化预览' }
        })

        const adoptedJobId = replacePlaceholderWithSubmittedJob(placeholderId, {
          id: job.id,
          title: job.title,
          description: job.description,
          workflowId: job.workflowId,
          status: 'queued',
          createdAt: job.createdAt,
          parameters: job.parameters,
          inputImages: [],
          resultImages: [],
          pendingSubmission: false
        })
        startGeneration(adoptedJobId)

        const inputFloorplanPath =
          assetStore.floorplanFile?.preview ||
          assetStore.floorplanFile?.url ||
          null
        const inputStylePath =
          assetStore.styleFile?.preview || assetStore.styleFile?.url || null
        updateJob(adoptedJobId, {
          origin: 'mock',
          isPreview: true,
          input: {
            ...(jobs.find((j) => j.id === adoptedJobId)?.input || {}),
            prompt: prompt.value || '建筑可视化预览',
            floorplanPath: inputFloorplanPath,
            stylePath: inputStylePath
          }
        })

        const pool = Object.values(images)
        const picked =
          pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
        const resultUrls = picked ? [picked] : []
        const totalMs = 30000 + Math.floor(Math.random() * 30001)
        const stagePlan = buildMockGenerationStagePlan(totalMs)
        const scenario = uiStore.mockScenario
        const startOptions = {
          resultImages: resultUrls,
          stagePlan,
          tickMs: 500
        }
        if (scenario === 'fail') {
          startOptions.failAtPercent = uiStore.mockFailAtPercent
          startOptions.failMessage = '模拟失败'
        }
        if (scenario === 'randomFail') {
          const rate = Number.isFinite(Number(uiStore.mockFailRate))
            ? Number(uiStore.mockFailRate)
            : 0
          if (Math.random() < Math.min(1, Math.max(0, rate))) {
            startOptions.failAtPercent = Math.floor(10 + Math.random() * 75)
            startOptions.failMessage = '模拟失败（随机）'
          }
        }
        if (scenario === 'cancel') {
          scheduleMockCancel(
            adoptedJobId,
            uiStore.mockCancelAfterMs,
            '模拟取消'
          )
        }
        mockEngine.startJob(adoptedJobId, startOptions)
        return { success: true, jobId: adoptedJobId, mock: true }
      }

      const result = await generateAPI(
        assetStore.floorplanFile.file,
        assetStore.styleFile.file,
        prompt.value || '建筑可视化预览',
        'archviz-preview',
        { ...advancedParameters.value, steps: 10 }, // 预览使用更少步数
        {
          wireframeImage: assetStore.wireframeFile?.file,
          materialImage: assetStore.materialFile?.file
        }
      )

      if (result.success) {
        // 开始生成流程
        const adoptedJobId = replacePlaceholderWithSubmittedJob(placeholderId, {
          id: result.jobId,
          title: `预览任务 ${result.jobId}`,
          description: '快速预览',
          workflowId: 'archviz-preview',
          status: 'queued',
          origin: getActiveApiOrigin(),
          createdAt: new Date().toISOString(),
          floorplanFile: assetStore.floorplanFile,
          styleFile: assetStore.styleFile,
          wireframeFile: assetStore.wireframeFile,
          materialFile: assetStore.materialFile,
          prompt: prompt.value || '建筑可视化预览',
          parameters: { ...advancedParameters.value, steps: 10 },
          isPreview: true,
          pendingSubmission: false
        })
        startGeneration(adoptedJobId)

        return { success: true, jobId: adoptedJobId }
      } else {
        setStatusMessage('预览失败：' + (result.error || '未知错误'), 'error')
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Preview failed:', error)
      setStatusMessage('预览失败：' + error.message, 'error')
      return { success: false, error: error.message }
    }
  }

  const executePreview = async (assetStore) => {
    const queuedResult = enqueueSubmissionIfBusy({
      title: `预览任务 ${new Date().toLocaleTimeString()}`,
      description: '快速预览',
      workflowId: 'archviz-preview',
      isPreview: true,
      input: buildQueuedInputSnapshot(assetStore),
      executor: async (placeholderId) =>
        executePreviewNow(assetStore, { placeholderId })
    })
    if (queuedResult) return queuedResult

    submissionDispatching.value = true
    try {
      return await executePreviewNow(assetStore)
    } finally {
      submissionDispatching.value = false
      if (!hasActiveSubmittedJob()) scheduleRunNextSubmission()
    }
  }

  const retryJobById = async (jobId) => {
    if (!import.meta.env.DEV)
      return { success: false, error: '请在工作台重新提交任务' }
    const source = jobs.find((j) => j.id === jobId)
    if (!source) return { success: false, error: 'Job not found' }

    if (source.origin !== 'mock') {
      return { success: false, error: '仅支持 Mock 任务重试' }
    }

    const uiStore = useUIStore()
    ensureMockEngineSubscribed()
    const job = mockEngine.createJob({
      title: `重试 ${source.title || source.id}`,
      description: source.description || source.parameters?.prompt || '',
      workflowId: source.workflowId || 'archviz-preview',
      status: 'queued',
      parameters: source.parameters || { prompt: source.description || '' }
    })

    startGeneration(job.id)
    addJob({
      id: job.id,
      title: job.title,
      description: job.description,
      workflowId: job.workflowId,
      status: 'queued',
      createdAt: job.createdAt,
      parameters: job.parameters,
      inputImages: [],
      resultImages: []
    })

    updateJob(job.id, {
      origin: 'mock',
      input: source.input
    })

    const pool = Object.values(images)
    const picked =
      pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
    const resultUrls = picked ? [picked] : []
    const scenario = uiStore.mockScenario
    const startOptions = { resultImages: resultUrls }
    if (scenario === 'fail') {
      startOptions.failAtPercent = uiStore.mockFailAtPercent
      startOptions.failMessage = '模拟失败'
    }
    if (scenario === 'randomFail') {
      const rate = Number.isFinite(Number(uiStore.mockFailRate))
        ? Number(uiStore.mockFailRate)
        : 0
      if (Math.random() < Math.min(1, Math.max(0, rate))) {
        startOptions.failAtPercent = Math.floor(10 + Math.random() * 75)
        startOptions.failMessage = '模拟失败（随机）'
      }
    }
    if (scenario === 'cancel') {
      scheduleMockCancel(job.id, uiStore.mockCancelAfterMs, '模拟取消')
    }
    mockEngine.startJob(job.id, startOptions)

    return { success: true, jobId: job.id, mock: true }
  }

  return {
    validateGenerationParams,
    validateBatchGenerationParams,
    handleMockGenerationStart,
    executeGenerationNow,
    executeGeneration,
    executeBatchGeneration,
    executePreviewNow,
    executePreview,
    retryJobById
  }
}
