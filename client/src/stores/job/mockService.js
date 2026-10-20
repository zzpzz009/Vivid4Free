export const createMockService = (ctx) => {
  const {
    jobs,
    updateJob,
    completeGeneration,
    failGeneration,
    clearGeneration,
    getMockEngine
  } = ctx

  const mockEngine = getMockEngine()
  const mockCancelTimers = new Map()
  let mockEngineSubscribed = false

  const clearMockCancelTimer = (jobId) => {
    const t = mockCancelTimers.get(jobId)
    if (t) clearTimeout(t)
    mockCancelTimers.delete(jobId)
  }

  const scheduleMockCancel = (jobId, delayMs, reason) => {
    clearMockCancelTimer(jobId)
    const ms = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : 0
    const timer = setTimeout(() => {
      mockEngine.cancelJob(jobId, reason || '模拟取消')
    }, ms)
    mockCancelTimers.set(jobId, timer)
  }

  const ensureMockEngineSubscribed = () => {
    if (mockEngineSubscribed) return
    mockEngineSubscribed = true
    mockEngine.on('job:updated', ({ job: updated }) => {
      const existing = jobs.find((j) => j.id === updated?.id)
      if (!existing || existing.origin !== 'mock') return
      
      updateJob(updated.id, {
        status: updated.status,
        progress: updated.progress,
        stage: updated.stage,
        stageInfo: updated.stageInfo,
        errorMessage: updated.errorMessage,
        completedAt: updated.completedAt,
        output: updated.output,
        resultImages: updated.resultImages
      })

      if (updated.status === 'completed') {
        clearMockCancelTimer(updated.id)
        if (typeof completeGeneration === 'function') {
          completeGeneration({ id: updated.id, resultImages: updated.resultImages })
        }
      }
      
      if (updated.status === 'failed') {
        clearMockCancelTimer(updated.id)
        if (typeof failGeneration === 'function') {
          failGeneration(updated.id, updated.errorMessage || '模拟失败')
        }
      }
      
      if (updated.status === 'cancelled') {
        clearMockCancelTimer(updated.id)
        if (typeof clearGeneration === 'function') {
          clearGeneration()
        }
      }
    })
  }

  const buildMockGenerationStagePlan = (totalMs) => {
    const ms = Number.isFinite(Number(totalMs)) ? Math.max(0, Number(totalMs)) : 0
    const queuedMs = Math.min(1200, Math.max(300, Math.floor(ms * 0.06)))
    const runningMs = Math.max(0, ms - queuedMs)
    return [
      { status: 'queued', stage: '排队中', stageInfo: '等待资源', durationMs: queuedMs, from: 0, to: 0 },
      { status: 'running', stage: '生成中', stageInfo: '扩散迭代', durationMs: runningMs, from: 0, to: 99 }
    ]
  }

  return {
    mockEngine,
    ensureMockEngineSubscribed,
    scheduleMockCancel,
    clearMockCancelTimer,
    buildMockGenerationStagePlan
  }
}
