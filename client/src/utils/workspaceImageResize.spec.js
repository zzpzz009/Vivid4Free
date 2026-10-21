import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WORKSPACE_IMAGE_RESIZE_RULES,
  computeImageResizePlan,
  getWorkspaceImageResizeRule,
  resizeImageFileForWorkspace
} from './workspaceImageResize.js'

afterEach(() => vi.unstubAllGlobals())

const imageDimensions = (width, height) => {
  vi.stubGlobal('Image', class {
    naturalWidth = width
    naturalHeight = height
    set src(value) { this.onload() }
  })
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() })
}

describe('workspaceImageResize', () => {
  it.each(['dcl', 'ck'])('preserves the original file bytes for a %s image within limits', async type => {
    imageDimensions(1600, 1200)
    const file = new File(['original image bytes'], 'input.png', { type: 'image/png' })
    const result = await resizeImageFileForWorkspace(type, file, true)
    expect(result.file).toBe(file)
    expect(result.resized).toBe(false)
    expect(result.converted).toBe(false)
  })

  it('still shrinks oversized main images before upload', async () => {
    imageDimensions(6400, 3600)
    const context = { fillRect: vi.fn(), drawImage: vi.fn() }
    const canvas = { getContext: () => context, toBlob: (done, type) => done(new Blob(['resized'], { type })) }
    vi.stubGlobal('document', { createElement: () => canvas })
    const result = await resizeImageFileForWorkspace('dcl', new File(['large image'], 'input.png', { type: 'image/png' }), true)
    expect(result.resized).toBe(true)
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(2400000)
    expect(result.file.type).toBe('image/jpeg')
    expect(context.drawImage).toHaveBeenCalledOnce()
  })
  it('keeps images within limits unchanged', () => {
    const plan = computeImageResizePlan(1600, 1200, WORKSPACE_IMAGE_RESIZE_RULES.dcl)

    expect(plan.resized).toBe(false)
    expect(plan.targetWidth).toBe(1600)
    expect(plan.targetHeight).toBe(1200)
  })

  it('limits floorplan images only by total pixels and keeps ratio nearly unchanged', () => {
    const plan = computeImageResizePlan(4000, 2000, WORKSPACE_IMAGE_RESIZE_RULES.dcl)

    expect(plan.resized).toBe(true)
    expect(plan.maxLongEdge).toBe(0)
    expect(plan.targetPixels).toBeLessThanOrEqual(WORKSPACE_IMAGE_RESIZE_RULES.dcl.maxTotalPixels)
    expect(plan.targetPixels).toBeGreaterThanOrEqual(WORKSPACE_IMAGE_RESIZE_RULES.dcl.maxTotalPixels - 5000)
    const sourceRatio = 4000 / 2000
    const targetRatio = plan.targetWidth / plan.targetHeight
    expect(Math.abs(targetRatio - sourceRatio)).toBeLessThan(0.01)
  })

  it('limits reference images by total pixels when needed', () => {
    const plan = computeImageResizePlan(2600, 1800, WORKSPACE_IMAGE_RESIZE_RULES.ck)

    expect(plan.resized).toBe(true)
    expect(plan.targetPixels).toBeLessThanOrEqual(WORKSPACE_IMAGE_RESIZE_RULES.ck.maxTotalPixels)
    expect(Math.max(plan.targetWidth, plan.targetHeight)).toBeLessThanOrEqual(WORKSPACE_IMAGE_RESIZE_RULES.ck.maxLongEdge)
  })

  it('returns default rule for unknown type', () => {
    expect(getWorkspaceImageResizeRule('unknown')).toEqual(WORKSPACE_IMAGE_RESIZE_RULES.dcl)
  })

  it('prefers a target size close to 2048*2048 equivalent pixels for floorplan', () => {
    const plan = computeImageResizePlan(6400, 3600, WORKSPACE_IMAGE_RESIZE_RULES.dcl)

    expect(plan.resized).toBe(true)
    expect(plan.targetPixels).toBeLessThanOrEqual(WORKSPACE_IMAGE_RESIZE_RULES.dcl.maxTotalPixels)
    expect(plan.targetPixels).toBeGreaterThan(WORKSPACE_IMAGE_RESIZE_RULES.dcl.maxTotalPixels - 8000)
  })
})
