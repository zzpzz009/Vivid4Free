function toPositiveNumber(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

export function computeMasonryLayout(items, containerWidth, options = {}) {
  const list = Array.isArray(items) ? items : []
  const width = toPositiveNumber(containerWidth, 0)
  const gap = toPositiveNumber(options.gap, 12)
  const minColumnWidth = toPositiveNumber(options.minColumnWidth, 160)
  const maxColumns = Number.isFinite(Number(options.maxColumns)) ? Math.max(1, Math.floor(Number(options.maxColumns))) : 99
  const minColumns = Number.isFinite(Number(options.minColumns)) ? Math.max(1, Math.floor(Number(options.minColumns))) : 1
  const fallbackAspectRatio = toPositiveNumber(options.fallbackAspectRatio, 1.5)
  const maxHeightFactor = toPositiveNumber(options.maxHeightFactor, 2.5)

  if (!width || !list.length) {
    return {
      columnCount: 1,
      columnWidth: width || 0,
      gap,
      height: 0,
      positions: []
    }
  }

  const estimatedColumns = Math.floor((width + gap) / (minColumnWidth + gap))
  const columnCount = Math.max(minColumns, Math.min(maxColumns, Math.max(1, estimatedColumns)))
  const columnWidth = (width - gap * (columnCount - 1)) / columnCount

  const heights = new Array(columnCount).fill(0)
  const positions = list.map((item, index) => {
    const aspectRatio = toPositiveNumber(item?.aspectRatio, fallbackAspectRatio) || fallbackAspectRatio
    const rawHeight = columnWidth / aspectRatio
    const maxHeight = Math.round(columnWidth * maxHeightFactor)
    const height = Math.max(48, Math.min(maxHeight, Math.round(rawHeight)))
    let colIndex = 0
    let minHeight = heights[0]
    for (let c = 1; c < heights.length; c++) {
      if (heights[c] < minHeight) {
        minHeight = heights[c]
        colIndex = c
      }
    }
    const x = Math.round(colIndex * (columnWidth + gap))
    const y = Math.round(heights[colIndex])
    heights[colIndex] += height + gap
    return { index, x, y, width: Math.round(columnWidth), height }
  })

  const height = Math.max(0, Math.round(Math.max(...heights) - gap))
  return { columnCount, columnWidth: Math.round(columnWidth), gap, height, positions }
}
