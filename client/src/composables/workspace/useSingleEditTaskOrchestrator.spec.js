import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('pinia', async () => {
  const actual = await vi.importActual('pinia')
  return {
    ...actual,
    storeToRefs: (store) => store
  }
})

vi.mock('@/utils/utils.js', () => ({
  objgetimgurl: (obj) => `mocked-url-${obj.filename}`,
  randomNum: () => 123456
}))

vi.mock('@/api/apiUtils.js', () => ({
  BASE_URL: 'http://localhost:3000',
  COMFY_WS_URL: '/comfy'
}))

vi.mock('@/api/websocket.js', () => ({
  connect: vi.fn()
}))

const xmApiMocks = vi.hoisted(() => ({
  freeComfyResources: vi.fn().mockResolvedValue(undefined),
  uploadimgapi: vi.fn().mockResolvedValue({ name: 'uploaded-input.png' }),
  mdapi: vi.fn()
}))

vi.mock('@/api/xmapi.js', () => ({
  default: {
    freeComfyResources: xmApiMocks.freeComfyResources,
    uploadimgapi: xmApiMocks.uploadimgapi,
    mdapi: xmApiMocks.mdapi
  }
}))

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(() => 'loading-id'),
  removeToast: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
}))

vi.mock('@/utils/toast.js', () => ({
  useToast: () => ({
    success: toastMocks.success,
    error: toastMocks.error,
    info: toastMocks.info,
    loading: toastMocks.loading,
    removeToast: toastMocks.removeToast
  })
}))

vi.mock('@/config/config.js', () => ({
  default: {
    config: {
      outpaint: {
        jsonfile: {
          '31': { inputs: { image: '' } },
          '22': { inputs: { text: '' } },
          '32': { inputs: { left: 0, top: 0, right: 0, bottom: 0 } },
          '36': { inputs: { show_history: 'false' } },
          '34': { inputs: {} }
        },
        input: {
          dcl: '31',
          tsc: '22',
          pad: '32'
        },
        output: {
          img: '36',
          compare: '34'
        }
      }
    }
  }
}))

const storeMocks = vi.hoisted(() => ({
  jobStoreMock: {
    previewUpscaleRunState: { value: 'idle' },
    prompt: { value: '扩图提示词' },
    jobs: { value: [] },
    currentJobId: 'prompt-1',
    tryStartPreviewUpscaleRun: vi.fn(() => true),
    getPreviewUpscaleGuardMessage: vi.fn(() => ''),
    resetPreviewUpscaleRunState: vi.fn(),
    ensureComfyReadyForNewRun: vi.fn().mockResolvedValue(undefined),
    createLegacyComfyJob: vi.fn().mockResolvedValue({ promptId: 'prompt-1' }),
    getLegacyComfyResult: vi.fn(),
    completeGeneration: vi.fn(),
    failGeneration: vi.fn(),
    setPrompt: vi.fn(),
    setPreviewUpscaleRunState: vi.fn(),
    cancelJobById: vi.fn(),
    getOutputUrls: vi.fn(() => []),
    getOutputUrl: vi.fn(() => ''),
    getInputUrl: vi.fn(() => ''),
    updateProgress: vi.fn()
  },
  assetStoreMock: {
    maskFile: { value: null }
  },
  xmStoreMock: {
    dclimg: 'existing-input.png',
    tsc: '',
    seed: '',
    savesuccessimgurl: vi.fn(),
    savetsc: vi.fn(),
    savedclimg: vi.fn()
  }
}))

vi.mock('@/stores', () => ({
  useAssetStore: () => storeMocks.assetStoreMock,
  useJobStore: () => storeMocks.jobStoreMock
}))

vi.mock('@/stores/xmStore.js', () => ({
  useXMStore: () => storeMocks.xmStoreMock
}))

vi.mock('@/stores/job/inputAssetRegistry.js', () => ({
  ensureInputAssetSnapshot: vi.fn(async (source) => ({
    assetId: `${source?.name || 'asset'}-id`,
    url: source?.preview || source?.url || null
  }))
}))

