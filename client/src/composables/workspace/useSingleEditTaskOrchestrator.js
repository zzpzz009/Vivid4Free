import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import config from '@/config/config.js'
import { connect } from '@/api/websocket.js'
import xmAPI from '@/api/xmapi.js'
import { useToast } from '@/utils/toast.js'
import { useAssetStore, useJobStore } from '@/stores'
import { useXMStore } from '@/stores/xmStore.js'
import { buildOutputFromResultImages } from '@/stores/job/urlNormalize.js'
import { selectPreferredComfyImage } from '@/stores/job/comfyResultSelection.js'
import { ensureInputAssetSnapshot } from '@/stores/job/inputAssetRegistry.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const createClientId = () => {
  const cachedClientId = localStorage.getItem('comfy-client-id') || ''
  if (cachedClientId) {
    return cachedClientId
  }
  const nextClientId = `client_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
  localStorage.setItem('comfy-client-id', nextClientId)
  return nextClientId
}

const cloneWorkflowJson = (value) => JSON.parse(JSON.stringify(value || {}))

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('读取蒙版失败'))
  reader.readAsDataURL(blob)
})

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('加载蒙版失败'))
  image.src = src
})

const canvasToBlob = (canvas, type = 'image/png') => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) {
      resolve(blob)
      return
    }
    reject(new Error('导出蒙版失败'))
  }, type)
})

// Comfy LoadImage 的 mask 输出来自反向 alpha，这里做一次兼容转换：
// 用户涂抹区域保持为“需要重绘”的 mask，未涂抹区域保持不重绘。
const convertMaskForComfyLoadImage = async (maskBlob) => {
  const src = await blobToDataUrl(maskBlob)
  const image = await loadImageElement(src)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('创建蒙版画布失败')
  }
  context.drawImage(image, 0, 0)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    data[index] = 255
    data[index + 1] = 255
    data[index + 2] = 255
    data[index + 3] = 255 - alpha
  }
  context.putImageData(imageData, 0, 0)
  return canvasToBlob(canvas, 'image/png')
}

export const useSingleEditTaskOrchestrator = (options = {}) => {
  const uploadedImage = options.uploadedImage
  const uploadedReferenceFile = options.uploadedReferenceFile
  const outpaintValues = options.outpaintValues
  const syncOriginalImage = typeof options.syncOriginalImage === 'function' ? options.syncOriginalImage : () => {}

  const clientId = ref(createClientId())
  const activePromptId = ref('')
  const previewimgurl = ref('')
  const activeModeId = ref('')

  const jobStore = useJobStore()
  const assetStore = useAssetStore()
  const xm = useXMStore()
  const { previewUpscaleRunState, prompt, jobs } = storeToRefs(jobStore)
  const { maskFile } = storeToRefs(assetStore)
  const { success, error, info, loading, removeToast } = useToast()

  let loadingToastId = null

  const setPreviewImage = (url = '') => {
    previewimgurl.value = url || ''
  }

  const setPromptValue = (nextPrompt = '') => {
    jobStore.setPrompt(String(nextPrompt || ''))
  }

  const beginRun = () => {
    if (jobStore.tryStartPreviewUpscaleRun('preview')) {
      return true
    }
    info(jobStore.getPreviewUpscaleGuardMessage('preview') || '当前已有任务运行中')
    return false
  }

  const resetRunState = () => {
    jobStore.resetPreviewUpscaleRunState()
    activePromptId.value = ''
    activeModeId.value = ''
  }

  const ensureComfyReadyForSubmission = async () => {
    try {
      await xmAPI.freeComfyResources()
      await sleep(1200)
      await jobStore.ensureComfyReadyForNewRun()
      return true
    } catch (guardError) {
      resetRunState()
      error(guardError.message)
      return false
    }
  }

  const resolvePromptText = (mode) => {
    const candidates = [prompt.value, xm.tsc, mode?.defaultPromptText]
    const nextPrompt = candidates.find((item) => String(item || '').trim())
    return String(nextPrompt || '')
  }

  const syncResolvedPrompt = (mode) => {
    const nextPrompt = resolvePromptText(mode)
    jobStore.setPrompt(nextPrompt)
    xm.savetsc(nextPrompt)
    return nextPrompt
  }

  const ensureInputSnapshot = async (mode) => {
    const floorplanSnapshot = await ensureInputAssetSnapshot(uploadedImage?.value)
    const referenceSnapshot = await ensureInputAssetSnapshot(uploadedReferenceFile?.value)
    return {
      floorplanAssetId: floorplanSnapshot.assetId || '',
      floorplanPath: floorplanSnapshot.url || uploadedImage?.value?.preview || uploadedImage?.value?.url || null,
      styleAssetId: referenceSnapshot.assetId || '',
      stylePath: referenceSnapshot.url || uploadedReferenceFile?.value?.preview || uploadedReferenceFile?.value?.url || null,
      prompt: resolvePromptText(mode)
    }
  }

  const uploadInputFileToComfy = async (file) => {
    const uploaded = await xmAPI.uploadimgapi(file)
    const uploadedName = String(uploaded?.name || '').trim()
    if (!uploadedName) {
      throw new Error('上传工作流输入图片失败')
    }
    return uploadedName
  }

  const resolveBaseInputImageName = async () => {
    const uploadedName = String(xm.dclimg || uploadedImage?.value?.comfyImageInfo?.filename || '').trim()
    if (uploadedName) {
      return uploadedName
    }
    const baseFile = uploadedImage?.value?.file
    if (!(baseFile instanceof File)) {
      throw new Error('请先上传待处理图片')
    }
    const nextName = await uploadInputFileToComfy(baseFile)
    xm.savedclimg(nextName)
    return nextName
  }

  const applyWorkflowSeed = (requestData, workflowConfig) => {
    const seedNodeId = String(workflowConfig?.input?.seed || '').trim()
    if (!seedNodeId) {
      return
    }
    const parsedSeed = Number.parseInt(String(xm.seed || ''), 10)
    if (!Number.isFinite(parsedSeed)) {
      return
    }
    const seedInputs = requestData?.prompt?.[seedNodeId]?.inputs
    if (!seedInputs || !Object.prototype.hasOwnProperty.call(seedInputs, 'noise_seed')) {
      return
    }
    seedInputs.noise_seed = parsedSeed
  }

  const getWorkflowNodeCount = (requestData) => {
    const workflow = requestData?.prompt
    if (!workflow || typeof workflow !== 'object') {
      return 1
    }
    return Math.max(1, Object.keys(workflow).length)
  }

  const finalizeLegacyJob = async (promptId, resultData, outputNodeIds = []) => {
    const outputs = resultData?.[promptId]?.outputs || {}
    const preferredNodeIds = Array.isArray(outputNodeIds) ? outputNodeIds : [outputNodeIds]
    const image = selectPreferredComfyImage(outputs, preferredNodeIds, {
      strictPreferred: preferredNodeIds.length > 0,
      allowTemp: false
    })
    if (!image) {
      return false
    }
    const resultImages = [image]
    const output = buildOutputFromResultImages(resultImages)
    const imageUrl = output?.imageUrl || ''
    jobStore.completeGeneration({
      id: promptId,
      resultImages,
      output,
      allowTempOutput: true
    })
    const hydratedItems = await jobStore.hydrateHistoryByIds([promptId])
    const hydratedItem = hydratedItems.find((item) => String(item?.id || '') === String(promptId)) || null
    const stableUrl = hydratedItem
      ? (jobStore.getOutputUrls(hydratedItem)[0] || jobStore.getOutputUrl(hydratedItem) || '')
      : ''
    const resolvedUrl = stableUrl || imageUrl
    if (resolvedUrl) {
      setPreviewImage(resolvedUrl)
      xm.savesuccessimgurl(resolvedUrl)
      syncOriginalImage(jobStore.getInputUrl(hydratedItem) || uploadedImage?.value?.preview || '')
    }
    return true
  }

  const pollLegacyJobUntilFinished = async ({ promptId, outputNodeIds, failureLabel }) => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const result = await jobStore.getLegacyComfyResult(promptId, {
        maxAttempts: 1,
        retryDelayMs: 0
      })
      const finalized = await finalizeLegacyJob(promptId, result.data, outputNodeIds)
      if (finalized) {
        removeToast(loadingToastId)
        success(`${failureLabel}成功`)
        resetRunState()
        return { success: true }
      }
      await sleep(800)
    }
    throw new Error(`${failureLabel}超时，请重试`)
  }

  const createLegacyRequestData = async (mode) => {
    const workflowConfig = config.config[mode.configKey]
    const resolvedPrompt = syncResolvedPrompt(mode)
    const requestData = {
      client_id: clientId.value,
      prompt: cloneWorkflowJson(workflowConfig.jsonfile)
    }

    if (mode.id === 'outpaint') {
      const inputImageName = await resolveBaseInputImageName()
      requestData.prompt[workflowConfig.input.dcl].inputs.image = inputImageName
      requestData.prompt[workflowConfig.input.tsc].inputs.text = resolvedPrompt
      requestData.prompt[workflowConfig.input.pad].inputs.left = Number(outpaintValues?.value?.left || 0)
      requestData.prompt[workflowConfig.input.pad].inputs.top = Number(outpaintValues?.value?.top || 0)
      requestData.prompt[workflowConfig.input.pad].inputs.right = Number(outpaintValues?.value?.right || 0)
      requestData.prompt[workflowConfig.input.pad].inputs.bottom = Number(outpaintValues?.value?.bottom || 0)
      applyWorkflowSeed(requestData, workflowConfig)
      requestData.prompt[workflowConfig.output.img].inputs.show_history = 'true'
      if (Object.prototype.hasOwnProperty.call(requestData.prompt[workflowConfig.output.img].inputs, 'show_previews')) {
        requestData.prompt[workflowConfig.output.img].inputs.show_previews = 'true'
      }
      return requestData
    }

    if (mode.id === 'inpaint') {
      const inputImageName = await resolveBaseInputImageName()
      const maskImageUrl = maskFile.value?.preview || maskFile.value?.url
      if (!maskImageUrl) {
        throw new Error('请先保存蒙版')
      }
      const res = await fetch(maskImageUrl)
      const blob = await res.blob()
      const convertedMaskBlob = await convertMaskForComfyLoadImage(blob)
      const maskFileObj = new File([convertedMaskBlob], `mask-${Date.now()}.png`, { type: 'image/png' })
      const maskImageName = await uploadInputFileToComfy(maskFileObj)

      requestData.prompt[workflowConfig.input.dcl].inputs.image = inputImageName
      requestData.prompt[workflowConfig.input.tsc].inputs.text = resolvedPrompt
      
      const maskNodeId = "9999"
      requestData.prompt[maskNodeId] = {
        class_type: "LoadImage",
        inputs: {
          image: maskImageName
        }
      }

      const growMaskNodeId = '26'
      if (requestData.prompt[growMaskNodeId]?.inputs && Object.prototype.hasOwnProperty.call(requestData.prompt[growMaskNodeId].inputs, 'mask')) {
        requestData.prompt[growMaskNodeId].inputs.mask = [maskNodeId, 1]
      }

      requestData.prompt[workflowConfig.output.img].inputs.show_history = 'true'
      if (Object.prototype.hasOwnProperty.call(requestData.prompt[workflowConfig.output.img].inputs, 'show_previews')) {
        requestData.prompt[workflowConfig.output.img].inputs.show_previews = 'true'
      }
      return requestData
    }

    if (mode.id === 'image-edit') {
      const inputImageName = await resolveBaseInputImageName()
      requestData.prompt[workflowConfig.input.dcl].inputs.image = inputImageName
      requestData.prompt[workflowConfig.input.tsc].inputs.text = resolvedPrompt
      requestData.prompt[workflowConfig.output.img].inputs.show_history = 'true'
      return requestData
    }

    throw new Error(`不支持的单图编辑模式：${mode.id}`)
  }

  const runLegacyMode = async ({ mode, loadingMessage, title, failureLabel }) => {
    if (!uploadedImage?.value?.file) {
      error(`请先上传${mode.imageUploadTitle}`)
      resetRunState()
      return
    }
    if (mode.supportsMask && !maskFile.value?.file) {
      error('请先绘制蒙版后再执行局部重绘')
      resetRunState()
      return
    }
    if (!await ensureComfyReadyForSubmission()) {
      return
    }

    loadingToastId = loading(loadingMessage)

    try {
      const requestData = await createLegacyRequestData(mode)
      const input = await ensureInputSnapshot(mode)
      const created = await jobStore.createLegacyComfyJob({
        payload: requestData,
        title,
        description: resolvePromptText(mode) || mode.name,
        workflowId: mode.configKey,
        input,
        rejectIfBusy: true
      })
      activePromptId.value = created.promptId
      connect(requestData.client_id, () => {}, (progressPromptId, progress, progressState = {}) => {
        const normalizedPercentage = Number.isFinite(progressState?.percentage)
          ? Math.round(progressState.percentage)
          : parseInt(progress, 10)
        jobStore.updateProgress({
          jobId: progressPromptId,
          percentage: normalizedPercentage,
          stage: `${failureLabel}中`,
          stageInfo: progressState?.stageInfo || `进度 ${progress}`
        })
      }, created.promptId, () => {}, {
        totalNodes: getWorkflowNodeCount(requestData)
      })
      await pollLegacyJobUntilFinished({
        promptId: created.promptId,
        outputNodeIds: [
          config.config[mode.configKey].output.img
        ].filter(Boolean),
        failureLabel
      })
    } catch (err) {
      removeToast(loadingToastId)
      jobStore.failGeneration(activePromptId.value || jobStore.currentJobId, err.message)
      resetRunState()
      error(`${failureLabel}失败：${err.message}`)
    } finally {
      // 任务结束后自动释放显存，避免持续占用
      xmAPI.freeComfyResources().catch(console.error)
    }
  }

  const handleGenerate = async (mode) => {
    if (!mode || !beginRun()) {
      return
    }
    xmAPI.mdapi('generate')
    activeModeId.value = mode.id
    syncResolvedPrompt(mode)
    if (mode.id === 'outpaint') {
      await runLegacyMode({
        mode,
        loadingMessage: '正在执行扩图...',
        title: '扩图任务',
        failureLabel: '扩图'
      })
      return
    }
    if (mode.id === 'inpaint') {
      await runLegacyMode({
        mode,
        loadingMessage: '正在执行局部重绘...',
        title: '局部重绘任务',
        failureLabel: '局部重绘'
      })
      return
    }
    await runLegacyMode({
      mode,
      loadingMessage: '正在执行图像编辑...',
      title: '图像编辑任务',
      failureLabel: '图像编辑'
    })
  }

  const handleCancel = async () => {
    const activeRunState = previewUpscaleRunState.value
    if (activeRunState === 'idle') {
      error('没有任务可取消')
      return
    }
    if (activeRunState === 'cancelling') {
      info('正在取消任务，请稍候')
      return
    }

    jobStore.setPreviewUpscaleRunState('cancelling')
    try {
      const targetId = activePromptId.value || jobStore.currentJobId
      if (targetId) {
        await jobStore.cancelJobById(targetId, '用户取消')
      }
      removeToast(loadingToastId)
      resetRunState()
      success('取消成功')
    } catch (cancelError) {
      jobStore.setPreviewUpscaleRunState(activeRunState)
      error(`取消失败：${cancelError.message}`)
    }
  }

  const handleHistoryPreviewSelect = ({ urls, item }) => {
    const list = Array.isArray(urls) ? urls : []
    const first = list[0] || ''
    setPreviewImage(first)
    xm.savesuccessimgurl(first)
    const inputUrl = item ? jobStore.getInputUrl(item) : ''
    syncOriginalImage(inputUrl || uploadedImage?.value?.preview || '')
  }

  const activeTrackedJob = computed(() => {
    const targetId = String(activePromptId.value || '')
    if (!targetId) return null
    return jobs.value.find((item) => String(item?.id || '') === targetId) || null
  })

  watch(() => activeTrackedJob.value?.status, (status) => {
    if (!status) {
      return
    }
    if (['outpaint', 'inpaint', 'image-edit'].includes(activeModeId.value)) {
      return
    }
    if (status === 'completed') {
      removeToast(loadingToastId)
      const urls = jobStore.getOutputUrls(activeTrackedJob.value)
      const primaryUrl = urls[0] || jobStore.getOutputUrl(activeTrackedJob.value) || ''
      if (primaryUrl) {
        setPreviewImage(primaryUrl)
        xm.savesuccessimgurl(primaryUrl)
      }
      syncOriginalImage(jobStore.getInputUrl(activeTrackedJob.value) || uploadedImage?.value?.preview || '')
      resetRunState()
      success('处理成功')
      return
    }
    if (status === 'failed') {
      removeToast(loadingToastId)
      resetRunState()
      error(activeTrackedJob.value?.errorMessage || '处理失败')
      return
    }
    if (status === 'cancelled') {
      removeToast(loadingToastId)
      resetRunState()
      info('任务已取消')
    }
  })

  return {
    previewimgurl,
    previewUpscaleRunState,
    setPromptValue,
    handleGenerate,
    handleCancel,
    handleHistoryPreviewSelect
  }
}
