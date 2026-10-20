import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_IMAGE_RESIZE_RULES,
  computeImageResizePlan,
  getWorkspaceImageResizeRule
} from './workspaceImageResize.js'

describe('workspaceImageResize', () => {
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
