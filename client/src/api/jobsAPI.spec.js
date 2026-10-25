import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./apiUtils.js', () => ({ apiRequest: vi.fn(), apiGet: vi.fn(), apiPost: vi.fn() }))
import { jobsAPI } from './jobsAPI.js'
import { apiRequest, apiGet, apiPost } from './apiUtils.js'

describe('desktop jobs API boundary', () => {
  beforeEach(() => vi.resetAllMocks())

  it('keeps a missing local job as an error without querying raw engine history', async () => {
    apiRequest.mockRejectedValueOnce({ status: 404 })
    await expect(jobsAPI.getJobResults('missing')).rejects.toMatchObject({ status: 404 })
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/api/jobs/missing/results')
  })

  it('does not replace local history errors or empty history with engine history', async () => {
    apiGet.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({})
    await expect(jobsAPI.getHistory(1, 5)).rejects.toMatchObject({ status: 404 })
    expect(await jobsAPI.getRecent(3)).toEqual({})
    expect(apiRequest).not.toHaveBeenCalled()
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  it('rejects legacy writes locally and preserves the implemented read-only queue proxy', async () => {
    await expect(jobsAPI.createGenerationJob({ payload: {} })).rejects.toThrow('旧版任务入口')
    await expect(jobsAPI.clearComfyPendingJobs()).rejects.toThrow('旧版任务入口')
    await expect(jobsAPI.interruptComfyRunningJob()).rejects.toThrow('旧版任务入口')
    expect(apiPost).not.toHaveBeenCalled()
    apiRequest.mockResolvedValueOnce({ queue_running: [[1, 'running']], queue_pending: [[2, 'queued']] })
    expect(await jobsAPI.getComfyQueueState()).toMatchObject({ runningIds: ['running'], pendingIds: ['queued'], totalCount: 2 })
    expect(apiRequest).toHaveBeenCalledWith('/queue')
  })
})
