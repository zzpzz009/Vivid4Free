import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createQueueLogic } from './queueLogic.js'

describe('queueLogic', () => {
  it('does not overlap slow queue reads or apply them after live sync stops', async () => {
    let finish
    const pending = new Promise(resolve => { finish = resolve })
    const getQueuedJobs = vi.fn(() => pending)
    const getProcessingJobs = vi.fn(() => pending)
    const liveSyncEnabled = ref(true)
    const updateJob = vi.fn()
    const scheduleQueuePositionCommit = vi.fn()
    const logic = createQueueLogic({ api: { jobs: { getQueuedJobs, getProcessingJobs } }, jobs: [],
      liveSyncEnabled, comfyWsConnected: ref(false), historySyncHint: ref(''), queuePositionMap: ref({}),
      scheduleQueuePositionCommit, normalizeJobStatus: status => status, updateJob, addJob: vi.fn(),
      pullRecentHistory: vi.fn(), hasActiveQueueJobs: () => false, hydrateHistoryByIds: vi.fn() })
    const first = logic.runQueueSyncTick()
    await logic.runQueueSyncTick()
    expect(getQueuedJobs).toHaveBeenCalledTimes(1)
    expect(getProcessingJobs).toHaveBeenCalledTimes(1)
    liveSyncEnabled.value = false
    finish({ data: { jobs: [] } })
    await first
    expect(scheduleQueuePositionCommit).not.toHaveBeenCalled()
    expect(updateJob).not.toHaveBeenCalled()
  })
  it('backfills completed history before marking lost queue jobs as failed', async () => {
    const jobs = [
      {
        id: 'prompt1',
        status: 'queued'
      }
    ]
    const updateJob = vi.fn((id, patch) => {
      const target = jobs.find((item) => item.id === id)
      if (target) Object.assign(target, patch)
    })
    const hydrateHistoryByIds = vi.fn(async () => {
      jobs[0].status = 'completed'
      return [
        {
          id: 'prompt1',
          status: 'completed'
        }
      ]
    })
    const pullRecentHistory = vi.fn(async () => ({ success: true, count: 1 }))

    const logic = createQueueLogic({
      api: {
        jobs: {
          getQueuedJobs: vi.fn(async () => ({ data: { jobs: [] } })),
          getProcessingJobs: vi.fn(async () => ({ data: { jobs: [] } }))
        }
      },
      jobs,
      liveSyncEnabled: ref(true),
      comfyWsConnected: ref(false),
      historySyncHint: ref(''),
      queuePositionMap: ref({}),
      scheduleQueuePositionCommit: vi.fn(),
      normalizeJobStatus: (status) => status,
      updateJob,
      addJob: vi.fn(),
      pullRecentHistory,
      hydrateHistoryByIds,
      hasActiveQueueJobs: () => jobs.some((item) => ['queued', 'running', 'processing'].includes(item.status)),
      initHistory: vi.fn()
    })

    await logic.runQueueSyncTick()

    expect(hydrateHistoryByIds).toHaveBeenCalledWith(['prompt1'])
    expect(updateJob).not.toHaveBeenCalledWith('prompt1', expect.objectContaining({ status: 'failed' }))
    expect(pullRecentHistory).toHaveBeenCalledWith(3)
    expect(jobs[0].status).toBe('completed')
  })
})
