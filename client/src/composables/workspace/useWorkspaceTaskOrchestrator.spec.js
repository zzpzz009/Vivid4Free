import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useWorkspaceTaskOrchestrator } from './useWorkspaceTaskOrchestrator'

const mocks = vi.hoisted(() => ({
  xm: { dclimg: 'main.png', ckimg: 'reference.png', seed: '123', referenceStrength: 1, colorMatchStrength: 0.285403, addScene: true },
  job: { jobs: [], tryStartPreviewUpscaleRun: () => true, addJob: vi.fn(), failGeneration: () => {}, resetPreviewUpscaleRunState: () => {}, setStatusMessage: vi.fn() }
}))
vi.mock('@/stores/xmStore.js', () => ({ useXMStore: () => mocks.xm }))
vi.mock('@/stores/useJobStore.js', () => ({ useJobStore: () => mocks.job }))
vi.mock('@/stores/useUIStore.js', () => ({ useUIStore: () => ({}) }))

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('preview frontend parameter mapping', () => {
  it.each([false, 'false', true, 'true'])('preserves mirror selection %s and source strengths', async mirror => {
    mocks.xm.jx = mirror
    mocks.job.previewUpscaleRunState = ref('idle')
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'test stops before rendering' }) })
    vi.stubGlobal('fetch', fetch)
    await useWorkspaceTaskOrchestrator().handlePreview()
    expect(fetch).toHaveBeenCalledTimes(1)
    const parameters = JSON.parse(fetch.mock.calls[0][1].body)
    expect(parameters.mirror).toBe(mirror === true || mirror === 'true')
    expect(parameters.referenceStrength).toBe(1)
    expect(parameters.colorMatchStrength).toBe(0.285403)
    expect(parameters.seed).toBe(123)
  })

  it('reconciles an uncertain write by requestId without replaying it or enabling cancellation', async () => {
    mocks.job.previewUpscaleRunState = ref('idle')
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValueOnce(new Response('{"tasks":[]}'))
    vi.stubGlobal('fetch', fetch)
    const orchestrator = useWorkspaceTaskOrchestrator()
    await orchestrator.handlePreview()
    const submitted = JSON.parse(fetch.mock.calls[0][1].body)
    expect(submitted.requestId).toEqual(expect.any(String))
    expect(fetch.mock.calls[1][0]).toBe('/api/desktop/tasks')
    expect(fetch.mock.calls[1][1].method).toBe('GET')
    expect(mocks.job.addJob).toHaveBeenCalledWith(expect.objectContaining({
      id: `desktop-${submitted.requestId}`, status: 'submission_unknown',
      parameters: expect.objectContaining({ requestId: submitted.requestId })
    }))
    await orchestrator.handleCancel()
    await orchestrator.handlePreview()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('aborts an in-flight submission when its Vue scope is disposed without starting reconciliation', async () => {
    mocks.job.previewUpscaleRunState = ref('idle')
    const fetch = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetch)
    const scope = effectScope()
    const orchestrator = scope.run(() => useWorkspaceTaskOrchestrator())
    const pending = orchestrator.handlePreview()
    scope.stop()
    await pending
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.job.addJob).not.toHaveBeenCalled()
    expect(orchestrator.isSubmitting.value).toBe(false)
  })
})
