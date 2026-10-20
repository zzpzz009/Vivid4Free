import { describe, it, expect, vi } from 'vitest'
import {
  normalizeImageInfo,
  normalizeImageUrlString,
  buildOutputFromResultImages,
  getOutputUrl,
  getOutputUrls,
  getInputUrl,
  getReferenceUrl
} from './urlNormalize'

vi.mock('@/api/apiUtils.js', () => ({
  BASE_URL: 'http://localhost:3000'
}))

import { BASE_URL } from '@/api/apiUtils.js'

vi.mock('@/utils/utils.js', () => ({
  objgetimgurl: (obj) => `mocked-url-${obj.filename}`
}))

describe('urlNormalize', () => {
  describe('normalizeImageInfo', () => {
    it('returns null for invalid inputs', () => {
      expect(normalizeImageInfo(null)).toBeNull()
      expect(normalizeImageInfo('string')).toBeNull()
      expect(normalizeImageInfo({})).toBeNull()
    })
    it('normalizes object with filename', () => {
      expect(normalizeImageInfo({ filename: 'test.png', subfolder: 'sub' })).toEqual({
        filename: 'test.png',
        subfolder: 'sub',
        type: 'output'
      })
    })
    it('normalizes object with name', () => {
      expect(normalizeImageInfo({ name: 'test.png' }, 'input')).toEqual({
        filename: 'test.png',
        subfolder: '',
        type: 'input'
      })
    })
    it('splits nested filename into subfolder', () => {
      expect(normalizeImageInfo({ filename: '第一阶段/test.png' })).toEqual({
        filename: 'test.png',
        subfolder: '第一阶段',
        type: 'output'
      })
    })
  })

  describe('normalizeImageUrlString', () => {
    it('rewrites nested file paths to view urls', () => {
      expect(normalizeImageUrlString('第一阶段/a.png')).toBe('mocked-url-a.png')
    })
    it('rewrites input filenames to comfy view urls', () => {
      expect(normalizeImageUrlString('floorplan.png', 'input')).toBe('mocked-url-floorplan.png')
    })
    it('rewrites nested /api/files urls to view urls', () => {
      expect(normalizeImageUrlString('/api/files/第一阶段/a.png')).toBe('mocked-url-a.png')
      expect(normalizeImageUrlString('http://localhost:3000/api/files/第一阶段/a.png')).toBe('mocked-url-a.png')
    })
    it('rewrites absolute /view urls to current comfy view urls', () => {
      expect(normalizeImageUrlString('http://127.0.0.1:8188/view?filename=floorplan.png&type=input', 'input')).toBe('mocked-url-floorplan.png')
    })
  })

  describe('buildOutputFromResultImages', () => {
    it('returns null for empty array', () => {
      expect(buildOutputFromResultImages([])).toBeNull()
    })
    it('handles array of strings', () => {
      const res = buildOutputFromResultImages(['a.png', 'b.png'])
      expect(res.imageUrl).toBe(`${BASE_URL}/api/files/a.png`)
      expect(res.resultUrls).toEqual([`${BASE_URL}/api/files/a.png`, `${BASE_URL}/api/files/b.png`])
    })
    it('handles absolute urls in strings', () => {
      const res = buildOutputFromResultImages(['http://test.com/a.png'])
      expect(res.imageUrl).toBe('http://test.com/a.png')
    })
    it('handles nested subfolder strings', () => {
      const res = buildOutputFromResultImages(['第一阶段/a.png'])
      expect(res.imageUrl).toBe('mocked-url-a.png')
      expect(res.resultUrls).toEqual(['mocked-url-a.png'])
    })
    it('handles array of objects', () => {
      const res = buildOutputFromResultImages([{ filename: 'a.png' }])
      expect(res.imageUrl).toBe('mocked-url-a.png')
      expect(res.resultUrls).toEqual(['mocked-url-a.png'])
    })
  })

  describe('getOutputUrl', () => {
    it('returns null for no job', () => {
      expect(getOutputUrl(null)).toBeNull()
    })
    it('prefers output.coverUrl', () => {
      expect(getOutputUrl({ output: { coverUrl: 'cover.png' } })).toBe(`${BASE_URL}/api/files/cover.png`)
    })
    it('falls back to output.resultUrls[0]', () => {
      expect(getOutputUrl({ output: { resultUrls: ['res1.png'] } })).toBe(`${BASE_URL}/api/files/res1.png`)
    })
    it('falls back to resultImages', () => {
      expect(getOutputUrl({ status: 'completed', resultImages: ['a.png'] })).toBe(`${BASE_URL}/api/files/a.png`)
      expect(getOutputUrl({ status: 'completed', resultImages: [{ filename: 'a.png' }] })).toBe('mocked-url-a.png')
    })
    it('normalizes broken nested api/files cover urls', () => {
      expect(getOutputUrl({ output: { coverUrl: '/api/files/第一阶段/a.png' } })).toBe('mocked-url-a.png')
    })
    it('falls back to old structures', () => {
      expect(getOutputUrl({ url: 'old.png' })).toBe(`${BASE_URL}/api/files/old.png`)
    })
  })

  describe('getOutputUrls', () => {
    it('returns array from output.resultUrls', () => {
      expect(getOutputUrls({ output: { resultUrls: ['a', 'b'] } })).toEqual([
        `${BASE_URL}/api/files/a`,
        `${BASE_URL}/api/files/b`
      ])
    })
    it('returns array from coverUrl', () => {
      expect(getOutputUrls({ output: { coverUrl: 'a' } })).toEqual([`${BASE_URL}/api/files/a`])
    })
    it('returns array from resultImages', () => {
      expect(getOutputUrls({ resultImages: ['a'] })).toEqual([`${BASE_URL}/api/files/a`])
    })
    it('normalizes nested api/files arrays', () => {
      expect(getOutputUrls({ output: { resultUrls: ['/api/files/第一阶段/a.png'] } })).toEqual(['mocked-url-a.png'])
    })
  })

  describe('getInputUrl', () => {
    it('prefers input.floorplanImage', () => {
      expect(getInputUrl({
        input: {
          floorplanImage: {
            filename: 'floorplan.png',
            subfolder: '',
            type: 'input'
          }
        }
      })).toBe('mocked-url-floorplan.png')
    })
    it('prefers input.floorplanPath', () => {
      expect(getInputUrl({ input: { floorplanPath: 'a.png' } })).toBe('mocked-url-a.png')
    })
    it('falls back to inputImages', () => {
      expect(getInputUrl({ inputImages: ['a.png'] })).toBe('mocked-url-a.png')
    })
  })

  describe('getReferenceUrl', () => {
    it('prefers input.styleImage', () => {
      expect(getReferenceUrl({
        input: {
          styleImage: {
            filename: 'style.png',
            subfolder: '',
            type: 'input'
          }
        }
      })).toBe('mocked-url-style.png')
    })
    it('prefers input.stylePath', () => {
      expect(getReferenceUrl({ input: { stylePath: 'a.png' } })).toBe('mocked-url-a.png')
    })
    it('falls back to second inputImages', () => {
      expect(getReferenceUrl({ inputImages: ['a.png', 'b.png'] })).toBe('mocked-url-b.png')
    })
  })
})
