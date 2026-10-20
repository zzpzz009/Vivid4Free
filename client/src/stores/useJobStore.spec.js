import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

describe('useJobStore progress guards', () => {
  let useJobStore
  let useUIStore
  let apiClient
  let ensureInputAssetSnapshot

  beforeEach(async () => {
    setActivePinia(createPinia())
    if (!global.location) {
      global.location = { hostname: 'localhost' }
    }
    if (!global.localStorage) {
      const store = new Map()
      global.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear()
      }
    }
    localStorage.clear()
    ;({ useJobStore } = await import('./useJobStore.js'))
    ;({ useUIStore } = await import('./useUIStore.js'))
    ;({ api: apiClient } = await import('@/api/index.js'))
    ;({ ensureInputAssetSnapshot } = await import('./job/inputAssetRegistry.js'))

    vi.spyOn(apiClient.jobs, 'getComfyQueueState').mockResolvedValue({
      runningIds: [],
      pendingIds: [],
      totalCount: 0
    })
    vi.spyOn(apiClient.jobs, 'getQueuedJobs').mockResolvedValue({
      success: true,
      data: { jobs: [] }
    })
    vi.spyOn(apiClient.jobs, 'getProcessingJobs').mockResolvedValue({
      success: true,
      data: { jobs: [] }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not allow running progress to decrease via updateJob', () => {
    const store = useJobStore()
    store.addJob({ id: '1', title: 't', description: '', workflowId: 'w', status: 'running', progress: 50 })
    store.updateJob('1', { status: 'running', progress: 20 })
    expect(store.jobs.find((j) => j.id === '1').progress).toBe(50)
    store.updateJob('1', { status: 'running', progress: 60 })
    expect(store.jobs.find((j) => j.id === '1').progress).toBe(60)
  })

  it('allows progress reset when status changes', () => {
    const store = useJobStore()
    store.addJob({ id: '2', title: 't', description: '', workflowId: 'w', status: 'running', progress: 80 })
    store.updateJob('2', { status: 'queued', progress: 0 })
    expect(store.jobs.find((j) => j.id === '2').progress).toBe(0)
  })

  it('tracks unified preview/upscale run state and guard messages', () => {
    const store = useJobStore()

    expect(store.tryStartPreviewUpscaleRun('preview')).toBe(true)
    expect(store.previewUpscaleRunState).toBe('previewing')
    expect(store.isPreviewUpscaleBusy).toBe(true)
    expect(store.previewUpscaleActiveKind).toBe('preview')

    expect(store.tryStartPreviewUpscaleRun('upscale')).toBe(false)
    expect(store.getPreviewUpscaleGuardMessage('upscale')).toContain('当前正在预览')

    store.setPreviewUpscaleRunState('cancelling')
    expect(store.getPreviewUpscaleGuardMessage('preview')).toContain('正在取消任务')

    store.resetPreviewUpscaleRunState()
    expect(store.previewUpscaleRunState).toBe('idle')
    expect(store.isPreviewUpscaleBusy).toBe(false)
    expect(store.previewUpscaleActiveKind).toBe(null)
  })

  it('allows guarded legacy comfy submission after preview lock is acquired', async () => {
    const store = useJobStore()
    const createSpy = vi.spyOn(apiClient.jobs, 'createGenerationJob').mockResolvedValue({
      data: { jobId: 'remote-legacy-1' }
    })

    expect(store.tryStartPreviewUpscaleRun('preview')).toBe(true)

    await expect(store.createLegacyComfyJob({
      payload: {},
      title: '预览任务',
      description: '快速预览',
      workflowId: 'yl',
      rejectIfBusy: true
    })).resolves.toMatchObject({
      success: true,
      promptId: 'remote-legacy-1'
    })

    expect(createSpy).toHaveBeenCalledTimes(1)
  })

  it('rejects legacy comfy submission when active submitted job exists', async () => {
    const store = useJobStore()
    const createSpy = vi.spyOn(apiClient.jobs, 'createGenerationJob').mockResolvedValue({
      data: { jobId: 'remote-legacy-2' }
    })

    store.addJob({
      id: 'running-legacy-1',
      title: '已有任务',
      description: '',
      workflowId: 'yl',
      status: 'running',
      source: 'comfyui',
      promptId: 'running-legacy-1',
      submittedAt: new Date().toISOString()
    })

    await expect(store.createLegacyComfyJob({
      payload: {},
      title: '预览任务',
      description: '快速预览',
      workflowId: 'yl',
      rejectIfBusy: true
    })).rejects.toThrow('当前已有任务运行中')

    expect(createSpy).not.toHaveBeenCalled()
  })

  it('maps completed resultImages to output URL for different backends', () => {
    const store = useJobStore()

    store.addJob({
      id: 'u1',
      title: 't',
      description: '',
      workflowId: 'w',
      status: 'completed',
      resultImages: ['http://example.com/image.png']
    })
    expect(store.getOutputUrl(store.jobs.find((j) => j.id === 'u1'))).toBe('http://example.com/image.png')

    store.addJob({
      id: 'u2',
      title: 't',
      description: '',
      workflowId: 'w',
      status: 'completed',
      resultImages: [{ filename: 'output.png', subfolder: '', type: 'output' }]
    })
    const outputUrl = store.getOutputUrl(store.jobs.find((j) => j.id === 'u2'))
    expect(outputUrl).toContain('/view?')
    expect(outputUrl).toContain('filename=output.png')
    expect(outputUrl).toContain('type=output')
  })

  it('prefers latest output coverUrl over stale resultImages for history cards', () => {
    const store = useJobStore()

    store.addJob({
      id: 'history-1',
      title: 't',
      description: '',
      workflowId: 'w',
      status: 'completed',
      resultImages: ['http://example.com/old.png'],
      output: {
        coverUrl: 'http://example.com/new-cover.png',
        resultUrls: ['http://example.com/new-cover.png', 'http://example.com/new-2.png']
      }
    })

    const job = store.jobs.find((j) => j.id === 'history-1')
    expect(store.getOutputUrl(job)).toBe('http://example.com/new-cover.png')
    expect(store.getOutputUrls(job)).toEqual([
      'http://example.com/new-cover.png',
      'http://example.com/new-2.png'
    ])
  })

  it('rebuilds completed output from latest resultImages', () => {
    const store = useJobStore()

    store.addJob({
      id: 'history-2',
      title: 't',
      description: '',
      workflowId: 'w',
      status: 'running',
      output: {
        coverUrl: 'http://example.com/old-cover.png',
        resultUrls: ['http://example.com/old-cover.png']
      }
    })

    store.completeGeneration({
      id: 'history-2',
      resultImages: ['http://example.com/new-cover.png', 'http://example.com/new-2.png']
    })

    const job = store.jobs.find((j) => j.id === 'history-2')
    expect(store.getOutputUrl(job)).toBe('http://example.com/new-cover.png')
    expect(job.output.resultUrls).toEqual([
      'http://example.com/new-cover.png',
      'http://example.com/new-2.png'
    ])
  })

  it('shows temp-only preview jobs as waiting for stable history output', () => {
    const store = useJobStore()

    store.addJob({
      id: 'preview-temp-job',
      title: 'preview',
      description: '',
      workflowId: 'yl',
      status: 'queued',
      isPreview: true
    })

    store.completeGeneration({
      id: 'preview-temp-job',
      resultImages: [],
      output: {
        coverUrl: 'data:image/jpeg;base64,preview-temp',
        resultUrls: ['data:image/jpeg;base64,preview-temp']
      }
    })

    const job = store.jobs.find((item) => item.id === 'preview-temp-job')
    const historyItem = store.historyItems.find((item) => item.id === 'preview-temp-job')
    expect(job.isPreview).toBe(true)
    expect(store.historyItems.map((item) => item.id)).toContain('preview-temp-job')
    expect(historyItem.status).toBe('archiving')
    expect(historyItem.output.coverUrl).toBeNull()
    expect(historyItem.output.resultUrls).toEqual([])
    expect(job.output.coverUrl).toBe('data:image/jpeg;base64,preview-temp')
    expect(store.getOutputUrl(job)).toBe('data:image/jpeg;base64,preview-temp')
  })

  it('keeps single-edit temp history in archiving state until stable history arrives', () => {
    const workflowIds = ['outpaint', 'inpaint', 'imageEdit']

    workflowIds.forEach((workflowId) => {
      const store = useJobStore()
      const jobId = `single-edit-${workflowId}`

      store.addJob({
        id: jobId,
        title: workflowId,
        description: '',
        workflowId,
        status: 'queued'
      })

      store.completeGeneration({
        id: jobId,
        resultImages: [],
        output: {
          coverUrl: 'data:image/jpeg;base64,single-edit-temp',
          resultUrls: ['data:image/jpeg;base64,single-edit-temp']
        },
        allowTempOutput: true
      })

      const historyItem = store.historyItems.find((item) => item.id === jobId)
      expect(historyItem.status).toBe('archiving')
      expect(historyItem.output.coverUrl).toBeNull()
      expect(historyItem.output.resultUrls).toEqual([])
    })
  })

  it('replaces preview snapshot with stable history output once archived', async () => {
    const store = useJobStore()

    store.addJob({
      id: 'preview-archive-job',
      title: 'preview',
      description: '',
      workflowId: 'yl',
      status: 'queued',
      isPreview: true
    })

    store.completeGeneration({
      id: 'preview-archive-job',
      resultImages: [],
      output: {
        coverUrl: 'data:image/jpeg;base64,preview-temp',
        resultUrls: ['data:image/jpeg;base64,preview-temp']
      }
    })

    vi.spyOn(apiClient.jobs, 'getRecent').mockResolvedValue({
      'preview-archive-job': {
        status: {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { timestamp: 1704067200000 }],
            ['execution_success', { timestamp: 1704067260000 }]
          ]
        },
        prompt: [],
        outputs: {
          '622': {
            images: [
              { filename: 'preview-final.png', subfolder: '第一阶段', type: 'output' }
            ]
          }
        }
      }
    })

    await store.pullRecentHistory()

    const job = store.jobs.find((item) => item.id === 'preview-archive-job')
    const historyItem = store.historyItems.find((item) => item.id === 'preview-archive-job')

    expect(job.output.coverUrl).toContain('preview-final.png')
    expect(historyItem.status).toBe('completed')
    expect(historyItem.output.coverUrl).toContain('preview-final.png')
  })

  it('archives preview output returned by history save node', async () => {
    const store = useJobStore()

    store.addJob({
      id: 'preview-output-job',
      title: 'preview',
      description: '',
      workflowId: 'yl',
      status: 'queued',
      isPreview: true
    })

    store.completeGeneration({
      id: 'preview-output-job',
      resultImages: [],
      output: {
        coverUrl: 'data:image/jpeg;base64,preview-temp',
        resultUrls: ['data:image/jpeg;base64,preview-temp']
      }
    })

    vi.spyOn(apiClient.jobs, 'getRecent').mockResolvedValue({
      'preview-output-job': {
        status: {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { timestamp: 1704067200000 }],
            ['execution_success', { timestamp: 1704067260000 }]
          ]
        },
        prompt: [],
        outputs: {
          '622': {
            images: [
              { filename: 'v14_9999.jpg', subfolder: '第一阶段', type: 'output' }
            ]
          },
          '1407': {
            images: [
              { filename: 'ComfyUI_temp_preview.png', subfolder: '', type: 'temp' }
            ]
          }
        }
      }
    })

    await store.pullRecentHistory()

    const historyItem = store.historyItems.find((item) => item.id === 'preview-output-job')
    expect(historyItem.status).toBe('completed')
    expect(historyItem.output.coverUrl).toContain('v14_9999.jpg')
  })

  it('prefers explicit completion output for immediate preview display', () => {
    const store = useJobStore()

    store.addJob({
      id: 'preview-immediate-job',
      title: 'preview',
      description: '',
      workflowId: 'yl',
      status: 'running',
      isPreview: true
    })

    store.completeGeneration({
      id: 'preview-immediate-job',
      resultImages: [
        {
          filename: 'preview-final.jpg',
          subfolder: '第一阶段',
          type: 'output'
        }
      ],
      output: {
        coverUrl: 'data:image/jpeg;base64,preview',
        resultUrls: ['data:image/jpeg;base64,preview']
      }
    })

    const job = store.jobs.find((item) => item.id === 'preview-immediate-job')
    expect(store.getOutputUrl(job)).toBe('data:image/jpeg;base64,preview')
    expect(job.resultImages[0]).toMatchObject({
      filename: 'preview-final.jpg',
      type: 'output'
    })
  })

  it('hydrates raw ComfyUI history into archive and refreshes stale local jobs on init', async () => {
    const store = useJobStore()

    store.addJob({
      id: 'raw-history-job',
      title: 'stale',
      description: '',
      workflowId: 'w',
      status: 'running',
      progress: 42
    })

    vi.spyOn(apiClient.jobs, 'getHistory').mockResolvedValue({
      'raw-history-job': {
        prompt: [
          1,
          'raw-history-job',
          {
            '10': {
              class_type: 'LoadImage',
              inputs: { image: 'floorplan.png' }
            }
          }
        ],
        outputs: {
          '100': {
            images: [
              { filename: 'raw-history-result.png', subfolder: '第一阶段', type: 'output' }
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
    vi.spyOn(apiClient.jobs, 'getRecent').mockResolvedValue({})

    await store.startHistoryLiveSync({ forceInit: true })
    store.stopHistoryLiveSync()

    const refreshed = store.jobs.find((job) => job.id === 'raw-history-job')
    expect(refreshed.status).toBe('completed')
    expect(store.getOutputUrl(refreshed)).toContain('raw-history-result.png')
    expect(store.getInputUrl(refreshed)).toContain('floorplan.png')
    expect(store.historyItems.map((item) => item.id)).toContain('raw-history-job')
  })

  it('keeps completed local history when bridge queue sync returns no active jobs', async () => {
    const store = useJobStore()

    store.addJob({
      id: 'completed-local-job',
      title: 'done',
      description: '',
      workflowId: 'w',
      status: 'completed',
      progress: 100,
      output: {
        coverUrl: 'data:image/jpeg;base64,abcd',
        resultUrls: ['data:image/jpeg;base64,abcd']
      },
      createdAt: '2024-01-01T00:00:00.000Z'
    })

    vi.spyOn(apiClient.jobs, 'getJobs').mockResolvedValue({
      success: true,
      bridge: true,
      data: { jobs: [] }
    })

    await store.loadJobsFromServer(apiClient)

    expect(store.jobs.map((job) => job.id)).toContain('completed-local-job')
    expect(store.getOutputUrl(store.jobs.find((job) => job.id === 'completed-local-job'))).toBe('data:image/jpeg;base64,abcd')
  })

  it('drops completed jobs without output when restoring local cache', () => {
    localStorage.setItem('archviz-jobs', JSON.stringify([
      {
        id: 'bad-cache-job',
        title: 'bad',
        description: '',
        workflowId: 'w',
        status: 'completed',
        progress: 100,
        stageInfo: '进度 100.00%%'
      },
      {
        id: 'good-cache-job',
        title: 'good',
        description: '',
        workflowId: 'w',
        status: 'completed',
        progress: 100,
        output: {
          coverUrl: 'http://example.com/result.png',
          resultUrls: ['http://example.com/result.png']
        }
      }
    ]))

    const store = useJobStore()
    store.loadJobsFromStorage()

    expect(store.jobs.map((job) => job.id)).toEqual(['good-cache-job'])
    expect(JSON.parse(localStorage.getItem('archviz-jobs'))).toEqual([
      expect.objectContaining({
        id: 'good-cache-job',
        status: 'completed'
      })
    ])
  })

  it('strips temp and data urls before persisting jobs to localStorage', () => {
    const store = useJobStore()
    const dataUrl = `data:image/png;base64,${'a'.repeat(240000)}`

    store.addJob({
      id: 'persist-job',
      title: 'persist',
      description: '',
      workflowId: 'w',
      status: 'running',
      input: {
        floorplanAssetId: 'input-asset-1',
        floorplanPath: dataUrl,
        stylePath: 'blob:http://localhost:3000/demo',
        floorplanFile: { name: 'floorplan.png', preview: dataUrl }
      },
      output: {
        coverUrl: 'http://localhost:8188/view?filename=ComfyUI_temp_demo.png&type=temp',
        resultUrls: [dataUrl]
      }
    })

    Array.from({ length: 30 }, (_, index) => {
      store.addJobLog('persist-job', { message: `log-${index}` })
    })

    const saved = JSON.parse(localStorage.getItem('archviz-jobs'))
    expect(saved).toHaveLength(1)
    expect(saved[0].input.floorplanAssetId).toBe('input-asset-1')
    expect(saved[0].input.floorplanPath).toBeNull()
    expect(saved[0].input.floorplanFile).toBeNull()
    expect(saved[0].output).toBeNull()
    expect(saved[0].logs).toHaveLength(20)
  })

  it('reuses the same stored floorplan snapshot across repeated submissions', async () => {
    const source = new File(['floorplan'], 'floorplan.png', {
      type: 'image/png',
      lastModified: 1704067200000
    })

    const first = await ensureInputAssetSnapshot(source)
    const second = await ensureInputAssetSnapshot(source)
    const savedAssets = JSON.parse(localStorage.getItem('archviz-history-input-assets'))

    expect(first.assetId).toBeTruthy()
    expect(second.assetId).toBe(first.assetId)
    expect(Object.keys(savedAssets)).toEqual([first.assetId])
  })

  it('keeps stored floorplan snapshot mapping after recent history merges back into local job', async () => {
    localStorage.setItem('archviz-history-input-assets', JSON.stringify({
      'input-asset-keep': {
        snapshotUrl: 'data:image/jpeg;base64,kept-snapshot',
        updatedAt: 1704067200000
      }
    }))

    const store = useJobStore()
    store.addJob({
      id: 'history-linked-job',
      title: 'preview',
      description: '',
      workflowId: 'yl',
      status: 'archiving',
      isPreview: true,
      input: {
        floorplanAssetId: 'input-asset-keep'
      },
      output: {
        coverUrl: 'data:image/jpeg;base64,preview-temp',
        resultUrls: ['data:image/jpeg;base64,preview-temp']
      }
    })

    vi.spyOn(apiClient.jobs, 'getRecent').mockResolvedValue({
      'history-linked-job': {
        status: {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { timestamp: 1704067200000 }],
            ['execution_success', { timestamp: 1704067260000 }]
          ]
        },
        prompt: [],
        outputs: {
          '622': {
            images: [
              { filename: 'history-linked-result.png', subfolder: '第一阶段', type: 'output' }
            ]
          }
        }
      }
    })

    await store.pullRecentHistory()

    const job = store.jobs.find((item) => item.id === 'history-linked-job')
    expect(job.input.floorplanAssetId).toBe('input-asset-keep')
    expect(store.getInputUrl(job)).toBe('data:image/jpeg;base64,kept-snapshot')
    expect(store.getOutputUrl(job)).toContain('history-linked-result.png')
  })

  it('QA-1: mock preview covers queued/running/completed statuses', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const uiStore = useUIStore()
    uiStore.setUseGenerationMock(true)
    uiStore.mockScenario = 'success'

    const jobStore = useJobStore()
    jobStore.setPrompt('p')
    const assetStore = { floorplanFile: { file: {} }, styleFile: { file: {} } }

    const res = await jobStore.executePreview(assetStore)
    expect(res.success).toBe(true)
    const jobId = res.jobId

    const queued = jobStore.jobs.find((j) => j.id === jobId)
    expect(queued).toBeTruthy()
    expect(['queued', 'running', 'completed'].includes(queued.status)).toBe(true)

    await vi.runAllTimersAsync()

    const done = jobStore.jobs.find((j) => j.id === jobId)
    expect(done.status).toBe('completed')
    expect(jobStore.getOutputUrl(done)).toBeTruthy()
  })

  it('QA-2: mock preview failure propagates to failed status and errorMessage', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const uiStore = useUIStore()
    uiStore.setUseGenerationMock(true)
    uiStore.mockScenario = 'fail'
    uiStore.mockFailAtPercent = 10

    const jobStore = useJobStore()
    jobStore.setPrompt('p')
    const assetStore = { floorplanFile: { file: {} }, styleFile: { file: {} } }

    const res = await jobStore.executePreview(assetStore)
    expect(res.success).toBe(true)

    await vi.advanceTimersByTimeAsync(60500)

    const failed = jobStore.jobs.find((j) => j.id === res.jobId)
    expect(failed.status).toBe('failed')
    expect(String(failed.errorMessage || '')).toContain('模拟失败')
  })

  it('QA-2: mock preview cancellation propagates to cancelled status', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const uiStore = useUIStore()
    uiStore.setUseGenerationMock(true)
    uiStore.mockScenario = 'cancel'
    uiStore.mockCancelAfterMs = 0

    const jobStore = useJobStore()
    jobStore.setPrompt('p')
    const assetStore = { floorplanFile: { file: {} }, styleFile: { file: {} } }

    const res = await jobStore.executePreview(assetStore)
    expect(res.success).toBe(true)

    await vi.advanceTimersByTimeAsync(2000)

    const cancelled = jobStore.jobs.find((j) => j.id === res.jobId)
    expect(cancelled.status).toBe('cancelled')
  })

  it('QA-3: multiple concurrent mock previews complete without conflicts', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const uiStore = useUIStore()
    uiStore.setUseGenerationMock(true)
    uiStore.mockScenario = 'success'

    const jobStore = useJobStore()
    jobStore.setPrompt('p')
    const assetStore = { floorplanFile: { file: {} }, styleFile: { file: {} } }

    const results = await Promise.all([
      jobStore.executePreview(assetStore),
      jobStore.executePreview(assetStore),
      jobStore.executePreview(assetStore),
      jobStore.executePreview(assetStore),
      jobStore.executePreview(assetStore)
    ])
    const successResults = results.filter((r) => r.success)
    const limitedResults = results.filter((r) => r.success === false)
    expect(successResults.length).toBe(4)
    expect(limitedResults.length).toBe(1)
    expect(limitedResults[0]?.error).toContain('以达到排队上限')

    await vi.advanceTimersByTimeAsync(60500)

    expect(jobStore.jobs.some((j) => j.status === 'completed')).toBe(true)
  })

  it('QA-4: workspace upscale mock completes with result output', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const uiStore = useUIStore()
    uiStore.setUseGenerationMock(true)
    uiStore.mockScenario = 'success'

    const jobStore = useJobStore()
    const assetStore = {
      floorplanFile: {
        file: {},
        preview: 'blob:workspace-floorplan'
      }
    }

    const res = await jobStore.executeGeneration(assetStore, {
      mode: 'workspace-upscale',
      title: '洗图任务',
      description: '洗图放大',
      workflowId: 'sc',
      promptFallback: '洗图放大'
    })
    expect(res.success).toBe(true)

    const queued = jobStore.jobs.find((j) => j.id === res.jobId)
    expect(queued.workflowId).toBe('sc')
    expect(queued.input?.floorplanPath).toBe('blob:workspace-floorplan')
    expect(queued.input?.prompt).toBe('洗图放大')

    await vi.runAllTimersAsync()

    const done = jobStore.jobs.find((j) => j.id === res.jobId)
    expect(done.status).toBe('completed')
    expect(jobStore.getOutputUrl(done)).toBeTruthy()
  })

  it('QA-4: workspace upscale mock cancellation propagates to cancelled status', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const uiStore = useUIStore()
    uiStore.setUseGenerationMock(true)
    uiStore.mockScenario = 'cancel'
    uiStore.mockCancelAfterMs = 0

    const jobStore = useJobStore()
    const assetStore = {
      floorplanFile: {
        file: {},
        preview: 'blob:workspace-floorplan'
      }
    }

    const res = await jobStore.executeGeneration(assetStore, {
      mode: 'workspace-upscale',
      title: '洗图任务',
      description: '洗图放大',
      workflowId: 'sc',
      promptFallback: '洗图放大'
    })
    expect(res.success).toBe(true)

    await vi.advanceTimersByTimeAsync(2000)

    const cancelled = jobStore.jobs.find((j) => j.id === res.jobId)
    expect(cancelled.status).toBe('cancelled')
  })

  it('QA-3: large batch generation stores totalCombinations and completes', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const uiStore = useUIStore()
    uiStore.setUseGenerationMock(true)
    uiStore.mockScenario = 'success'

    const jobStore = useJobStore()
    jobStore.setPrompt('p')

    const assetStore = {
      floorplanFiles: Array.from({ length: 50 }, (_, i) => ({ id: `i${i}` })),
      styleFiles: Array.from({ length: 50 }, (_, i) => ({ id: `r${i}` }))
    }

    const res = await jobStore.executeBatchGeneration(assetStore)
    expect(res.success).toBe(true)

    await vi.runAllTimersAsync()

    const job = jobStore.jobs.find((j) => j.id === res.jobId)
    expect(job.status).toBe('completed')
    expect(job.totalCombinations).toBe(2500)
  })

  it('uses jobsAPI cancel for submitted queued jobs', async () => {
    const jobStore = useJobStore()
    const cancelSpy = vi.spyOn(apiClient.jobs, 'cancelJob').mockResolvedValue({ success: true })

    jobStore.addJob({
      id: 'queued-remote',
      title: 't',
      description: '',
      workflowId: 'w',
      status: 'queued',
      origin: 'jobsAPI'
    })

    const result = await jobStore.cancelJobById('queued-remote', '用户取消')
    expect(result.success).toBe(true)
    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(cancelSpy).toHaveBeenCalledWith('queued-remote')
    expect(jobStore.jobs.find((j) => j.id === 'queued-remote')?.status).toBe('cancelled')
  })

  it('cancels local pending submission without calling jobsAPI', async () => {
    const jobStore = useJobStore()
    const cancelSpy = vi.spyOn(apiClient.jobs, 'cancelJob').mockResolvedValue({ success: true })
    const pendingJobId = 'local-pending-1'
    jobStore.addJob({
      id: pendingJobId,
      title: 'B',
      description: '',
      workflowId: 'legacy',
      status: 'queued',
      pendingSubmission: true
    })

    const result = await jobStore.cancelJobById(pendingJobId, '用户取消')
    expect(result.success).toBe(true)
    expect(result.queued).toBe(true)
    expect(cancelSpy).toHaveBeenCalledTimes(0)
    expect(jobStore.jobs.find((j) => j.id === pendingJobId)?.status).toBe('cancelled')
    expect(jobStore.jobs.find((j) => j.id === pendingJobId)?.pendingSubmission).toBe(false)
  })

  it('retries legacy result lookup until history fallback becomes available', async () => {
    const jobStore = useJobStore()
    vi.spyOn(apiClient.jobs, 'getJobResults')
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        'prompt-retry': {
          outputs: {
            '622': {
              images: [
                { filename: 'preview-final.jpg', subfolder: '第一阶段', type: 'output' }
              ]
            }
          }
        }
      })

    const result = await jobStore.getLegacyComfyResult('prompt-retry', {
      maxAttempts: 3,
      retryDelayMs: 0
    })

    expect(apiClient.jobs.getJobResults).toHaveBeenCalledTimes(3)
    expect(result.data['prompt-retry']).toBeTruthy()
  })
})
