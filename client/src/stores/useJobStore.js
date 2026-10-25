import { createSubmissionApi } from './job/submissionApi.js'
import { createSubmissionQueue } from './job/submissionQueue.js'
import { createSubmissionActions } from './job/submissionActions.js'
import { createResultActions } from './job/resultActions.js'
import { createRecords } from './job/records.js'
import { mergeJobInput, buildQueuedInputSnapshot as inputSnapshot } from './job/inputPayload.js'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/index.js'

import { createMockGenerationEngine } from '@/mock/mockGenerationEngine.js'

import { createJobStoreState } from './job/state.js'
import { createQueueLogic } from './job/queueLogic.js'
import { createRuntimeGuard } from './job/runtimeGuard.js'
import { createHistoryLogic } from './job/historyLogic.js'
import { createMockService } from './job/mockService.js'
import { createComputedState } from './job/computedState.js'
import { createStorageLogic } from './job/storageLogic.js'
import { saveJobsToStorage as _saveJobsToStorage, parseJobsFromStorage } from './job/storageService.js'
import { normalizeJobStatus, getStageInfo, normalizeProgressValue } from './job/statusNormalize.js'
import { getOutputUrl, getOutputUrls, getInputUrl, getReferenceUrl } from './job/urlNormalize.js'

import { toTimestampMs, normalizeHistoryItem, normalizePendingHistoryItem, normalizeJobsHistoryPayload, normalizeLegacyHistoryPayload, mergeHistoryItems } from './job/resultMapper.js'

const useJobsApiMode = true
const useComfyBridgeMode = false

