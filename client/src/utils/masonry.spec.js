import { describe, expect, it } from 'vitest'
import { computeMasonryLayout } from './masonry.js'

describe('computeMasonryLayout', () => {
  it('returns empty layout for empty items', () => {
    const layout = computeMasonryLayout([], 500)
    expect(layout.positions).toEqual([])
    expect(layout.height).toBe(0)
  })

  it('computes deterministic positions', () => {
    const items = [
      { aspectRatio: 1 },
      { aspectRatio: 2 },
      { aspectRatio: 0.5 },
      { aspectRatio: 1.5 }
    ]
    const layout = computeMasonryLayout(items, 500, { minColumnWidth: 150, gap: 10 })
    expect(layout.columnCount).toBeGreaterThanOrEqual(2)
    expect(layout.positions).toHaveLength(4)
    const first = layout.positions[0]
    expect(first.x).toBe(0)
    expect(first.y).toBe(0)
    expect(first.width).toBeGreaterThan(0)
    expect(first.height).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('uses fallback aspect ratio when missing', () => {
    const items = [{}, {}, {}]
    const layout = computeMasonryLayout(items, 320, { minColumnWidth: 160, gap: 0, fallbackAspectRatio: 2 })
    expect(layout.positions.every((p) => p.height > 0)).toBe(true)
  })
})

