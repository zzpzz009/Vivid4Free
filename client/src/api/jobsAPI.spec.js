import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./apiUtils.js', () => ({
  apiRequest: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}))

import { jobsAPI } from './jobsAPI.js'
import { apiRequest, apiGet } from './apiUtils.js'

describe('jobsAPI fallback behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to /history/:id when /api/jobs/:id/results is unavailable', async () => {
    apiRequest
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({
        'prompt-1': {
          outputs: {}
        }
      })

    const result = await jobsAPI.getJobResults('prompt-1')

    expect(result).toEqual({
      'prompt-1': {
        outputs: {}
      }
    })
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/jobs/prompt-1/results')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/history/prompt-1')
  })

  it('falls back to raw /history when /api/history is unavailable', async () => {
    apiGet.mockRejectedValueOnce({ status: 404 })
    apiRequest.mockResolvedValueOnce({
      'prompt-history-1': {
        outputs: {}
      }
    })

    const result = await jobsAPI.getHistory(1, 5)

    expect(result).toEqual({
      'prompt-history-1': {
        outputs: {}
      }
    })
    expect(apiGet).toHaveBeenCalledWith('/api/history', { page: 1, limit: 5 })
    expect(apiRequest).toHaveBeenCalledWith('/history')
  })

  it('falls back to full history when recent history endpoint is empty', async () => {
    apiGet
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        'prompt-2': {
          outputs: {}
        }
      })

    const result = await jobsAPI.getRecent(3)

    expect(result).toEqual({
      'prompt-2': {
        outputs: {}
      }
    })
    expect(apiGet).toHaveBeenNthCalledWith(1, '/api/history/recent', { limit: 3 })
    expect(apiGet).toHaveBeenNthCalledWith(2, '/api/history', { page: 1, limit: 3 })
  })
})
