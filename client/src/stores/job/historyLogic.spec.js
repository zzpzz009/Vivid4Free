import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createHistoryLogic } from './historyLogic.js'

describe('historyLogic', () => {
  let api
  let historyArchiveItems
  let historyDegraded
  let historyItems
  let upsertHistoryRecord
  let patchProgressById
  let queuePositionMap
  let scheduleQueuePositionCommit

  beforeEach(() => {
    api = {
      jobs: {
        getJobResults: vi.fn()
      }
    }
    historyArchiveItems = ref([])
    historyDegraded = ref(false)
    historyItems = ref([])
    upsertHistoryRecord = vi.fn()
    patchProgressById = vi.fn()
    queuePositionMap = ref({ prompt1: 1 })
    scheduleQueuePositionCommit = vi.fn()
  })

  it('hydrates exact history ids and backfills completed records', async () => {
    api.jobs.getJobResults.mockResolvedValue({
      prompt1: {
        outputs: {
          '36': {
            images: [
              { filename: 'result.png', subfolder: '第一阶段', type: 'output' }
            ]
          }
        },
        status: {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { timestamp: 1704067200000 }],
            ['execution_success', { timestamp: 1704067260000 }]
          ]
        }
      }
    })

    const logic = createHistoryLogic({
      api,
      historyArchiveItems,
      historyDegraded,
      historyItems,
      normalizeJobsHistoryPayload: (_payload) => [{
        id: 'prompt1',
        status: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:01:00.000Z',
        output: {
          coverUrl: 'http://localhost/result.png',
          resultUrls: ['http://localhost/result.png']
        }
      }],
      normalizeLegacyHistoryPayload: () => [],
      mergeHistoryItems: (sources = []) => {
        const seen = new Map()
        sources.flat().filter(Boolean).forEach((item) => {
          seen.set(item.id, item)
        })
        return Array.from(seen.values())
      },
      upsertHistoryRecord,
      patchProgressById,
      queuePositionMap,
      scheduleQueuePositionCommit
    })

    const result = await logic.hydrateHistoryByIds(['prompt1'])

    expect(api.jobs.getJobResults).toHaveBeenCalledWith('prompt1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('prompt1')
    expect(upsertHistoryRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'prompt1', status: 'completed' }))
    expect(patchProgressById).toHaveBeenCalledWith('prompt1', 100, '已完成', '任务已完成', { force: true })
    expect(scheduleQueuePositionCommit).toHaveBeenCalledWith({})
    expect(historyArchiveItems.value).toEqual([
      expect.objectContaining({ id: 'prompt1', status: 'completed' })
    ])
  })
})