import { useSingleEditTaskOrchestrator } from './useSingleEditTaskOrchestrator.js'

const { jobStoreMock } = storeMocks

describe('useSingleEditTaskOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => ''),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    })
    jobStoreMock.previewUpscaleRunState.value = 'idle'
    jobStoreMock.prompt.value = '扩图提示词'
    jobStoreMock.jobs.value = []
    jobStoreMock.tryStartPreviewUpscaleRun.mockReturnValue(true)
    jobStoreMock.createLegacyComfyJob.mockResolvedValue({ promptId: 'prompt-1' })
    jobStoreMock.getLegacyComfyResult.mockResolvedValueOnce({
      data: {
        'prompt-1': {
          outputs: {
            '34': {
              images: [
                { filename: 'compare-only.png', type: 'output' }
              ]
            }
          }
        }
      }
    }).mockResolvedValueOnce({
      data: {
        'prompt-1': {
          outputs: {
            '36': {
              images: [
                { filename: 'final-result.png', type: 'output' }
              ]
            }
          }
        }
      }
    })
  })

  it('waits for the main single-edit output node instead of finalizing with compare output', async () => {
    const orchestrator = useSingleEditTaskOrchestrator({
      uploadedImage: ref({
        name: 'source.png',
        preview: 'blob:source-preview',
        file: {}
      }),
      uploadedReferenceFile: ref(null),
      outpaintValues: ref({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }),
      syncOriginalImage: vi.fn()
    })

    const task = orchestrator.handleGenerate({
      id: 'outpaint',
      name: '扩图',
      configKey: 'outpaint',
      imageUploadTitle: '待扩图图片',
      supportsMask: false,
      defaultPromptText: '扩图'
    })

    await vi.runAllTimersAsync()
    await task

    expect(jobStoreMock.getLegacyComfyResult).toHaveBeenCalledTimes(2)
    expect(jobStoreMock.completeGeneration).toHaveBeenCalledTimes(1)
    expect(jobStoreMock.completeGeneration.mock.calls[0][0].resultImages).toEqual([
      { filename: 'final-result.png', type: 'output' }
    ])
  })

  it('waits for stable main output instead of finalizing with temp single-edit output', async () => {
    jobStoreMock.getLegacyComfyResult.mockReset()
    jobStoreMock.completeGeneration.mockReset()
    jobStoreMock.getLegacyComfyResult.mockResolvedValueOnce({
      data: {
        'prompt-1': {
          outputs: {
            '36': {
              images: [
                { filename: 'temp-black.png', type: 'temp' }
              ]
            }
          }
        }
      }
    }).mockResolvedValueOnce({
      data: {
        'prompt-1': {
          outputs: {
            '36': {
              images: [
                { filename: 'final-result.png', type: 'output' }
              ]
            }
          }
        }
      }
    })

    const orchestrator = useSingleEditTaskOrchestrator({
      uploadedImage: ref({
        name: 'source.png',
        preview: 'blob:source-preview',
        file: {}
      }),
      uploadedReferenceFile: ref(null),
      outpaintValues: ref({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }),
      syncOriginalImage: vi.fn()
    })

    const task = orchestrator.handleGenerate({
      id: 'outpaint',
      name: '扩图',
      configKey: 'outpaint',
      imageUploadTitle: '待扩图图片',
      supportsMask: false,
      defaultPromptText: '扩图'
    })

    await vi.runAllTimersAsync()
    await task

    expect(jobStoreMock.getLegacyComfyResult).toHaveBeenCalledTimes(2)
    expect(jobStoreMock.completeGeneration).toHaveBeenCalledTimes(1)
    expect(jobStoreMock.completeGeneration.mock.calls[0][0].resultImages).toEqual([
      { filename: 'final-result.png', type: 'output' }
    ])
  })
})
