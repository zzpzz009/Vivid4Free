const DEFAULT_STAGE_PLAN = [
  { status: 'queued', stage: '排队中', stageInfo: '等待资源', durationMs: 800, from: 0, to: 0 },
  { status: 'running', stage: '初始化', stageInfo: '加载工作流', durationMs: 600, from: 0, to: 8 },
  { status: 'running', stage: '采样中', stageInfo: '扩散迭代', durationMs: 1800, from: 8, to: 70 },
  { status: 'running', stage: '细化中', stageInfo: '增强细节', durationMs: 1200, from: 70, to: 92 },
  { status: 'running', stage: '后处理', stageInfo: '整理结果', durationMs: 800, from: 92, to: 99 }
]
 
function clampNumber(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}
 
function nowIso(now) {
  return new Date(now).toISOString()
}
 
function uid(random) {
  const r = Math.floor(random() * 1e9).toString(36)
  return `mock_${Date.now().toString(36)}_${r}`
}
 
function createEmitter() {
  const map = new Map()
  const on = (event, handler) => {
    if (!map.has(event)) map.set(event, new Set())
    map.get(event).add(handler)
    return () => off(event, handler)
  }
  const off = (event, handler) => {
    map.get(event)?.delete(handler)
  }
  const emit = (event, payload) => {
    map.get(event)?.forEach((fn) => fn(payload))
  }
  return { on, off, emit }
}
 
