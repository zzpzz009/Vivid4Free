import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/index.js'
// import { useWebSocket } from '../composables/useWebSocket.js'
import { BASE_URL } from '../api/apiUtils.js'
import { createMockGenerationEngine } from '@/mock/mockGenerationEngine.js'
import { images } from '@/utils/assets.js'
import { objgetimgurl } from '@/utils/utils.js'
import { useUIStore } from './useUIStore.js'
import { createJobStoreState } from './job/state.js'
import { createQueueLogic } from './job/queueLogic.js'
import { createRuntimeGuard } from './job/runtimeGuard.js'
import { createHistoryLogic } from './job/historyLogic.js'
import { createMockService } from './job/mockService.js'
import { createComputedState } from './job/computedState.js'
import { createStorageLogic } from './job/storageLogic.js'
import { saveJobsToStorage as _saveJobsToStorage, parseJobsFromStorage } from './job/storageService.js'
import { normalizeJobStatus, getStageInfo, normalizeProgressValue } from './job/statusNormalize.js'
import {
  getOutputUrl,
  getOutputUrls,
  getInputUrl,
  getReferenceUrl,
  normalizeImageInfo,
  buildOutputFromResultImages
} from './job/urlNormalize.js'

import {
  toTimestampMs,
  normalizeHistoryUrl,
  normalizeHistoryItem,
  normalizePendingHistoryItem,
  normalizeJobsHistoryPayload,
  normalizeLegacyHistoryPayload,
  mergeHistoryItems
} from './job/resultMapper.js'

const useJobsApiMode = import.meta.env.VITE_USE_JOBS_API === 'true' || import.meta.env.VITE_USE_JOBS_API === '1'
const useComfyBridgeMode = import.meta.env.VITE_USE_COMFY_BRIDGE === 'true' || import.meta.env.VITE_USE_COMFY_BRIDGE === '1'

