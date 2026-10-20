import { describe, it, expect } from 'vitest'
import { normalizeJobStatus, getStageInfo, normalizeProgressValue } from './statusNormalize'

describe('statusNormalize', () => {
  describe('normalizeJobStatus', () => {
    it('returns queued for falsy values', () => {
      expect(normalizeJobStatus(null)).toBe('queued')
      expect(normalizeJobStatus(undefined)).toBe('queued')
      expect(normalizeJobStatus('')).toBe('queued')
    })
    it('maps backend running aliases to running', () => {
      expect(normalizeJobStatus('processing')).toBe('running')
      expect(normalizeJobStatus('in_progress')).toBe('running')
    })
    it('maps backend success alias to completed', () => {
      expect(normalizeJobStatus('success')).toBe('completed')
    })
    it('returns original status otherwise', () => {
      expect(normalizeJobStatus('completed')).toBe('completed')
      expect(normalizeJobStatus('failed')).toBe('failed')
    })
  })

  describe('getStageInfo', () => {
    it('returns empty string if no job', () => {
      expect(getStageInfo(null)).toBe('')
    })
    it('returns mapped status info', () => {
      expect(getStageInfo({ status: 'pending' })).toBe('正在准备任务...')
      expect(getStageInfo({ status: 'queued' })).toBe('任务已加入队列...')
      expect(getStageInfo({ status: 'completed' })).toBe('生成完成！')
      expect(getStageInfo({ status: 'failed', errorMessage: 'OOM' })).toBe('OOM')
      expect(getStageInfo({ status: 'failed' })).toBe('任务失败')
    })
    it('returns stage for running', () => {
      expect(getStageInfo({ status: 'running', stage: '扩散中' })).toBe('扩散中')
      expect(getStageInfo({ status: 'processing' })).toBe('正在处理...')
    })
    it('returns progress fallback for unknown status', () => {
      expect(getStageInfo({ status: 'unknown', progress: 50 })).toBe('进度: 50%')
    })
  })

  describe('normalizeProgressValue', () => {
    it('handles normal numbers', () => {
      expect(normalizeProgressValue(50)).toBe(50)
    })
    it('clamps values between 0 and 100', () => {
      expect(normalizeProgressValue(-10)).toBe(0)
      expect(normalizeProgressValue(150)).toBe(100)
    })
    it('rounds values', () => {
      expect(normalizeProgressValue(50.6)).toBe(51)
    })
    it('handles non-numbers with fallback', () => {
      expect(normalizeProgressValue(NaN)).toBe(0)
      expect(normalizeProgressValue(undefined, 10)).toBe(10)
    })
  })
})
