import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/utils.js', () => ({
  objgetimgurl: (obj) => `mocked-url-${obj.filename}`
}))

vi.mock('@/api/apiUtils.js', () => ({
  BASE_URL: 'http://localhost:3000'
}))

import { selectPreferredComfyImage, selectPreferredComfyResultUrls } from './comfyResultSelection.js'

describe('comfyResultSelection', () => {
  it('prefers the last stable image on the configured output node', () => {
    const outputs = {
      '622': {
        images: [
          { filename: 'temp-preview.png', type: 'temp' },
          { filename: 'final-a.png', type: 'output' },
          { filename: 'final-b.png', type: 'output' }
        ]
      }
    }

    expect(selectPreferredComfyImage(outputs, ['622'])).toEqual({
      filename: 'final-b.png',
      type: 'output'
    })
  })

  it('prefers configured output node urls over other nodes', () => {
    const outputs = {
      '111': {
        images: [
          { filename: 'wrong.png', type: 'output' }
        ]
      },
      '622': {
        images: [
          { filename: 'temp-preview.png', type: 'temp' },
          { filename: 'final-result.png', subfolder: '第一阶段', type: 'output' }
        ]
      }
    }

    expect(selectPreferredComfyResultUrls(outputs, ['622'])).toEqual(['mocked-url-final-result.png'])
  })

  it('does not return temp urls for history selection by default', () => {
    const outputs = {
      '622': {
        images: [
          { filename: 'temp-preview.png', type: 'temp' }
        ]
      }
    }

    expect(selectPreferredComfyResultUrls(outputs, ['622'])).toEqual([])
    expect(selectPreferredComfyResultUrls(outputs, ['622'], { allowTemp: true })).toEqual(['mocked-url-temp-preview.png'])
  })

  it('waits for configured output nodes when strict preferred selection is enabled', () => {
    const outputs = {
      '56': {
        images: [
          { filename: 'cropped-preview.png', type: 'output' }
        ]
      }
    }

    expect(selectPreferredComfyImage(outputs, ['48', '50'], { strictPreferred: true })).toBe(null)
    expect(selectPreferredComfyImage(outputs, ['48', '50'])).toEqual({
      filename: 'cropped-preview.png',
      type: 'output'
    })
  })

  it('does not fall back to unrelated result URLs in strict mode', () => {
    const outputs = {
      '56': { images: [{ filename: 'unrelated.png', type: 'output' }] }
    }

    expect(selectPreferredComfyResultUrls(outputs, ['287'], { strictPreferred: true })).toEqual([])
    expect(selectPreferredComfyResultUrls(outputs, ['287'])).toEqual(['mocked-url-unrelated.png'])
  })
})
