import { describe, it, expect, vi } from 'vitest'
import {
  isStorageSafeUrl,
  compactStorageOutput,
  compactJobForStorage,
  getStorageCandidates,
  parseJobsFromStorage
} from './storageService'

vi.mock('@/api/apiUtils.js', () => ({
  BASE_URL: 'http://localhost:3000'
}))

describe('storageService', () => {
  describe('isStorageSafeUrl', () => {
    it('returns null for data: urls', () => {
      expect(isStorageSafeUrl('data:image/png;base64,...')).toBeNull()
    })
    it('keeps compact snapshot data urls for output persistence', () => {
      const compactSnapshot = `data:image/jpeg;base64,${'a'.repeat(1024)}`
      expect(isStorageSafeUrl(compactSnapshot, { allowSnapshotDataUrl: true })).toBe(compactSnapshot)
    })
    it('returns null for temp types', () => {
      expect(isStorageSafeUrl('a.png?type=temp')).toBeNull()
    })
    it('returns trimmed string otherwise', () => {
      expect(isStorageSafeUrl('  a.png  ')).toBe('a.png')
    })
  })

  describe('compactJobForStorage', () => {
    it('compacts job correctly', () => {
      const job = {
        id: '1',
        logs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
        input: { floorplanPath: 'a.png' },
        output: { resultUrls: ['b.png'] }
      }
      const res = compactJobForStorage(job)
      expect(res.logs.length).toBe(20)
      expect(res.input.floorplanPath).toBe('a.png')
      expect(res.output.resultUrls).toEqual(['b.png'])
    })
    it('preserves compact snapshot output urls', () => {
      const compactSnapshot = `data:image/jpeg;base64,${'a'.repeat(1024)}`
      const res = compactStorageOutput({
        coverUrl: compactSnapshot,
        resultUrls: [compactSnapshot]
      })
      expect(res.coverUrl).toBe(compactSnapshot)
      expect(res.resultUrls).toEqual([compactSnapshot])
    })
  })

  describe('getStorageCandidates', () => {
    it('returns 3 levels of candidates', () => {
      const jobs = [{ id: '1' }]
      const res = getStorageCandidates(jobs)
      expect(res.length).toBe(3)
      expect(res[0][0].id).toBe('1') // full
      expect(res[1][0].id).toBe('1') // recent
      expect(res[2][0].logs).toEqual([]) // minimal
    })
  })

  describe('parseJobsFromStorage', () => {
    it('returns empty for invalid data', () => {
      expect(parseJobsFromStorage(null)).toEqual({ jobs: [], progressMap: {} })
      expect(parseJobsFromStorage('invalid json')).toEqual({ jobs: [], progressMap: {} })
    })
    it('parses and normalizes valid jobs', () => {
      const data = JSON.stringify([
        { id: '1', status: 'processing', progress: 50 },
        { id: '2', status: 'completed', output: { coverUrl: 'a.png' }, progress: 100 }
      ])
      const res = parseJobsFromStorage(data)
      expect(res.jobs.length).toBe(2)
      expect(res.jobs[0].status).toBe('running')
      expect(res.progressMap['1']).toBe(50)
      expect(res.progressMap['2']).toBe(100)
    })
    it('filters out completed jobs without output', () => {
      const data = JSON.stringify([
        { id: '1', status: 'completed' }
      ])
      const res = parseJobsFromStorage(data)
      expect(res.jobs.length).toBe(0)
    })
  })
})
