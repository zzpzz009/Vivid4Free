import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useJobStore } from '@/stores/useJobStore.js'
import { useUIStore } from '@/stores/useUIStore.js'
import { useXMStore } from '@/stores/xmStore.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const useWorkspaceTaskOrchestrator = ({ uploadedImage, uploadedReferenceFile } = {}) => {
  const jobStore = useJobStore()
  const uiStore = useUIStore()
  const xm = useXMStore()
  const { previewUpscaleRunState } = storeToRefs(jobStore)
  const { selectedResultJobId, selectedResultUrl, selectedResultInputUrl } = storeToRefs(uiStore)
  const isSubmitting = ref(false)
  const selectedResultJob = computed(() => jobStore.jobs.find((job) => job.id === selectedResultJobId.value) || null)
  const previewimgurl = computed(() => {
    const outputs = selectedResultJob.value ? jobStore.getOutputUrls(selectedResultJob.value) : []
    return outputs[0] || selectedResultUrl.value || ''
  })
  const previewOriginalImage = computed(() =>
    selectedResultInputUrl.value
    || (selectedResultJob.value ? jobStore.getInputUrl(selectedResultJob.value) : '')
    || (selectedResultJobId.value || selectedResultUrl.value ? '' : uploadedImage?.value?.preview)
    || ''
  )
  let activeTaskId = null
  let submitRequestId = null
  let activeSubmissionUnknown = false
  let stopped = false

  const notify = (message, type = 'info') => jobStore.setStatusMessage(message, type)
  const imageName = (fileRef, legacyName) => fileRef?.value?.comfyImageInfo?.filename
    || fileRef?.value?.comfyImageInfo?.name
    || fileRef?.value?.filename
    || legacyName
    || ''

  const pollTask = async (taskId, jobId) => {
    let pollErrorNotified = false
    while (!stopped && activeTaskId === taskId) {
      await pause(1000)
      if (stopped || activeTaskId !== taskId) return
      try {
        const response = await fetch(`/api/desktop/tasks/${encodeURIComponent(taskId)}`, { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
        const task = payload.task
        const progress = Number(task.progress || 0)
        jobStore.updateProgress({ jobId, percentage: progress, stage: task.stage || task.status, stageInfo: task.stage || task.status })
        const localJob = jobStore.jobs.find((item) => item.id === jobId)
        if (localJob?.status !== 'submission_unknown') {
          jobStore.updateJob(jobId, { status: task.status === 'running' ? 'running' : task.status, progress, stage: task.stage || task.status, errorMessage: task.errorMessage || '' })
        }
        if (task.status === 'completed') {
          const urls = Array.isArray(task.resultImages) ? task.resultImages : []
          const primary = urls[0] || ''
          jobStore.completeGeneration({ id: jobId, resultImages: urls, output: task.output || { resultUrls: urls, coverUrl: primary } })
          uiStore.setSelectedResult({
            jobId,
            url: primary,
            inputUrl: localJob ? jobStore.getInputUrl(localJob) : ''
          })
          notify('任务已完成', 'success')
          activeTaskId = null
          submitRequestId = null
          activeSubmissionUnknown = false
          jobStore.resetPreviewUpscaleRunState()
          return
        }
        if (task.status === 'failed' || task.status === 'cancelled') {
          if (task.status === 'cancelled') {
            jobStore.updateJob(jobId, { status: 'cancelled', progress: 0, stage: '已取消', errorMessage: task.errorMessage || '' })
            jobStore.setGenerating(false)
            jobStore.setCurrentJobId(null)
            jobStore.saveJobsToStorage()
          } else {
            jobStore.failGeneration(jobId, task.errorMessage || '任务失败')
          }
          notify(task.errorMessage || (task.status === 'cancelled' ? '任务已取消' : '任务失败'), task.status === 'cancelled' ? 'warning' : 'error')
          activeTaskId = null
          submitRequestId = null
          activeSubmissionUnknown = false
          jobStore.resetPreviewUpscaleRunState()
          return
        }
        if (task.status === 'submission_unknown') {
          jobStore.updateJob(jobId, { status: 'submission_unknown', stage: '提交状态待确认', errorMessage: '提交状态待确认；请核对本地任务后再操作' })
          notify('提交状态待确认；当前任务保持待核对状态，不会自动重新提交', 'warning')
          activeSubmissionUnknown = true
          jobStore.resetPreviewUpscaleRunState()
          return
        }
      } catch (error) {
        if (!pollErrorNotified) {
          notify(`读取任务状态暂时失败，将继续查询同一任务：${error.message}`, 'warning')
          pollErrorNotified = true
        }
      }
    }
  }

  const submit = async (kind, isPreview = false) => {
    if (activeTaskId || submitRequestId) {
      notify('已有任务正在运行', 'warning')
      return
    }
    const mainImage = imageName(uploadedImage, xm.dclimg)
    const referenceImage = imageName(uploadedReferenceFile, xm.ckimg)
    if (!mainImage) return notify('请先上传待处理图片', 'warning')
    if (kind === 'render' && !referenceImage) return notify('渲染需要风格参考图', 'warning')
    const runKind = kind === 'render' ? 'preview' : 'upscale'
    if (!jobStore.tryStartPreviewUpscaleRun(runKind)) {
      return notify(jobStore.getPreviewUpscaleGuardMessage(runKind), 'warning')
    }

    const requestId = crypto.randomUUID()
    isSubmitting.value = true
    submitRequestId = requestId
    activeTaskId = 'submitting'
    const parameters = {
      kind, mainImage, ...(kind === 'render' ? { referenceImage } : {}), prompt: xm.tsc || '',
      seed: Number(xm.seed) || 0, mirror: Boolean(xm.jx), referenceStrength: Number(xm.referenceStrength),
      colorMatchStrength: Number(xm.colorMatchStrength), addScene: Boolean(xm.addScene),
      size: Number(xm.size) || 4096, denoise: Number(xm.chfd), requestId
    }
    const jobId = `desktop-${requestId}`
    stopped = false
    const createJobRecord = (id, status, stage, errorMessage = '') => jobStore.addJob({
      id, title: kind === 'render' ? '本地渲染' : '本地放大', description: xm.tsc || '',
      workflowId: kind === 'render' ? 'archviz-render' : 'archviz-upscale', status,
      progress: 0, stage, errorMessage, isPreview,
      parameters: { prompt: xm.tsc || '', ...parameters },
      inputImages: [mainImage, ...(referenceImage ? [referenceImage] : [])],
      input: { floorplanPath: `/view?filename=${encodeURIComponent(mainImage)}&type=input`, prompt: xm.tsc || '' }
    })
    try {
      const response = await fetch('/api/desktop/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parameters)
      })
      const payload = await response.json()
      if (!response.ok) {
        createJobRecord(jobId, 'failed', '提交失败', payload?.error || `HTTP ${response.status}`)
        jobStore.failGeneration(jobId, payload?.error || `HTTP ${response.status}`)
        activeTaskId = null
        submitRequestId = null
        activeSubmissionUnknown = false
        jobStore.resetPreviewUpscaleRunState()
        return
      }
      const task = payload.task
      if (!task || typeof task.id !== 'string') throw new Error('本地任务响应缺少 task id')
      const recordId = task.id || jobId
      const unknown = task.status === 'submission_unknown'
      createJobRecord(recordId, unknown ? 'submission_unknown' : (['failed', 'cancelled', 'completed', 'submitting'].includes(task.status) ? task.status : 'queued'), task.stage || (unknown ? '提交状态待确认' : '排队中'), task.errorMessage || '')
      activeTaskId = task.id || null
      submitRequestId = null
      activeSubmissionUnknown = unknown
      if (task.status === 'completed') {
        jobStore.completeGeneration({ id: recordId, resultImages: task.resultImages || [], output: task.output })
        uiStore.setSelectedResult({
          jobId: recordId,
          url: task.resultImages?.[0] || '',
          inputUrl: jobStore.getInputUrl(jobStore.jobs.find((item) => item.id === recordId))
        })
        activeTaskId = null
        activeSubmissionUnknown = false
        jobStore.resetPreviewUpscaleRunState()
      } else if (task.status === 'failed' || task.status === 'cancelled') {
        if (task.status === 'cancelled') {
          jobStore.updateJob(recordId, { status: 'cancelled', progress: 0, stage: '已取消', errorMessage: task.errorMessage || '' })
          jobStore.setGenerating(false)
          jobStore.setCurrentJobId(null)
          jobStore.saveJobsToStorage()
        } else {
          jobStore.failGeneration(recordId, task.errorMessage || '任务未能启动')
        }
        activeTaskId = null
        activeSubmissionUnknown = false
        jobStore.resetPreviewUpscaleRunState()
      } else if (task.id && !unknown) {
        jobStore.startGeneration(recordId)
        void pollTask(task.id, recordId)
      } else if (unknown) {
        notify('提交状态待确认；当前任务保持待核对状态，不会自动重新提交', 'warning')
      }
    } catch (error) {
      // The request may have reached the host before the connection failed. Reconcile by
      // requestId; never submit it again automatically.
      let found = null
      try {
        const response = await fetch('/api/desktop/tasks', { cache: 'no-store' })
        const payload = await response.json()
        found = (payload.tasks || []).find((task) => task.requestId === requestId) || null
      } catch {}
      const recordId = found?.id || jobId
      const reconciledUnknown = !found || found.status === 'submission_unknown'
      const recordStatus = reconciledUnknown ? 'submission_unknown' : (['failed', 'cancelled', 'completed'].includes(found.status) ? found.status : 'queued')
      createJobRecord(recordId, recordStatus, found?.stage || (reconciledUnknown ? '提交状态待确认' : '已对账'), reconciledUnknown ? `提交结果未知：${error.message}` : '')
      submitRequestId = null
      if (found?.id) {
        activeTaskId = found.id
        activeSubmissionUnknown = reconciledUnknown
        if (activeSubmissionUnknown) jobStore.resetPreviewUpscaleRunState()
        else if (!['failed', 'cancelled', 'completed'].includes(found.status)) jobStore.startGeneration(recordId)
        void pollTask(found.id, recordId)
      } else {
        activeTaskId = `unknown-${requestId}`
        activeSubmissionUnknown = true
        jobStore.resetPreviewUpscaleRunState()
        notify('提交状态待确认；已按 requestId 查询任务，未自动重新提交', 'warning')
      }
    } finally {
      isSubmitting.value = false
    }
  }

  const handleCancel = async () => {
    if (!activeTaskId || activeTaskId === 'submitting') return
    if (activeSubmissionUnknown || activeTaskId.startsWith('unknown-')) {
      notify('当前任务提交状态待核对，暂不能取消或重新提交', 'warning')
      return
    }
    jobStore.setPreviewUpscaleRunState('cancelling')
    try {
      const response = await fetch(`/api/desktop/tasks/${encodeURIComponent(activeTaskId)}/cancel`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
      notify('正在取消当前任务')
    } catch (error) {
      notify(`取消失败：${error.message}`, 'error')
    }
  }

  const handleHistoryPreviewSelect = (image) => {
    const item = image?.item || image
    const url = Array.isArray(image?.urls) ? image.urls[0] : (typeof image === 'string' ? image : image?.url || image?.path || '')
    if (!url) return
    uiStore.setSelectedResult({
      jobId: item?.id || '',
      url,
      inputUrl: item ? jobStore.getInputUrl(item) : ''
    })
  }

  return {
    previewimgurl, previewOriginalImage, previewUpscaleRunState, isSubmitting,
    handleUpscale: () => submit('upscale'),
    handlePreview: () => submit('render', true),
    handleCancel,
    handleHistoryPreviewSelect
  }
}