export function createMockGenerationEngine(options = {}) {
  const {
    random = Math.random,
    clockNow = () => Date.now()
  } = options
 
  const emitter = createEmitter()
  const jobState = new Map()
 
  const createJob = (jobInput = {}) => {
    const id = jobInput.id || uid(random)
    const createdAt = nowIso(clockNow())
    const job = {
      id,
      title: jobInput.title || `Mock Job ${id}`,
      description: jobInput.description || '',
      workflowId: jobInput.workflowId || 'mock-workflow',
      status: jobInput.status || 'pending',
      progress: clampNumber(jobInput.progress ?? 0, 0, 100),
      stage: jobInput.stage,
      stageInfo: jobInput.stageInfo,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      parameters: jobInput.parameters || { prompt: jobInput.prompt || '' },
      inputImages: jobInput.inputImages || [],
      resultImages: jobInput.resultImages || [],
      input: jobInput.input || {},
      output: jobInput.output || null,
      errorMessage: null,
      logs: []
    }
 
    jobState.set(id, { job, timers: new Set(), started: false, cancelled: false })
    emitter.emit('job:created', { job: { ...job } })
    return { ...job }
  }
 
  const getJob = (jobId) => {
    const state = jobState.get(jobId)
    return state ? { ...state.job } : null
  }
 
  const updateJob = (jobId, updates) => {
    const state = jobState.get(jobId)
    if (!state) return null
    const updatedAt = nowIso(clockNow())
    state.job = { ...state.job, ...updates, updatedAt }
    emitter.emit('job:updated', { job: { ...state.job } })
    return { ...state.job }
  }
 
  const addLog = (jobId, entry) => {
    const state = jobState.get(jobId)
    if (!state) return null
    const log = {
      id: clockNow(),
      timestamp: nowIso(clockNow()),
      level: entry?.level || 'info',
      message: entry?.message || ''
    }
    state.job.logs = Array.isArray(state.job.logs) ? [...state.job.logs, log].slice(-100) : [log]
    emitter.emit('job:log', { jobId, log })
    return log
  }
 
  const clearTimers = (state) => {
    state.timers.forEach((t) => clearTimeout(t))
    state.timers.clear()
  }
 
  const cancelJob = (jobId, reason = '用户取消') => {
    const state = jobState.get(jobId)
    if (!state) return null
    if (state.cancelled) return { ...state.job }
    state.cancelled = true
    clearTimers(state)
    addLog(jobId, { level: 'warning', message: `cancelled: ${reason}` })
    return updateJob(jobId, { status: 'cancelled', stage: '已取消', stageInfo: reason, progress: 0, completedAt: nowIso(clockNow()) })
  }
 
  const failJob = (jobId, errorMessage = '模拟失败') => {
    const state = jobState.get(jobId)
    if (!state) return null
    if (state.cancelled) return { ...state.job }
    clearTimers(state)
    addLog(jobId, { level: 'error', message: `failed: ${errorMessage}` })
    return updateJob(jobId, { status: 'failed', errorMessage, stage: '失败', stageInfo: errorMessage, progress: 0, completedAt: nowIso(clockNow()) })
  }
 
  const completeJob = (jobId, result) => {
    const state = jobState.get(jobId)
    if (!state) return null
    if (state.cancelled) return { ...state.job }
    clearTimers(state)
    const completedAt = nowIso(clockNow())
    const resultImages = Array.isArray(result?.resultImages) ? result.resultImages : state.job.resultImages
    const output = result?.output ?? state.job.output
    addLog(jobId, { level: 'success', message: 'completed' })
    return updateJob(jobId, { status: 'completed', progress: 100, stage: '已完成', stageInfo: '完成', completedAt, resultImages, output })
  }
 
  const startJob = (jobId, runOptions = {}) => {
    const state = jobState.get(jobId)
    if (!state) throw new Error(`Unknown job: ${jobId}`)
    if (state.started) return { ...state.job }
    state.started = true
 
    const {
      stagePlan = DEFAULT_STAGE_PLAN,
      tickMs = 120,
      failAtPercent,
      failMessage,
      resultImages = []
    } = runOptions
 
    updateJob(jobId, { status: 'queued', progress: 0, stage: '排队中', stageInfo: '等待资源', errorMessage: null })
 
    const plan = Array.isArray(stagePlan) && stagePlan.length > 0 ? stagePlan : DEFAULT_STAGE_PLAN
 
    let lastProgress = 0
    let elapsed = 0
 
    const scheduleStage = (index) => {
      const step = plan[index]
      if (!step) {
        const out = resultImages.length > 0 ? { imageUrl: resultImages[0], apiImageUrl: resultImages[0], resultUrls: [...resultImages] } : null
        return completeJob(jobId, { resultImages, output: out })
      }
      if (state.cancelled) return
 
      updateJob(jobId, { status: step.status, stage: step.stage, stageInfo: step.stageInfo })
 
      const durationMs = clampNumber(step.durationMs ?? 0, 0, 60000)
      const from = clampNumber(step.from ?? lastProgress, 0, 100)
      const to = clampNumber(step.to ?? from, 0, 100)
      const steps = Math.max(1, Math.floor(durationMs / Math.max(16, tickMs)))
      let i = 0
 
      const tick = () => {
        if (state.cancelled) return
        i += 1
        elapsed += tickMs
 
        const t = Math.min(1, i / steps)
        const eased = 1 - Math.pow(1 - t, 2)
        const nextProgress = Math.max(lastProgress, Math.round(from + (to - from) * eased))
        lastProgress = clampNumber(nextProgress, 0, 100)
 
        if (Number.isFinite(failAtPercent) && lastProgress >= failAtPercent) {
          return failJob(jobId, failMessage || '模拟失败（注入）')
        }
 
        updateJob(jobId, { progress: lastProgress })
 
        if (i < steps) {
          const timer = setTimeout(tick, tickMs)
          state.timers.add(timer)
          return
        }
 
        scheduleStage(index + 1)
      }
 
      const firstDelay = durationMs > 0 ? tickMs : 0
      const timer = setTimeout(tick, firstDelay)
      state.timers.add(timer)
    }
 
    const timer = setTimeout(() => scheduleStage(0), 0)
    state.timers.add(timer)
 
    addLog(jobId, { level: 'info', message: 'started' })
    return { ...state.job }
  }
 
  return {
    on: emitter.on,
    off: emitter.off,
    createJob,
    getJob,
    updateJob,
    addLog,
    startJob,
    cancelJob,
    failJob,
    completeJob
  }
}