let mockEngineSingleton = null
const getMockEngine = () => {
  if (!mockEngineSingleton) {
    mockEngineSingleton = createMockGenerationEngine()
  }
  return mockEngineSingleton
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const mergeJobInput = (existingInput = {}, nextInput = {}) => ({
  ...existingInput,
  ...nextInput,
  floorplanPath: nextInput?.floorplanPath || existingInput?.floorplanPath || null,
  stylePath: nextInput?.stylePath || existingInput?.stylePath || null,
  floorplanAssetId: nextInput?.floorplanAssetId || existingInput?.floorplanAssetId || null,
  floorplanImage: nextInput?.floorplanImage || existingInput?.floorplanImage || null,
  styleImage: nextInput?.styleImage || existingInput?.styleImage || null
})

export const useJobStore = defineStore('job', () => {
  // ===== 任务数据管理 =====
  // 所有任务列表
  const {
    jobs,
    historyArchiveItems,
    historyDegraded,
    progressMap,
    queuePositionMap,
    historySyncHint,
    comfyWsConnected,
    liveSyncEnabled,
    isGenerating,
    currentJobId,
    previewUpscaleRunState,
    prompt,
    advancedParameters,
    statusMessage,
    statusType
  } = createJobStoreState()

  // ===== mock ====
  const {
    mockEngine,
    ensureMockEngineSubscribed,
    scheduleMockCancel,
    clearMockCancelTimer,
    buildMockGenerationStagePlan
  } = createMockService({
    jobs,
    updateJob: (...args) => updateJob(...args),
    completeGeneration: (...args) => completeGeneration(...args),
    failGeneration: (...args) => failGeneration(...args),
    clearGeneration: () => clearGeneration(),
    getMockEngine: () => getMockEngine()
  })

  // currentJob 现在是计算属性，不再需要 ref

  // Storage key
  const JOB_STORAGE_KEY = 'archviz-jobs'
  let queuePositionDebounceTimer = null
  let pendingQueuePositionSnapshot = {}
  const progressUpdateAtMap = new Map()
  const getActiveApiOrigin = () => (useJobsApiMode ? 'jobsAPI' : 'legacy')
  const MAX_PENDING_SUBMISSIONS = 3
  const pendingSubmissionQueue = ref([])
  const submissionDispatching = ref(false)

  const createLocalQueuedId = () => `local-queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const isActiveStatus = (status) => ['queued', 'running'].includes(normalizeJobStatus(status))
  const isTerminalStatus = (status) => ['completed', 'failed', 'cancelled'].includes(normalizeJobStatus(status))
  const PREVIEW_UPSCALE_RUN_STATES = ['idle', 'previewing', 'upscaling', 'cancelling']

  const {
    getRemoteQueueStats,
    detectZombieComfyRun,
    recoverZombieComfyRun,
    ensureComfyReadyForNewRun,
    isStaleActiveSubmittedJob,
    resetStaleActiveSubmittedJobs,
    resetStaleGeneratingState
  } = createRuntimeGuard({
    api,
    jobs,
    isGenerating,
    currentJobId,
    pendingSubmissionQueue,
    submissionDispatching,
    updateJob: (...args) => updateJob(...args),
    clearGeneration: () => clearGeneration(),
    refreshPendingQueueStage: () => refreshPendingQueueStage(),
    resetPreviewUpscaleRunState: () => resetPreviewUpscaleRunState()
  })

  const ensureComfyReadyForNewRunWrapper = async () => {
    return ensureComfyReadyForNewRun(setStatusMessage)
  }

  const resetStaleActiveSubmittedJobsWrapper = () => {
    return resetStaleActiveSubmittedJobs(failGeneration)
  }

  const resetStaleGeneratingStateWrapper = () => {
    return resetStaleGeneratingState(failGeneration)
  }

  // isStaleActiveSubmittedJob 已经在 runtimeGuard 中返回并暴露，这里无需额外包装


  const hasActiveSubmittedJob = () => jobs.some((job) => isActiveStatus(job?.status) && !job?.pendingSubmission)

  const buildQueuedInputSnapshot = (assetStore) => ({
    floorplanPath: assetStore?.floorplanFile?.preview || assetStore?.floorplanFile?.url || null,
    stylePath: assetStore?.styleFile?.preview || assetStore?.styleFile?.url || null,
    prompt: prompt.value || '建筑可视化预览'
  })

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
    const idx = pendingSubmissionQueue.value.findIndex((item) => item.placeholderId === placeholderId)
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
      progress: Number.isFinite(Number(jobData.progress)) ? Number(jobData.progress) : 0,
      updatedAt: new Date().toISOString()
    }

    const nextProgressMap = { ...progressMap.value }
    const previousProgress = nextProgressMap[placeholderId]
    delete nextProgressMap[placeholderId]
    nextProgressMap[nextId] = Number.isFinite(Number(jobData.progress))
      ? Math.max(0, Math.min(100, Number(jobData.progress)))
      : (Number.isFinite(Number(previousProgress)) ? Number(previousProgress) : 0)
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
    if (!submissionDispatching.value && !isGenerating.value && hasActiveSubmittedJob()) {
      resetStaleActiveSubmittedJobsWrapper()
    }
    const hasBusyJob = hasActiveSubmittedJob() || submissionDispatching.value || isGenerating.value
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

  // ===== 生成工具函数 =====
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

  const {
    canGenerate,
    canPreview,
    isPreviewUpscaleBusy,
    previewUpscaleActiveKind,
    currentJob,
    generationProgress,
    historyItems: historyItemsComputed,
    queuedJobs,
    processingJobs,
    completedJobs,
    failedJobs
  } = createComputedState({
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
  })

  // ===== Helper Functions =====

  const scheduleQueuePositionCommit = (snapshot) => {
    pendingQueuePositionSnapshot = snapshot || {}
    if (queuePositionDebounceTimer) return
    queuePositionDebounceTimer = setTimeout(() => {
      queuePositionMap.value = { ...pendingQueuePositionSnapshot }
      queuePositionDebounceTimer = null
    }, 1000)
  }

  const getDisplayProgressById = (jobId) => {
    if (!jobId) return 0
    const fromMap = progressMap.value?.[jobId]
    if (Number.isFinite(Number(fromMap))) return normalizeProgressValue(fromMap, 0)
    const existing = jobs.find((j) => j?.id === jobId)
    if (existing && Number.isFinite(Number(existing.progress))) return normalizeProgressValue(existing.progress, 0)
    return 0
  }

  const patchProgressById = (jobId, percentage, stage, stageInfo, options = {}) => {
    if (!jobId) return
    const now = Date.now()
    const previousAt = progressUpdateAtMap.get(jobId) || 0
    if (!options.force && now - previousAt < 100) return
    progressUpdateAtMap.set(jobId, now)
    const prevProgress = getDisplayProgressById(jobId)
    const safeProgress = Math.max(prevProgress, normalizeProgressValue(percentage, prevProgress))
    progressMap.value = {
      ...progressMap.value,
      [jobId]: safeProgress
    }
    const existing = jobs.find((j) => j?.id === jobId)
    const allowCompletedWithoutOutput = options.allowCompletedWithoutOutput === true
    const hasOutput = existing ? Boolean(getOutputUrl(existing)) : false
    const shouldMarkCompleted = safeProgress >= 100 && (allowCompletedWithoutOutput || hasOutput)
    const nextStage = stage || existing?.stage || '生成中'
    const nextStageInfo = shouldMarkCompleted
      ? (stageInfo || existing?.stageInfo || '任务已完成')
      : (safeProgress >= 100
          ? '等待结果同步'
          : (stageInfo || existing?.stageInfo || `进度 ${safeProgress}%`))
    if (existing) {
      updateJob(jobId, {
        status: shouldMarkCompleted ? 'completed' : 'running',
        progress: safeProgress,
        stage: nextStage,
        stageInfo: nextStageInfo
      })
    } else {
      addJob({
        id: jobId,
        title: '远端任务',
        description: 'ComfyUI 任务同步',
        workflowId: 'comfy',
        status: shouldMarkCompleted ? 'completed' : 'running',
        progress: safeProgress,
        stage: nextStage,
        stageInfo: nextStageInfo,
        origin: 'comfyQueue',
        createdAt: new Date().toISOString()
      })
    }
  }

  const upsertHistoryRecord = (record) => {
    if (!record?.id) return
    const existing = jobs.find((j) => j?.id === record.id)
    const nextProgress = record.status === 'completed' ? 100 : getDisplayProgressById(record.id)
    const nextResultImages = Array.isArray(record.resultImages) && record.resultImages.length > 0
      ? record.resultImages
      : (Array.isArray(record.output?.resultUrls) && record.output.resultUrls.length > 0
          ? record.output.resultUrls
          : existing?.resultImages)
    const nextOutput = record.output || buildOutputFromResultImages(nextResultImages) || existing?.output
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
  const {
    initHistory: initHistoryImpl,
    pullRecentHistory: pullRecentHistoryImpl,
    hydrateHistoryByIds: hydrateHistoryByIdsImpl
  } = createHistoryLogic({
    api,
    historyArchiveItems,
    historyDegraded,
    historyItems: historyItemsComputed,
    normalizeJobsHistoryPayload,
    normalizeLegacyHistoryPayload,
    mergeHistoryItems,
    upsertHistoryRecord,
    patchProgressById,
    queuePositionMap,
    scheduleQueuePositionCommit
  })

  const initHistoryWrapper = async (force) => {
    const result = await initHistoryImpl(force)
    const backfillIds = Array.from(new Set(
      jobs
        .filter((item) => {
          const status = normalizeJobStatus(item?.status)
          if (!['failed', 'queued', 'running', 'processing'].includes(status)) return false
          return getOutputUrls(item).length === 0
        })
        .map((item) => String(item?.id || '').trim())
        .filter(Boolean)
    ))
    if (backfillIds.length > 0) {
      await hydrateHistoryByIdsImpl(backfillIds)
    }
    return result
  }

  // 辅助函数：获取输入图片URL（参考 HistorySection 的逻辑）
  const getInputUrlWrapper = (job) => {
    return getInputUrl(job)
  }

  // 辅助函数：获取参考图片URL（参考 HistorySection 的逻辑）
  const getReferenceUrlWrapper = (job) => {
    return getReferenceUrl(job)
  }

  const getOutputUrlsWithFallback = (job) => {
    return getOutputUrls(job)
  }

  const getOutputUrlWithFallback = (job) => {
    return getOutputUrl(job)
  }

  // toTimestampMsWrapper 已删除

  // normalizeHistoryUrlWrapper 已删除

  // normalizeHistoryItemWrapper 已删除

  // normalizeJobsHistoryPayloadWrapper 已删除

  // normalizeLegacyHistoryPayloadWrapper 已删除

  // mergeHistoryItemsWrapper 已删除



  const hasActiveQueueJobs = () => {
    const now = Date.now()
    const activeWindowMs = 30 * 60 * 1000
    return jobs.some((job) => {
      if (!job || !isActiveStatus(job.status)) return false
      const latestTs = Math.max(toTimestampMs(job.updatedAt), toTimestampMs(job.createdAt))
      if (!latestTs) return true
      return now - latestTs <= activeWindowMs
    })
  }





  const {
    syncComfyQueue,
    stopQueuePolling,
    ensureQueuePolling,
    startHistoryLiveSync,
    stopHistoryLiveSync
  } = createQueueLogic({
    api,
    jobs,
    liveSyncEnabled,
    comfyWsConnected,
    historySyncHint,
    queuePositionMap,
    scheduleQueuePositionCommit,
    normalizeJobStatus,
    updateJob: (...args) => updateJob(...args),
    addJob: (...args) => addJob(...args),
    pullRecentHistory: (...args) => pullRecentHistoryImpl(...args),
    hydrateHistoryByIds: (...args) => hydrateHistoryByIdsImpl(...args),
    hasActiveQueueJobs,
    initHistory: (...args) => initHistoryWrapper(...args)
  })

  // ===== Actions =====

  // 任务管理 Actions
  // setCurrentJob 已移除，currentJob 现在是计算属性

  // 生成状态管理 Actions
  const setGenerating = (generating) => {
    isGenerating.value = generating
  }

  // 兼容性方法 - 为了支持现有的 App.vue 代码
  const setLoading = (loading) => {
    setGenerating(loading)
  }

  const setCurrentJobId = (jobId) => {
    currentJobId.value = jobId
  }

  const setPreviewUpscaleRunState = (nextState = 'idle') => {
    const normalizedState = PREVIEW_UPSCALE_RUN_STATES.includes(nextState) ? nextState : 'idle'
    previewUpscaleRunState.value = normalizedState
  }

  const tryStartPreviewUpscaleRun = (kind) => {
    const nextState = kind === 'upscale' ? 'upscaling' : 'previewing'
    if (previewUpscaleRunState.value !== 'idle') {
      return false
    }
    setPreviewUpscaleRunState(nextState)
    return true
  }

  const resetPreviewUpscaleRunState = () => {
    setPreviewUpscaleRunState('idle')
  }

  const getPreviewUpscaleGuardMessage = (requestedKind = null) => {
    if (previewUpscaleRunState.value === 'previewing') {
      return requestedKind === 'upscale' ? '当前正在预览，请等待完成后再放大' : '当前正在预览，请稍候'
    }
    if (previewUpscaleRunState.value === 'upscaling') {
      return requestedKind === 'preview' ? '当前正在放大，请等待完成后再预览' : '当前正在放大，请稍候'
    }
    if (previewUpscaleRunState.value === 'cancelling') {
      return '正在取消任务，请稍候'
    }
    return ''
  }

  const setPrompt = (newPrompt) => {
    prompt.value = newPrompt
  }

  const setAdvancedParameters = (params) => {
    advancedParameters.value = { ...advancedParameters.value, ...params }
  }

  const setStatusMessage = (message, type = 'info') => {
    statusMessage.value = message
    statusType.value = type
  }

  const resetStatus = () => {
    statusMessage.value = 'Ready'
    statusType.value = 'info'
    // currentStatus 现在是计算属性，不需要手动重置
  }

  // 生成流程控制
  const startGeneration = (jobId) => {
    setGenerating(true)
    setCurrentJobId(jobId)
    setStatusMessage('正在生成图像...', 'info')

    // 确保作业在列表中有初始状态
    const existingJobIndex = jobs.findIndex(job => job.id === jobId)
    if (existingJobIndex >= 0) {
      jobs[existingJobIndex] = {
        ...jobs[existingJobIndex],
        status: 'queued',
        progress: 0,
        stage: '准备中'
      }
      progressMap.value = {
        ...progressMap.value,
        [jobId]: 0
      }
    }
    ensureQueuePolling()
  }

  const updateProgress = (progressData) => {
    const { percentage, stage, stageInfo, jobId } = progressData
    patchProgressById(jobId, percentage, stage, stageInfo, { force: true })
    ensureQueuePolling()

    // 如果是当前任务，更新状态消息
    if (jobId === currentJobId.value) {
      setStatusMessage(`${stage}: ${stageInfo}`, 'info')
    }
  }

  const completeGeneration = (jobData) => {
    // 更新 jobs 列表中的对应任务
    const jobIndex = jobs.findIndex(job => job.id === jobData.id)
    if (jobIndex >= 0) {
      const resultImages = jobData.resultImages || jobs[jobIndex].resultImages
      const nextOutput = jobData.output || buildOutputFromResultImages(resultImages) || jobs[jobIndex].output
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        status: 'completed',
        progress: 100,
        stage: '已完成',
        completedAt: new Date().toISOString(),
        resultImages,
        output: nextOutput,
        allowTempOutput: jobData.allowTempOutput ?? jobs[jobIndex].allowTempOutput
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
    const jobIndex = jobs.findIndex(job => job.id === jobId)
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

  const clearGeneration = () => {
    setGenerating(false)
    setCurrentJobId(null)
    resetStatus()
  }

  const handleMockGenerationStart = (assetStore, placeholderId, uiStore, currentPrompt, currentAdvancedParams) => {
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

    const inputFloorplanPath = assetStore.floorplanFile?.preview || assetStore.floorplanFile?.url || null
    const inputStylePath = assetStore.styleFile?.preview || assetStore.styleFile?.url || null
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
    const startOptions = { resultImages: [], stagePlan: buildMockGenerationStagePlan(totalMs), tickMs: 500 }
    if (scenario === 'fail') {
      startOptions.failAtPercent = uiStore.mockFailAtPercent
      startOptions.failMessage = '模拟失败'
    }
    if (scenario === 'randomFail') {
      const rate = Number.isFinite(Number(uiStore.mockFailRate)) ? Number(uiStore.mockFailRate) : 0
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

  // ===== 生成业务逻辑 =====
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

      if (uiStore.useGenerationMock) {
        return handleMockGenerationStart(assetStore, placeholderId, uiStore, prompt.value, advancedParameters.value)
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
      const title = options?.title || `生成任务 ${new Date().toLocaleTimeString()}`
      const description = options?.description || '洗图放大'
      const promptText = options?.promptFallback || prompt.value || '洗图放大'

      if (uiStore.useGenerationMock) {
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

        const inputFloorplanPath = assetStore.floorplanFile?.preview || assetStore.floorplanFile?.url || null
        updateJob(job.id, {
          origin: 'mock',
          input: {
            ...(jobs.find((j) => j.id === job.id)?.input || {}),
            prompt: promptText,
            floorplanPath: inputFloorplanPath
          }
        })

        const pool = Object.values(images)
        const picked = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
        const resultUrls = picked ? [picked] : []
        const totalMs = 30000 + Math.floor(Math.random() * 30001)
        const stagePlan = buildMockGenerationStagePlan(totalMs)
        const scenario = uiStore.mockScenario
        const startOptions = { resultImages: resultUrls, stagePlan, tickMs: 500 }
        if (scenario === 'fail') {
          startOptions.failAtPercent = uiStore.mockFailAtPercent
          startOptions.failMessage = '模拟失败'
        }
        if (scenario === 'randomFail') {
          const rate = Number.isFinite(Number(uiStore.mockFailRate)) ? Number(uiStore.mockFailRate) : 0
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
      executor: async (placeholderId) => executeGenerationNow(assetStore, { placeholderId })
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

      if (uiStore.useGenerationMock) {
        ensureMockEngineSubscribed()
        const totalCombinations = assetStore.floorplanFiles.length * assetStore.styleFiles.length
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
        const startOptions = { resultImages: [], stagePlan: buildMockGenerationStagePlan(totalMs), tickMs: 500 }
        if (scenario === 'fail') {
          startOptions.failAtPercent = uiStore.mockFailAtPercent
          startOptions.failMessage = '模拟失败'
        }
        if (scenario === 'randomFail') {
          const rate = Number.isFinite(Number(uiStore.mockFailRate)) ? Number(uiStore.mockFailRate) : 0
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
        const totalCombinations = assetStore.floorplanFiles.length * assetStore.styleFiles.length

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
        setStatusMessage('批量生成失败：' + (result.error || '未知错误'), 'error')
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

      if (uiStore.useGenerationMock) {
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

        const inputFloorplanPath = assetStore.floorplanFile?.preview || assetStore.floorplanFile?.url || null
        const inputStylePath = assetStore.styleFile?.preview || assetStore.styleFile?.url || null
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
        const picked = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
        const resultUrls = picked ? [picked] : []
        const totalMs = 30000 + Math.floor(Math.random() * 30001)
        const stagePlan = buildMockGenerationStagePlan(totalMs)
        const scenario = uiStore.mockScenario
        const startOptions = { resultImages: resultUrls, stagePlan, tickMs: 500 }
        if (scenario === 'fail') {
          startOptions.failAtPercent = uiStore.mockFailAtPercent
          startOptions.failMessage = '模拟失败'
        }
        if (scenario === 'randomFail') {
          const rate = Number.isFinite(Number(uiStore.mockFailRate)) ? Number(uiStore.mockFailRate) : 0
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
      executor: async (placeholderId) => executePreviewNow(assetStore, { placeholderId })
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

  // ===== 兼容性方法 - 为了支持现有的 App.vue 代码 =====
  const generate = async (floorplanFile, styleFile, prompt, workflowId, advancedParameters, advancedParameterFiles) => {
    return await generateAPI(floorplanFile, styleFile, prompt, workflowId, advancedParameters, advancedParameterFiles)
  }

  const generateWithMask = async (floorplanFile, styleFile, maskFile, prompt, workflowId, advancedParameters, advancedParameterFiles) => {
    return await generateWithMaskAPI(floorplanFile, styleFile, maskFile, prompt, workflowId, advancedParameters, advancedParameterFiles)
  }

  const batchGenerate = async (images, references, prompt, workflowId) => {
    return await batchGenerateAPI(images, references, prompt, workflowId)
  }

  const getQueue = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/queue`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return response.json()
    } catch (error) {
      console.error('Failed to get queue:', error)
      return { success: false, error: error.message }
    }
  }

  const setGenerationProgress = (progress) => {
    // 现在 generationProgress 是计算属性，不需要直接设置
    // 进度通过更新对应的 job 来间接更新
    console.warn('setGenerationProgress is deprecated, use updateProgress instead')
  }

  const addJob = (jobData) => {
    const buildInputPathFromInputImage = (value, defaultType) => {
      if (!value) return null
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('http') || trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed
        if (defaultType === 'input') {
          return objgetimgurl({
            filename: trimmed,
            type: defaultType
          })
        }
        return `/api/files/${trimmed}`
      }
      if (typeof value === 'object' && typeof value.filename === 'string') {
        return objgetimgurl({
          filename: value.filename,
          subfolder: value.subfolder || '',
          type: value.type || defaultType
        })
      }
      return null
    }

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
        floorplanPath: jobData.input?.floorplanPath || buildInputPathFromInputImage(jobData.inputImages?.[0], 'input'),
        stylePath: jobData.input?.stylePath || buildInputPathFromInputImage(jobData.inputImages?.[1], 'input'),
        floorplanFile: jobData.inputImages?.[0] || null,
        styleFile: jobData.inputImages?.[1] || null
      },

      // Output data structure
      output: jobData.output || (normalizedStatus === 'completed' ? buildOutputFromResultImages(jobData.resultImages) : null),

      // Original data
      parameters: jobData.parameters,
      inputImages: jobData.inputImages,
      resultImages: jobData.resultImages
    }

    // Check if job already exists
    const existingIndex = jobs.findIndex(item => item.id === jobData.id)

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
    const existingIndex = jobs.findIndex(item => item.id === jobId)

    if (existingIndex >= 0) {
      const prev = jobs[existingIndex]
      const nextStatus = normalizeJobStatus(updates?.status ?? prev.status)
      let nextProgress = updates?.progress
      if (Number.isFinite(Number(nextProgress))) {
        nextProgress = Math.min(100, Math.max(0, Number(nextProgress)))
      } else {
        nextProgress = undefined
      }

      if (normalizeJobStatus(prev.status) === 'running' && nextStatus === normalizeJobStatus(prev.status) && typeof nextProgress === 'number') {
        const prevProgress = Number.isFinite(Number(prev.progress)) ? Number(prev.progress) : 0
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
      const prevWasActive = isActiveStatus(prev.status) && !prev.pendingSubmission
      const nowPendingSubmission = updates?.pendingSubmission ?? prev.pendingSubmission
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

  const cancelJobById = async (jobId, reason = '用户取消') => {
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return { success: false, error: 'Job not found' }
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return { success: true, noop: true }
    }

    if (job.pendingSubmission) {
      removePendingSubmissionById(jobId)
      updateJob(jobId, { status: 'cancelled', progress: 0, stage: '已取消', stageInfo: reason, completedAt: new Date().toISOString(), pendingSubmission: false })
      scheduleRunNextSubmission()
      return { success: true, queued: true }
    }

    if (job.origin === 'mock') {
      clearMockCancelTimer(jobId)
      mockEngine.cancelJob(jobId, reason)
      updateJob(jobId, { status: 'cancelled', progress: 0, stage: '已取消', stageInfo: reason, completedAt: new Date().toISOString() })
      const nextQueue = { ...queuePositionMap.value }
      delete nextQueue[jobId]
      scheduleQueuePositionCommit(nextQueue)
      if (jobId === currentJobId.value) clearGeneration()
      scheduleRunNextSubmission()
      return { success: true, mock: true }
    }

    try {
      await api.jobs.cancelJob(jobId)
      updateJob(jobId, { status: 'cancelled', progress: 0, stage: '已取消', stageInfo: reason, completedAt: new Date().toISOString() })
      const nextQueue = { ...queuePositionMap.value }
      delete nextQueue[jobId]
      scheduleQueuePositionCommit(nextQueue)
      if (jobId === currentJobId.value) clearGeneration()
      scheduleRunNextSubmission()
      return { success: true }
    } catch (error) {
      return { success: false, error: error?.message || 'Cancel failed' }
    }
  }

  const retryJobById = async (jobId) => {
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
    const picked = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
    const resultUrls = picked ? [picked] : []
    const scenario = uiStore.mockScenario
    const startOptions = { resultImages: resultUrls }
    if (scenario === 'fail') {
      startOptions.failAtPercent = uiStore.mockFailAtPercent
      startOptions.failMessage = '模拟失败'
    }
    if (scenario === 'randomFail') {
      const rate = Number.isFinite(Number(uiStore.mockFailRate)) ? Number(uiStore.mockFailRate) : 0
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

  const addJobLog = (jobId, logEntry) => {
    const job = jobs.find(item => item.id === jobId)
    if (job) {
      if (!job.logs) job.logs = []
      job.logs.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        message: logEntry.message,
        level: logEntry.level || 'info'
      })
      // Keep only last 100 log entries
      if (job.logs.length > 100) {
        job.logs = job.logs.slice(-100)
      }
      saveJobsToStorage()
    }
  }



  const {
    saveJobsToStorage,
    loadJobsFromStorage,
    loadJobsFromServer,
    clearJobs
  } = createStorageLogic({
    jobs,
    JOB_STORAGE_KEY,
    parseJobsFromStorage,
    normalizeJobStatus,
    progressMap,
    queuePositionMap,
    ensureQueuePolling,
    stopQueuePolling,
    saveJobsToStorageImpl: _saveJobsToStorage,
    useComfyBridgeMode,
    isActiveStatus,
    toTimestampMs,
    setCurrentJobId
  })

  // Current job getters
  // getCurrentInputUrl, getCurrentOutputUrl, getCurrentReferenceUrl
  // 现在都是 currentJob 的计算属性，不再需要独立方法

  const selectJob = (job) => {
    // 设置当前作业ID，currentJob 会自动通过计算属性更新
    setCurrentJobId(job.id)
  }

  // API 集成函数
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
      resetStaleGeneratingStateWrapper()
      resetStaleActiveSubmittedJobsWrapper()
      await ensureComfyReadyForNewRunWrapper()
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

  const getLegacyComfyResult = async (promptId, options = {}) => {
    const maxAttempts = Number.isFinite(Number(options?.maxAttempts)) ? Math.max(1, Number(options.maxAttempts)) : 1
    const retryDelayMs = Number.isFinite(Number(options?.retryDelayMs)) ? Math.max(0, Number(options.retryDelayMs)) : 0
    let lastError = null

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const result = await api.jobs.getJobResults(promptId)
        const normalized = result?.data ? result : { data: result }
        if (normalized?.data && typeof normalized.data === 'object' && Object.keys(normalized.data).length > 0) {
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
    // ===== 任务数据状态 =====
    jobs,
    currentJob,

    // ===== 生成状态 =====
    isGenerating,
    generationProgress,
    currentJobId,
    previewUpscaleRunState,
    prompt,
    advancedParameters,
    statusMessage,
    statusType,

    // ===== Computed =====
    canGenerate,
    canPreview,
    isPreviewUpscaleBusy,
    previewUpscaleActiveKind,
    queuedJobs,
    processingJobs,
    completedJobs,
    failedJobs,

    // ===== 任务管理 Actions =====
    selectJob,
    addJob,
    updateJob,
    cancelJobById,
    retryJobById,
    addJobLog,
    saveJobsToStorage,
    loadJobsFromStorage,
    loadJobsFromServer,
    clearJobs,

    // ===== 生成状态管理 Actions =====
    setGenerating,
    setCurrentJobId,
    setPreviewUpscaleRunState,
    tryStartPreviewUpscaleRun,
    resetPreviewUpscaleRunState,
    getPreviewUpscaleGuardMessage,
    getRemoteQueueStats,
    detectZombieComfyRun,
    recoverZombieComfyRun,
    ensureComfyReadyForNewRun: ensureComfyReadyForNewRunWrapper,
    setPrompt,
    setAdvancedParameters,
    setStatusMessage,
    resetStatus,

    // ===== 生成流程控制 =====
    startGeneration,
    updateProgress,
    completeGeneration,
    failGeneration,
    clearGeneration,
    syncComfyQueue,

    // ===== 生成业务逻辑 =====
    executeGeneration,
    executeBatchGeneration,
    executePreview,

    // ===== 兼容性方法 (为了支持现有的 App.vue 代码) =====
    setLoading,
    generate,
    generateWithMask,
    batchGenerate,
    getQueue,
    setGenerationProgress,

    // ===== API Actions =====
    createJobViaAPI,
    createLegacyComfyJob,
    getLegacyComfyResult,

    // ===== Current job getters =====
    // getCurrentInputUrl, getCurrentOutputUrl, getCurrentReferenceUrl
    // 现在都是 currentJob 的属性

    // ===== 辅助方法（供其他组件使用）=====
    getOutputUrl: getOutputUrlWithFallback,
    getOutputUrls: getOutputUrlsWithFallback,
    getInputUrl: getInputUrlWrapper,
    getReferenceUrl: getReferenceUrlWrapper,
    progressMap,
    queuePositionMap,
    historySyncHint,
    comfyWsConnected,
    historyItems: historyItemsComputed,
    historyDegraded,
    initHistory: initHistoryWrapper,
    pullRecentHistory: pullRecentHistoryImpl,
    hydrateHistoryByIds: hydrateHistoryByIdsImpl,
    startHistoryLiveSync,
    stopHistoryLiveSync
  }
})
