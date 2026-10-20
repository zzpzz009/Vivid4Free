function toPositiveInt(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const i = Math.floor(n)
  return i > 0 ? i : fallback
}

function normalizeOrder(orderBy, orderDirection) {
  const by = typeof orderBy === 'string' && orderBy.trim() ? orderBy.trim() : 'name'
  const dirRaw = typeof orderDirection === 'string' ? orderDirection.toUpperCase() : 'ASC'
  const dir = dirRaw === 'DESC' ? 'DESC' : 'ASC'
  return { orderBy: by, orderDirection: dir }
}

export function buildCommonImagesResponse(files, basePath = '/gallery/common', optionsOrMaxCount = 50) {
  const options = typeof optionsOrMaxCount === 'object' && optionsOrMaxCount ? optionsOrMaxCount : { limit: optionsOrMaxCount }
  const { orderBy, orderDirection } = normalizeOrder(options.orderBy, options.orderDirection)
  const limit = Math.min(toPositiveInt(options.limit, 50), 50)
  const page = toPositiveInt(options.page, 1)

  const sorted = Array.isArray(files) ? files.slice() : []
  if (orderBy === 'name') {
    sorted.sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
  }
  if (orderDirection === 'DESC') sorted.reverse()

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * limit
  const slice = sorted.slice(offset, offset + limit)

  const images = slice.map((name, index) => ({
    id: offset + index + 1,
    name,
    url: `${basePath}/${encodeURIComponent(name)}`
  }))
  return {
    success: true,
    images,
    pagination: { page: safePage, limit, total, totalPages, orderBy, orderDirection }
  }
}

export function filterImagesByUrls(requested, files, basePath = '/gallery/common', maxCount = 50) {
  const existing = new Set(files.map(name => `${basePath}/${encodeURIComponent(name)}`))
  const inputList = Array.isArray(requested) ? requested : []
  const filtered = []
  for (let i = 0; i < inputList.length && filtered.length < maxCount; i++) {
    const item = inputList[i]
    if (!item || typeof item.url !== 'string') {
      continue
    }
    if (existing.has(item.url)) {
      filtered.push({
        url: item.url,
        name: item.name || item.url
      })
    }
  }
  return { success: true, images: filtered }
}
