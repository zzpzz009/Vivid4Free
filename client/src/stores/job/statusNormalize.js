export const normalizeJobStatus = (status) => {
  if (!status) return 'queued'
  if (status === 'in_progress') return 'running'
  if (status === 'processing') return 'running'
  if (status === 'success') return 'completed'
  return status
}

export const getStageInfo = (job) => {
  if (!job) return ''
  const normalizedStatus = normalizeJobStatus(job.status)

  const statusMap = {
    'pending': '正在准备任务...',
    'queued': '任务已加入队列...',
    'running': job.stage || '正在处理...',
    'completed': '生成完成！',
    'failed': job.errorMessage || '任务失败'
  }

  return statusMap[normalizedStatus] || `进度: ${job.progress || 0}%`
}

export const normalizeProgressValue = (value, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(100, Math.max(0, Math.round(numeric)))
}