let mockEngineSingleton = null
const getMockEngine = () => {
  if (!mockEngineSingleton) {
    mockEngineSingleton = createMockGenerationEngine()
  }
  return mockEngineSingleton
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
  } = import.meta.env.DEV ? createMockService({
    jobs,
    updateJob: (...args) => updateJob(...args),
    completeGeneration: (...args) => completeGeneration(...args),
    failGeneration: (...args) => failGeneration(...args),
    clearGeneration: () => clearGeneration(),
    getMockEngine: () => getMockEngine()
  }) : {}

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

  const buildQueuedInputSnapshot = assetStore => inputSnapshot(assetStore, prompt.value)

  const { refreshPendingQueueStage, removePendingSubmissionById, scheduleRunNextSubmission, replacePlaceholderWithSubmittedJob, runNextSubmissionIfIdle, enqueueSubmissionIfBusy } = createSubmissionQueue({
    pendingSubmissionQueue,
    updateJob: (...args) => updateJob(...args),
    addJob: (...args) => addJob(...args),
    jobs,
    progressMap,
    queuePositionMap,
    scheduleQueuePositionCommit: (...args) => scheduleQueuePositionCommit(...args),
    setCurrentJobId: (...args) => setCurrentJobId(...args),
    saveJobsToStorage: (...args) => saveJobsToStorage(...args),
    ensureQueuePolling: (...args) => ensureQueuePolling(...args),
    submissionDispatching,
    hasActiveSubmittedJob: (...args) => hasActiveSubmittedJob(...args),
    failGeneration: (...args) => failGeneration(...args),
    resetStaleGeneratingStateWrapper: (...args) => resetStaleGeneratingStateWrapper(...args),
    isGenerating,
    resetStaleActiveSubmittedJobsWrapper: (...args) => resetStaleActiveSubmittedJobsWrapper(...args),
    MAX_PENDING_SUBMISSIONS,
    createLocalQueuedId: (...args) => createLocalQueuedId(...args)
  })

  // ===== 生成工具函数 =====
  const { validateGenerationParams, validateBatchGenerationParams, handleMockGenerationStart, executeGenerationNow, executeGeneration, executeBatchGeneration, executePreviewNow, executePreview, retryJobById } = createSubmissionActions({
    ensureMockEngineSubscribed: (...args) => ensureMockEngineSubscribed(...args),
    mockEngine,
    replacePlaceholderWithSubmittedJob: (...args) => replacePlaceholderWithSubmittedJob(...args),
    startGeneration: (...args) => startGeneration(...args),
    updateJob: (...args) => updateJob(...args),
    jobs,
    buildMockGenerationStagePlan: (...args) => buildMockGenerationStagePlan(...args),
    scheduleMockCancel: (...args) => scheduleMockCancel(...args),
    prompt,
    setStatusMessage: (...args) => setStatusMessage(...args),
    advancedParameters,
    generateWithMaskAPI: (...args) => generateWithMaskAPI(...args),
    generateAPI: (...args) => generateAPI(...args),
    getActiveApiOrigin: (...args) => getActiveApiOrigin(...args),
    addJob: (...args) => addJob(...args),
    enqueueSubmissionIfBusy: (...args) => enqueueSubmissionIfBusy(...args),
    buildQueuedInputSnapshot: (...args) => buildQueuedInputSnapshot(...args),
    submissionDispatching,
    hasActiveSubmittedJob: (...args) => hasActiveSubmittedJob(...args),
    scheduleRunNextSubmission: (...args) => scheduleRunNextSubmission(...args),
    batchGenerateAPI: (...args) => batchGenerateAPI(...args)
  })

  const { generateAPI, generateWithMaskAPI, batchGenerateAPI, createJobViaAPI, submitLegacyComfyJob, createLegacyComfyJob } = createSubmissionApi({
    addJob: (...args) => addJob(...args),
    getActiveApiOrigin: (...args) => getActiveApiOrigin(...args),
    replacePlaceholderWithSubmittedJob: (...args) => replacePlaceholderWithSubmittedJob(...args),
    setCurrentJobId: (...args) => setCurrentJobId(...args),
    setGenerating: (...args) => setGenerating(...args),
    resetStaleGeneratingStateWrapper: (...args) => resetStaleGeneratingStateWrapper(...args),
    resetStaleActiveSubmittedJobsWrapper: (...args) => resetStaleActiveSubmittedJobsWrapper(...args),
    ensureComfyReadyForNewRunWrapper: (...args) => ensureComfyReadyForNewRunWrapper(...args),
    hasActiveSubmittedJob: (...args) => hasActiveSubmittedJob(...args),
    submissionDispatching,
    isGenerating,
    enqueueSubmissionIfBusy: (...args) => enqueueSubmissionIfBusy(...args),
    pendingSubmissionQueue
  })

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

  const { upsertHistoryRecord, completeGeneration, failGeneration, getLegacyComfyResult } = createResultActions({
    jobs,
    getDisplayProgressById: (...args) => getDisplayProgressById(...args),
    mergeJobInput: (...args) => mergeJobInput(...args),
    updateJob: (...args) => updateJob(...args),
    addJob: (...args) => addJob(...args),
    progressMap,
    queuePositionMap,
    scheduleQueuePositionCommit: (...args) => scheduleQueuePositionCommit(...args),
    currentJobId,
    setStatusMessage: (...args) => setStatusMessage(...args),
    setGenerating: (...args) => setGenerating(...args),
    setCurrentJobId: (...args) => setCurrentJobId(...args),
    resetStatus: (...args) => resetStatus(...args),
    scheduleRunNextSubmission: (...args) => scheduleRunNextSubmission(...args),
    sleep: (...args) => sleep(...args)
  })
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

  const clearGeneration = () => {
    setGenerating(false)
    setCurrentJobId(null)
    resetStatus()
  }

  // ===== 生成业务逻辑 =====

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
    return api.jobs.getComfyQueueState()
  }

  const setGenerationProgress = (progress) => {
    // 现在 generationProgress 是计算属性，不需要直接设置
    // 进度通过更新对应的 job 来间接更新
    console.warn('setGenerationProgress is deprecated, use updateProgress instead')
  }

  const { addJob, updateJob } = createRecords({
    getActiveApiOrigin: (...args) => getActiveApiOrigin(...args),
    jobs,
    progressMap,
    isActiveStatus: (...args) => isActiveStatus(...args),
    queuePositionMap,
    scheduleQueuePositionCommit: (...args) => scheduleQueuePositionCommit(...args),
    saveJobsToStorage: (...args) => saveJobsToStorage(...args),
    ensureQueuePolling: (...args) => ensureQueuePolling(...args),
    isTerminalStatus: (...args) => isTerminalStatus(...args),
    scheduleRunNextSubmission: (...args) => scheduleRunNextSubmission(...args)
  })

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

    if (import.meta.env.DEV && job.origin === 'mock') {
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
