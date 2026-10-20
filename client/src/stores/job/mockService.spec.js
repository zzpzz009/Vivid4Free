import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockService } from './mockService.js'

describe('mockService', () => {
  let mockEngine
  let jobs
  let updateJobMock
  let completeGenerationMock
  let failGenerationMock
  let clearGenerationMock
  
  beforeEach(() => {
    jobs = []
    updateJobMock = vi.fn()
    completeGenerationMock = vi.fn()
    failGenerationMock = vi.fn()
    clearGenerationMock = vi.fn()
    
    mockEngine = {
      createJob: vi.fn((params) => ({ id: 'mock-123', ...params, createdAt: new Date().toISOString() })),
      startJob: vi.fn(),
      cancelJob: vi.fn(),
      on: vi.fn()
    }
  })

  it('subscribes to engine events only once', () => {
    const service = createMockService({
      jobs,
      updateJob: updateJobMock,
      completeGeneration: completeGenerationMock,
      failGeneration: failGenerationMock,
      clearGeneration: clearGenerationMock,
      getMockEngine: () => mockEngine
    })

    service.ensureMockEngineSubscribed()
    service.ensureMockEngineSubscribed()

    expect(mockEngine.on).toHaveBeenCalledTimes(1)
    expect(mockEngine.on).toHaveBeenCalledWith('job:updated', expect.any(Function))
  })

  it('builds mock generation stage plan based on time', () => {
    const service = createMockService({
      jobs,
      updateJob: updateJobMock,
      completeGeneration: completeGenerationMock,
      failGeneration: failGenerationMock,
      clearGeneration: clearGenerationMock,
      getMockEngine: () => mockEngine
    })

    const plan = service.buildMockGenerationStagePlan(10000)
    expect(plan.length).toBe(2)
    expect(plan[0].status).toBe('queued')
    expect(plan[0].durationMs).toBe(600) // 10000 * 0.06
    expect(plan[1].status).toBe('running')
    expect(plan[1].durationMs).toBe(9400) // 10000 - 600
  })

  it('updates jobs and completes generation on completed status', () => {
    const service = createMockService({
      jobs,
      updateJob: updateJobMock,
      completeGeneration: completeGenerationMock,
      failGeneration: failGenerationMock,
      clearGeneration: clearGenerationMock,
      getMockEngine: () => mockEngine
    })
    
    let eventCallback
    mockEngine.on.mockImplementation((event, cb) => {
      if (event === 'job:updated') eventCallback = cb
    })
    
    service.ensureMockEngineSubscribed()
    
    jobs.push({ id: 'mock-123', origin: 'mock' })
    
    eventCallback({
      job: {
        id: 'mock-123',
        status: 'completed',
        progress: 100,
        resultImages: ['test.png']
      }
    })
    
    expect(updateJobMock).toHaveBeenCalledWith('mock-123', expect.objectContaining({ status: 'completed' }))
    expect(completeGenerationMock).toHaveBeenCalledWith({ id: 'mock-123', resultImages: ['test.png'] })
  })
})
