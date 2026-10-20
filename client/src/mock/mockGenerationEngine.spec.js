import { describe, expect, it, vi } from 'vitest'
import { createMockGenerationEngine } from './mockGenerationEngine.js'

describe('mockGenerationEngine', () => {
  it('runs queued -> running -> completed with monotonic progress', () => {
    vi.useFakeTimers()
    const engine = createMockGenerationEngine({ clockNow: () => 1700000000000 })
    const events = []
    engine.on('job:updated', ({ job }) => events.push({ status: job.status, progress: job.progress }))

    const job = engine.createJob({ prompt: 'test' })
    engine.startJob(job.id, { tickMs: 50, stagePlan: [{ status: 'queued', stage: '排队中', stageInfo: '', durationMs: 100, from: 0, to: 0 }, { status: 'running', stage: '采样中', stageInfo: '', durationMs: 200, from: 0, to: 99 }], resultImages: ['/mock/result.png'] })

    vi.runAllTimers()

    const finalJob = engine.getJob(job.id)
    expect(finalJob.status).toBe('completed')
    expect(finalJob.progress).toBe(100)
    expect(finalJob.resultImages).toEqual(['/mock/result.png'])

    let last = -1
    for (const e of events) {
      expect(e.progress).toBeGreaterThanOrEqual(last)
      last = e.progress
    }

    vi.useRealTimers()
  })

  it('can be cancelled and stops progressing', () => {
    vi.useFakeTimers()
    const engine = createMockGenerationEngine({ clockNow: () => 1700000000000 })
    const job = engine.createJob({ prompt: 'test' })
    engine.startJob(job.id, { tickMs: 50 })
    vi.advanceTimersByTime(200)
    engine.cancelJob(job.id, 'cancel')
    const snap = engine.getJob(job.id)
    expect(snap.status).toBe('cancelled')

    vi.runAllTimers()
    const after = engine.getJob(job.id)
    expect(after.status).toBe('cancelled')
    vi.useRealTimers()
  })
})
