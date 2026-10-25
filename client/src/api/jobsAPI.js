import { apiRequest, apiGet, apiPost } from './apiUtils.js'

const legacyUnavailable = () => {
  throw new Error('该旧版任务入口未在桌面客户端开放，请使用工作台预览或放大')
}

export const jobsAPI = {
  getHistoryById(jobId) { return this.getJobResults(jobId) },
  getJobs(params = {}) { return apiGet('/api/jobs', params) },
  getJob(jobId) { return apiRequest(`/api/jobs/${encodeURIComponent(jobId)}`) },
  async createGenerationJob() { return legacyUnavailable() },
  getJobResults(jobId) { return apiRequest(`/api/jobs/${encodeURIComponent(jobId)}/results`) },
  async getJobStats() { return legacyUnavailable() },

  // This read-only proxy is implemented by desktop/server.cjs.
  async getComfyQueueState() {
    const queueData = await apiRequest('/queue')
    const normalizeId = item => String(Array.isArray(item) ? item[1] || item[0] || '' : item || '')
    const runningIds = (queueData?.queue_running || []).map(normalizeId).filter(Boolean)
    const pendingIds = (queueData?.queue_pending || []).map(normalizeId).filter(Boolean)
    return { runningIds, pendingIds, runningCount: runningIds.length, pendingCount: pendingIds.length,
      totalCount: runningIds.length + pendingIds.length }
  },

  cancelJob(jobId) { return apiPost(`/api/jobs/${encodeURIComponent(jobId)}/cancel`) },
  async interruptComfyRunningJob() { return legacyUnavailable() },
  async clearComfyPendingJobs() { return legacyUnavailable() },
  async freeComfyRuntime() { return legacyUnavailable() },
  async deleteJob() { return legacyUnavailable() },
  getJobLogs(jobId) { return apiRequest(`/api/jobs/${encodeURIComponent(jobId)}/logs`) },
  getHistory(page = 1, limit = 20, status = null) { return apiGet('/api/history', { page, limit, status }) },
  getRecent(count = 10) { return apiGet('/api/history/recent', { limit: count }) },
  getCompletedJobs(params = {}) { return this.getJobs({ ...params, status: 'completed' }) },
  getFailedJobs(params = {}) { return this.getJobs({ ...params, status: 'failed' }) },
  getProcessingJobs(params = {}) { return this.getJobs({ ...params, status: 'running' }) },
  getQueuedJobs(params = {}) { return this.getJobs({ ...params, status: 'queued' }) }
}

export default jobsAPI
