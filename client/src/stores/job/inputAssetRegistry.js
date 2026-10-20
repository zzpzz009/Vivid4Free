const STORAGE_KEY = 'archviz-history-input-assets'
const MAX_SNAPSHOT_DATA_URL_LENGTH = 180000
const MAX_ITEMS = 60

const trimString = (value) => typeof value === 'string' ? value.trim() : ''

const normalizeSourcePath = (value) => trimString(value)
  .replace(/\\/g, '/')
  .replace(/#.*$/, '')
  .replace(/\?.*$/, '')

const hashString = (value) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(36)
}

const getSourceFile = (source) => {
  if (source instanceof File) return source
  if (source?.file instanceof File) return source.file
  return null
}

const getSourceUrl = (source) => {
  if (typeof source === 'string') return trimString(source)
  return trimString(source?.preview || source?.url || source?.path || '')
}

const buildSourceKey = (source) => {
  if (!source) return ''
  if (typeof source?.assetId === 'string' && source.assetId.trim()) {
    return `id:${source.assetId.trim()}`
  }

  const file = getSourceFile(source)
  if (file) {
    return `file:${file.name}:${file.size}:${file.lastModified}:${file.type || ''}`
  }

  const name = trimString(source?.name || '')
  const size = Number(source?.size || 0)
  const lastModified = Number(source?.lastModified || 0)
  const type = trimString(source?.type || '')
  if (name || size || lastModified || type) {
    return `meta:${name}:${size}:${lastModified}:${type}`
  }

  const sourceUrl = normalizeSourcePath(getSourceUrl(source))
  if (sourceUrl) {
    return `url:${sourceUrl}`
  }

  return ''
}

const readRegistry = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const writeRegistry = (registry) => {
  try {
    const entries = Object.entries(registry || {})
      .sort((left, right) => Number(right?.[1]?.updatedAt || 0) - Number(left?.[1]?.updatedAt || 0))
      .slice(0, MAX_ITEMS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    return
  }
}

const bytesToBase64 = (bytes) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary)
}

const readAsDataUrl = async (blob) => {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(blob)
    })
  }
  if (typeof blob?.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer()
    const mimeType = trimString(blob.type || 'application/octet-stream')
    return `data:${mimeType};base64,${bytesToBase64(new Uint8Array(buffer))}`
  }
  throw new Error('读取图片失败')
}

const fileToDataUrl = (file) => readAsDataUrl(file)

const blobToDataUrl = (blob) => readAsDataUrl(blob)

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('图片加载失败'))
  image.src = src
})

const shrinkSnapshotDataUrl = async (src, maxSide = 480, quality = 0.76) => {
  if (typeof src !== 'string' || !src.startsWith('data:image/')) return null
  try {
    const image = await loadImage(src)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) return src.length <= MAX_SNAPSHOT_DATA_URL_LENGTH ? src : null
    const scale = Math.min(1, maxSide / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) return src.length <= MAX_SNAPSHOT_DATA_URL_LENGTH ? src : null
    context.drawImage(image, 0, 0, targetWidth, targetHeight)
    const snapshot = canvas.toDataURL('image/jpeg', quality)
    if (snapshot.length <= MAX_SNAPSHOT_DATA_URL_LENGTH) return snapshot
    return src.length <= MAX_SNAPSHOT_DATA_URL_LENGTH ? src : null
  } catch {
    return src.length <= MAX_SNAPSHOT_DATA_URL_LENGTH ? src : null
  }
}

const materializeSourceDataUrl = async (source) => {
  const file = getSourceFile(source)
  if (file) {
    return fileToDataUrl(file)
  }

  const sourceUrl = getSourceUrl(source)
  if (!sourceUrl) return null
  if (sourceUrl.startsWith('data:image/')) return sourceUrl

  try {
    const response = await fetch(sourceUrl, { cache: 'no-store' })
    if (!response.ok) return null
    const blob = await response.blob()
    return blobToDataUrl(blob)
  } catch {
    return null
  }
}

export const buildInputAssetId = (source) => {
  const key = buildSourceKey(source)
  if (!key) return ''
  return `input-${hashString(key)}`
}

export const ensureInputAssetSnapshot = async (source) => {
  const assetId = buildInputAssetId(source)
  const fallbackUrl = getSourceUrl(source) || null
  if (!assetId) {
    return { assetId: '', url: fallbackUrl }
  }

  const registry = readRegistry()
  const existing = registry[assetId]
  if (typeof existing?.snapshotUrl === 'string' && existing.snapshotUrl.trim()) {
    return { assetId, url: existing.snapshotUrl }
  }

  const dataUrl = await materializeSourceDataUrl(source)
  const snapshotUrl = await shrinkSnapshotDataUrl(dataUrl)
  const file = getSourceFile(source)
  registry[assetId] = {
    snapshotUrl: snapshotUrl || null,
    sourceUrl: fallbackUrl,
    name: trimString(source?.name || file?.name || ''),
    updatedAt: Date.now()
  }
  writeRegistry(registry)

  return {
    assetId,
    url: snapshotUrl || fallbackUrl
  }
}

export const resolveInputAssetUrl = (assetId) => {
  const normalizedAssetId = trimString(assetId)
  if (!normalizedAssetId) return null
  const registry = readRegistry()
  const entry = registry[normalizedAssetId]
  return trimString(entry?.snapshotUrl || entry?.sourceUrl || '') || null
}
