/**
 * Jobs API Module
 * 任务管理相关的 API 接口
 */

import { apiRequest, apiGet, apiPost, apiDelete } from './apiUtils.js'

const useComfyBridge = (import.meta.env.VITE_USE_COMFY_BRIDGE === 'true' || import.meta.env.VITE_USE_COMFY_BRIDGE === '1')
  && !(import.meta.env.VITE_USE_DEV_MOCK === 'true' || import.meta.env.VITE_USE_DEV_MOCK === '1')

export const jobsAPI = {
  async getHistoryById(jobId) {
    return apiRequest(`/history/${jobId}`)
  },

  createBridgeQueueJobs(queueData = {}, params = {}) {
    const status = params?.status || null
    const runningRaw = Array.isArray(queueData?.queue_running) ? queueData.queue_running : []
    const queuedRaw = Array.isArray(queueData?.queue_pending) ? queueData.queue_pending : []
    const toJob = (item, mappedStatus) => {
      const id = Array.isArray(item) ? (item[1] || item[0]) : item
      if (!id) return null
      return {
        id: String(id),
        jobId: String(id),
        status: mappedStatus,
        // Let frontend websocket progress own the real percentage instead of pinning running jobs at 10%.
        progress: 0,
        stage: mappedStatus === 'running' ? '处理中' : '排队中'
      }
    }
    const runningJobs = runningRaw.map((item) => toJob(item, 'running')).filter(Boolean)
    const queuedJobs = queuedRaw.map((item) => toJob(item, 'queued')).filter(Boolean)
    const jobs = status === 'running'
      ? runningJobs
      : status === 'queued'
        ? queuedJobs
        : [...runningJobs, ...queuedJobs]
    return {
      success: true,
      bridge: true,
      data: {
        jobs,
        total: jobs.length,
        page: 1,
        limit: Number(params?.limit || jobs.length || 50)
      }
    }
  },

  async createComfyBridgeJob(jobData) {
    const bridgePayload = jobData?.payload || {}
    const response = await apiPost('/prompt', bridgePayload)
    const promptId = response?.prompt_id || response?.data?.prompt_id || response?.data?.id
    if (!promptId) {
      throw new Error('未获取到 Comfy prompt_id')
    }
    return {
      success: true,
      data: {
        id: promptId,
        jobId: promptId,
        status: 'queued',
        stage: '排队中'
      }
    }
  },

  // Get all jobs
  async getJobs(params = {}) {
    if (useComfyBridge) {
      const queueData = await apiRequest('/queue')
      return this.createBridgeQueueJobs(queueData, params)
    }
    try {
      return await apiGet('/api/jobs', params)
    } catch (error) {
      const status = error?.response?.status
      if (status === 400 || status === 404 || status === 405 || status === 501) {
        const queueData = await apiRequest('/queue')
        return this.createBridgeQueueJobs(queueData, params)
      }
      throw error
    }
  },

  // Get job by ID
  async getJob(jobId) {
    return apiRequest(`/api/jobs/${jobId}`)
  },

  // Create generation job
  async createGenerationJob(jobData) {
    if (useComfyBridge) {
      return this.createComfyBridgeJob(jobData)
    }
    try {
      return await apiPost('/api/jobs', jobData)
    } catch (error) {
      const status = error?.response?.status
      if (status === 404 || status === 405 || status === 501) {
        return this.createComfyBridgeJob(jobData)
      }
      throw error
    }
  },

  // Get job results
  async getJobResults(jobId) {
    if (useComfyBridge) {
      return this.getHistoryById(jobId)
    }
    try {
      const result = await apiRequest(`/api/jobs/${jobId}/results`)
      if (result && typeof result === 'object' && Object.keys(result).length > 0) {
        return result
      }
    } catch (error) {
      const status = error?.response?.status ?? error?.status
      if (![400, 404, 405, 501].includes(status)) {
        throw error
      }
    }
    return this.getHistoryById(jobId)
  },

  // Get job statistics
  async getJobStats() {
    return apiRequest('/api/jobs/stats')
  },

  async getComfyQueueState() {
    const queueData = await apiRequest('/queue')
    const runningRaw = Array.isArray(queueData?.queue_running) ? queueData.queue_running : []
    const pendingRaw = Array.isArray(queueData?.queue_pending) ? queueData.queue_pending : []
    const normalizeId = (item) => {
      if (Array.isArray(item)) return String(item[1] || item[0] || '')
      return String(item || '')
    }
    const runningIds = runningRaw.map(normalizeId).filter(Boolean)
    const pendingIds = pendingRaw.map(normalizeId).filter(Boolean)
    return {
      runningIds,
      pendingIds,
      runningCount: runningIds.length,
      pendingCount: pendingIds.length,
      totalCount: runningIds.length + pendingIds.length
    }
  },

  // Cancel job
  async cancelJob(jobId) {
    if (useComfyBridge) {
      return apiPost('/interrupt', { prompt_id: jobId })
    }
    return apiPost(`/api/jobs/${jobId}/cancel`)
  },

  async interruptComfyRunningJob(jobId = null) {
    if (jobId) {
      return apiPost('/interrupt', { prompt_id: jobId })
    }
    return apiPost('/interrupt', {})
  },

  async clearComfyPendingJobs(jobIds = []) {
    if (Array.isArray(jobIds) && jobIds.length > 0) {
      return apiPost('/queue', { delete: jobIds })
    }
    return apiPost('/queue', { clear: true })
  },

  async freeComfyRuntime() {
    return apiPost('/free', { unload_models: true, free_memory: true })
  },

  // Delete job
  async deleteJob(jobId) {
    return apiDelete(`/api/jobs/${jobId}`)
  },

  // Get job logs
  async getJobLogs(jobId) {
    return apiRequest(`/api/jobs/${jobId}/logs`)
  },

  // ===== 历史记录相关方法 (从 historyAPI 合并) =====

  // Get history with pagination and filtering
  async getHistory(page = 1, limit = 20, status = null) {
    if (useComfyBridge) {
      return apiRequest(`/history?max_items=${limit}`)
    }
    const params = { page, limit }
    if (status) params.status = status
    try {
      return await apiGet('/api/history', params)
    } catch (error) {
      const statusCode = error?.response?.status ?? error?.status
      if ([400, 404, 405, 501].includes(statusCode)) {
        return apiRequest('/history')
      }
      throw error
    }
  },

  // Get recent history
  async getRecent(count = 10) {
    if (useComfyBridge) {
      return this.getHistory(1, count)
    }
    try {
      const recent = await apiGet('/api/history/recent', { limit: count })
      if (recent && typeof recent === 'object' && Object.keys(recent).length > 0) {
        return recent
      }
    } catch (error) {
      const statusCode = error?.response?.status ?? error?.status
      if (![400, 404, 405, 501].includes(statusCode)) {
        throw error
      }
    }
    return this.getHistory(1, count)
  },

  // Get completed jobs
  async getCompletedJobs(params = {}) {
    return this.getJobs({ ...params, status: 'completed' })
  },

  // Get failed jobs
  async getFailedJobs(params = {}) {
    return this.getJobs({ ...params, status: 'failed' })
  },

  // Get processing jobs
  async getProcessingJobs(params = {}) {
    return this.getJobs({ ...params, status: 'running' })
  },

  // Get queued jobs
  async getQueuedJobs(params = {}) {
    return this.getJobs({ ...params, status: 'queued' })
  }
}

export default jobsAPI
