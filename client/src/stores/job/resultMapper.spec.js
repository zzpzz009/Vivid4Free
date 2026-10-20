import { describe, it, expect, vi } from 'vitest'
import {
  toTimestampMs,
  normalizeHistoryUrl,
  normalizeHistoryItem,
  normalizePendingHistoryItem,
  normalizeJobsHistoryPayload,
  mergeHistoryItems
} from './resultMapper'

vi.mock('@/api/apiUtils.js', () => ({
  BASE_URL: 'http://localhost:3000'
}))

import { BASE_URL } from '@/api/apiUtils.js'

vi.mock('@/utils/utils.js', () => ({
  objgetimgurl: (obj) => `mocked-url-${obj.filename}`
}))

describe('resultMapper', () => {
  describe('toTimestampMs', () => {
    it('returns 0 for falsy', () => {
      expect(toTimestampMs(null)).toBe(0)
    })
    it('returns number as is', () => {
      expect(toTimestampMs(123456)).toBe(123456)
    })
    it('parses valid date string', () => {
      const dateStr = '2023-01-01T00:00:00Z'
      expect(toTimestampMs(dateStr)).toBe(Date.parse(dateStr))
    })
  })

  describe('normalizeHistoryUrl', () => {
    it('returns null for empty', () => {
      expect(normalizeHistoryUrl('')).toBeNull()
    })
    it('returns null for temp types', () => {
      expect(normalizeHistoryUrl('a.png?type=temp')).toBeNull()
      expect(normalizeHistoryUrl({ filename: 'a', type: 'temp' })).toBeNull()
    })
    it('normalizes string paths', () => {
      expect(normalizeHistoryUrl('a.png')).toBe(`${BASE_URL}/api/files/a.png`)
      expect(normalizeHistoryUrl('http://a.png')).toBe('http://a.png')
    })
    it('rewrites nested api/files paths', () => {
      expect(normalizeHistoryUrl('/api/files/第一阶段/a.png')).toBe('mocked-url-a.png')
      expect(normalizeHistoryUrl('http://localhost:3000/api/files/第一阶段/a.png')).toBe('mocked-url-a.png')
    })
  })

  describe('normalizeHistoryItem', () => {
    it('returns null for invalid item', () => {
      expect(normalizeHistoryItem(null)).toBeNull()
    })
    it('normalizes basic fields', () => {
      const item = {
        id: '123',
        status: 'completed',
        createdAt: '2023-01-01T00:00:00Z',
        output: { resultUrls: ['a.png'] }
      }
      const res = normalizeHistoryItem(item)
      expect(res.id).toBe('123')
      expect(res.status).toBe('completed')
      expect(res.output.resultUrls).toEqual([`${BASE_URL}/api/files/a.png`])
      expect(res.origin).toBe('job')
    })
    it('normalizes broken nested cover urls from cache', () => {
      const item = {
        id: 'nested-cover',
        status: 'completed',
        createdAt: '2023-01-01T00:00:00Z',
        output: {
          coverUrl: '/api/files/第一阶段/result.png',
          resultUrls: ['/api/files/第一阶段/result.png']
        }
      }
      const res = normalizeHistoryItem(item)
      expect(res.output.coverUrl).toBe('mocked-url-result.png')
      expect(res.output.resultUrls).toEqual(['mocked-url-result.png'])
    })
    it('drops temp-only preview outputs from history items', () => {
      const item = {
        id: 'preview-1',
        status: 'completed',
        isPreview: true,
        createdAt: '2023-01-01T00:00:00Z',
        output: {
          resultUrls: ['http://localhost:3000/view?filename=ComfyUI_temp_demo.png&type=temp']
        }
      }
      const res = normalizeHistoryItem(item)
      expect(res).toBeNull()
    })
    it('drops snapshot data urls from history items', () => {
      const item = {
        id: 'preview-snapshot',
        status: 'completed',
        createdAt: '2023-01-01T00:00:00Z',
        output: {
          coverUrl: 'data:image/jpeg;base64,preview',
          resultUrls: ['data:image/jpeg;base64,preview']
        }
      }
      const res = normalizeHistoryItem(item)
      expect(res).toBeNull()
    })
  })

  describe('normalizePendingHistoryItem', () => {
    it('keeps preview temp jobs as archiving placeholders', () => {
      const item = {
        id: 'preview-temp',
        status: 'completed',
        isPreview: true,
        createdAt: '2023-01-01T00:00:00Z',
        output: {
          coverUrl: 'data:image/jpeg;base64,preview',
          resultUrls: ['http://localhost:3000/view?filename=ComfyUI_temp_demo.png&type=temp']
        }
      }

      const res = normalizePendingHistoryItem(item)

      expect(res).toMatchObject({
        id: 'preview-temp',
        status: 'archiving',
        pendingHistoryOutput: true
      })
      expect(res.output.coverUrl).toBeNull()
      expect(res.output.resultUrls).toEqual([])
    })

    it('keeps single edit temp jobs as archiving placeholders', () => {
      const item = {
        id: 'single-edit-temp',
        status: 'completed',
        workflowId: 'outpaint',
        allowTempOutput: true,
        createdAt: '2023-01-01T00:00:00Z',
        output: {
          coverUrl: 'data:image/jpeg;base64,preview',
          resultUrls: ['http://localhost:3000/view?filename=ComfyUI_temp_demo.png&type=temp']
        }
      }

      const res = normalizePendingHistoryItem(item)

      expect(res).toMatchObject({
        id: 'single-edit-temp',
        status: 'archiving',
        pendingHistoryOutput: true
      })
      expect(res.output.coverUrl).toBeNull()
      expect(res.output.resultUrls).toEqual([])
    })
  })

  describe('normalizeJobsHistoryPayload', () => {
    it('maps raw ComfyUI history dictionaries to completed history cards', () => {
      const payload = {
        'prompt-1': {
          prompt: [
            1,
            'prompt-1',
            {
              '10': {
                class_type: 'LoadImage',
                inputs: { image: 'floorplan.png' }
              },
              '11': {
                class_type: 'LoadImage',
                inputs: { image: 'style.png' }
              }
            }
          ],
          outputs: {
            '100': {
              images: [
                { filename: 'ComfyUI_temp_demo.png', subfolder: '', type: 'temp' },
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
      }

      const result = normalizeJobsHistoryPayload(payload)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'prompt-1',
        status: 'completed',
        origin: 'comfy-history',
        input: {
          floorplanPath: 'mocked-url-floorplan.png',
          stylePath: 'mocked-url-style.png',
          floorplanImage: {
            filename: 'floorplan.png',
            subfolder: '',
            type: 'input'
          },
          styleImage: {
            filename: 'style.png',
            subfolder: '',
            type: 'input'
          }
        },
        output: {
          resultUrls: [`${BASE_URL}/api/files/mocked-url-result.png`],
          coverUrl: `${BASE_URL}/api/files/mocked-url-result.png`
        }
      })
      expect(result[0].completedAt).toBe('2024-01-01T00:01:00.000Z')
    })
    it('prefers configured history output node over unrelated node outputs', () => {
      const payload = {
        'prompt-preview': {
          outputs: {
            '111': {
              images: [
                { filename: 'wrong-result.png', subfolder: '其他节点', type: 'output' }
              ]
            },
            '36': {
              images: [
                { filename: 'preview-temp.png', type: 'temp' },
                { filename: 'preview-final.png', subfolder: '第一阶段', type: 'output' }
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
      }

      const result = normalizeJobsHistoryPayload(payload)

      expect(result).toHaveLength(1)
      expect(result[0].output.coverUrl).toBe(`${BASE_URL}/api/files/mocked-url-preview-final.png`)
      expect(result[0].output.resultUrls).toEqual([`${BASE_URL}/api/files/mocked-url-preview-final.png`])
    })
    it('prefers the SaveImage node in the actual local workflow graph', () => {
      const payload = {
        'prompt-local-upscale': {
          prompt: [0, 'prompt-local-upscale', {
            '88': { class_type: 'PreviewImage', inputs: {} },
            '287': { class_type: 'SaveImage', inputs: { images: ['88', 0] } }
          }],
          outputs: {
            '346': { images: [{ filename: 'unrelated.png', type: 'output' }] },
            '287': { images: [{ filename: 'local-upscale-final.png', type: 'output' }] }
          },
          status: { status_str: 'success', completed: true }
        }
      }

      const result = normalizeJobsHistoryPayload(payload)

      expect(result).toHaveLength(1)
      expect(result[0].output.resultUrls).toEqual([
        `${BASE_URL}/api/files/mocked-url-local-upscale-final.png`
      ])
    })
    it('skips raw history records that only contain temp preview images', () => {
      const payload = {
        'prompt-temp': {
          outputs: {
            '100': {
              images: [
                { filename: 'ComfyUI_temp_demo.png', subfolder: '', type: 'temp' }
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
      }

      const result = normalizeJobsHistoryPayload(payload)

      expect(result).toEqual([])
    })
  })

  describe('mergeHistoryItems', () => {
    it('merges and sorts sources', () => {
      const source1 = [
        { id: '1', createdAt: '2023-01-01T00:00:00Z', output: { resultUrls: ['a.png'] } }
      ]
      const source2 = [
        { id: '1', createdAt: '2023-01-01T00:00:00Z', output: { resultUrls: ['a.png'] } }, // duplicate
        { id: '2', createdAt: '2023-01-02T00:00:00Z', output: { resultUrls: ['b.png'] } }
      ]
      const res = mergeHistoryItems([source1, source2])
      expect(res.length).toBe(2)
      expect(res[0].id).toBe('2') // Newer first
      expect(res[1].id).toBe('1')
    })
  })
})
