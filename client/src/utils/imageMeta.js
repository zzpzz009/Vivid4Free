const MEMORY_CACHE = new Map()
const STORAGE_KEY = 'image_meta_cache_v1'
const MAX_STORAGE_ENTRIES = 500
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function readStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return { version: 1, entries: {} }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = safeParseJson(raw, null)
  if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object') {
    return { version: 1, entries: {} }
  }
  return parsed
}

function writeStorage(payload) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    void 0
  }
}

function getCached(url) {
  const inMemory = MEMORY_CACHE.get(url)
  if (inMemory && inMemory.expiresAt > Date.now()) return inMemory.value

  const store = readStorage()
  const record = store.entries[url]
  if (!record || typeof record !== 'object') return null
  if (typeof record.expiresAt !== 'number' || record.expiresAt <= Date.now()) return null
  if (!record.value || typeof record.value !== 'object') return null

  MEMORY_CACHE.set(url, { expiresAt: record.expiresAt, value: record.value })
  return record.value
}

function setCached(url, value, ttlMs = DEFAULT_TTL_MS) {
  const expiresAt = Date.now() + ttlMs
  MEMORY_CACHE.set(url, { expiresAt, value })

  const store = readStorage()
  store.entries[url] = { expiresAt, value }

  const keys = Object.keys(store.entries)
  if (keys.length > MAX_STORAGE_ENTRIES) {
    const sorted = keys
      .map((k) => ({ k, expiresAt: store.entries[k]?.expiresAt ?? 0 }))
      .sort((a, b) => a.expiresAt - b.expiresAt)
    const overflow = sorted.slice(0, keys.length - MAX_STORAGE_ENTRIES)
    for (const item of overflow) {
      delete store.entries[item.k]
    }
  }
  writeStorage(store)
}

function withTimeout(promise, timeoutMs) {
  if (!timeoutMs) return promise
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('probe_timeout')), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId)
  })
}

function ensurePositiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : null
}

function extractDominantColor(img, sampleSize = 16) {
  const canvas = document.createElement('canvas')
  canvas.width = sampleSize
  canvas.height = sampleSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize)
  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 8) continue
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }
  if (!count) return null
  r = Math.round(r / count)
  g = Math.round(g / count)
  b = Math.round(b / count)
  return `rgb(${r}, ${g}, ${b})`
}

function buildLqip(img, maxSide = 24, quality = 0.55) {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return null
  const scale = maxSide / Math.max(w, h)
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, tw, th)
  try {
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null
  }
}

function readExifOrientationFromJpeg(buffer) {
  const view = new DataView(buffer)
  if (view.byteLength < 4) return null
  if (view.getUint16(0, false) !== 0xffd8) return null
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break
    const marker = view.getUint8(offset + 1)
    offset += 2
    if (marker === 0xd9 || marker === 0xda) break
    const size = view.getUint16(offset, false)
    if (size < 2) break
    const segmentStart = offset + 2
    if (marker === 0xe1 && segmentStart + 8 <= view.byteLength) {
      const exif =
        view.getUint32(segmentStart, false) === 0x45786966 &&
        view.getUint16(segmentStart + 4, false) === 0x0000
      if (!exif) {
        offset += size
        continue
      }
      const tiffStart = segmentStart + 6
      if (tiffStart + 8 > view.byteLength) return null
      const endianness = view.getUint16(tiffStart, false)
      const littleEndian = endianness === 0x4949
      if (!littleEndian && endianness !== 0x4d4d) return null
      const magic = view.getUint16(tiffStart + 2, littleEndian)
      if (magic !== 0x002a) return null
      const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian)
      let ifdOffset = tiffStart + ifd0Offset
      if (ifdOffset + 2 > view.byteLength) return null
      const entries = view.getUint16(ifdOffset, littleEndian)
      ifdOffset += 2
      for (let i = 0; i < entries; i++) {
        const entryOffset = ifdOffset + i * 12
        if (entryOffset + 12 > view.byteLength) break
        const tag = view.getUint16(entryOffset, littleEndian)
        if (tag !== 0x0112) continue
        const type = view.getUint16(entryOffset + 2, littleEndian)
        const count = view.getUint32(entryOffset + 4, littleEndian)
        if (type !== 3 || count !== 1) return null
        const value = view.getUint16(entryOffset + 8, littleEndian)
        return value >= 1 && value <= 8 ? value : null
      }
      return null
    }
    offset += size
  }
  return null
}

async function probeExifOrientation(url, timeoutMs) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), Math.max(0, timeoutMs || 0))
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-65535' },
      signal: controller.signal
    }).finally(() => window.clearTimeout(timeoutId))
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return readExifOrientationFromJpeg(buf)
  } catch {
    return null
  }
}

export async function probeImageMeta(url, options = {}) {
  const {
    timeoutMs = 8000,
    ttlMs = DEFAULT_TTL_MS,
    computeDominantColor = false,
    computeLqip: computeLqipOption = false,
    probeExifOrientation: probeExifOrientationOption = true
  } = options

  if (!url || typeof url !== 'string') return null

  const cached = getCached(url)
  if (cached) return cached

  const work = new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        if (img.decode) {
          try {
            await img.decode()
          } catch {
            void 0
          }
        }

        const rawWidth = ensurePositiveNumber(img.naturalWidth || img.width)
        const rawHeight = ensurePositiveNumber(img.naturalHeight || img.height)
        let width = rawWidth
        let height = rawHeight
        let aspectRatio = width && height ? width / height : null

        let exifOrientation = null
        if (probeExifOrientationOption) {
          try {
            exifOrientation = await probeExifOrientation(url, Math.min(2500, timeoutMs || 2500))
          } catch {
            exifOrientation = null
          }
        }
        if (exifOrientation && (exifOrientation === 5 || exifOrientation === 6 || exifOrientation === 7 || exifOrientation === 8)) {
          if (rawWidth && rawHeight) {
            width = rawHeight
            height = rawWidth
            aspectRatio = width / height
          } else if (aspectRatio) {
            aspectRatio = 1 / aspectRatio
          }
        }

        let dominantColor = null
        if (computeDominantColor) {
          try {
            dominantColor = extractDominantColor(img)
          } catch {
            dominantColor = null
          }
        }

        let lqip = null
        if (computeLqipOption) {
          try {
            lqip = buildLqip(img)
          } catch {
            lqip = null
          }
        }

        const result = {
          url,
          width,
          height,
          aspectRatio,
          exifOrientation,
          dominantColor,
          lqip,
          updatedAt: Date.now()
        }

        const stored = { url, width, height, aspectRatio, exifOrientation, dominantColor, lqip, updatedAt: result.updatedAt }
        if (stored.lqip && typeof stored.lqip === 'string' && stored.lqip.length > 3000) {
          stored.lqip = null
        }
        setCached(url, stored, ttlMs)
        resolve(stored)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('probe_error'))
    img.src = url
  })

  try {
    return await withTimeout(work, timeoutMs)
  } catch {
    const fallback = { url, width: null, height: null, aspectRatio: 1.5, dominantColor: null, lqip: null, updatedAt: Date.now() }
    setCached(url, fallback, Math.min(ttlMs, 1000 * 60 * 10))
    return fallback
  }
}
