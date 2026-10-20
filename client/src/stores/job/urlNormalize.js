import { objgetimgurl } from '@/utils/utils.js'
import { BASE_URL } from '@/api/apiUtils.js'
import { resolveInputAssetUrl } from './inputAssetRegistry.js'

const normalizeSlashPath = (value) => String(value || '').replace(/\\/g, '/').trim()
const IMAGE_FILENAME_RE = /\.[a-zA-Z0-9]{2,8}$/

const buildViewUrlFromNestedPath = (pathValue, type = 'output') => {
  const normalized = normalizeSlashPath(pathValue).replace(/^\/+/, '')
  if (!normalized || !normalized.includes('/')) return null
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const filename = parts.pop()
  const subfolder = parts.join('/')
  if (!filename || !subfolder) return null
  return objgetimgurl({ filename, subfolder, type })
}

const buildViewUrlFromFilename = (value, type = 'output') => {
  const filename = String(value || '').trim().replace(/^\/+/, '')
  if (!filename || filename.includes('/')) return null
  if (!IMAGE_FILENAME_RE.test(filename)) return null
  return objgetimgurl({ filename, type })
}

const buildViewUrlFromViewSearchParams = (searchParams, fallbackType = 'output') => {
  const filename = searchParams.get('filename') || ''
  if (!filename.trim()) return null
  return objgetimgurl({
    filename,
    subfolder: searchParams.get('subfolder') || '',
    type: searchParams.get('type') || fallbackType
  })
}

export const normalizeImageUrlString = (value, type = 'output') => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed)
      if (parsed.pathname.startsWith('/view')) {
        const viewUrl = buildViewUrlFromViewSearchParams(parsed.searchParams, type)
        if (viewUrl) return viewUrl
      }
      if (parsed.pathname.startsWith('/api/files/')) {
        const nested = decodeURIComponent(parsed.pathname.replace(/^\/api\/files\//, ''))
        const viewUrl = buildViewUrlFromNestedPath(nested, type)
        if (viewUrl) return viewUrl
      }
    } catch (_) {
      return trimmed
    }
    return trimmed
  }
  if (trimmed.startsWith('/')) {
    const normalized = normalizeSlashPath(trimmed)
    if (normalized.startsWith('/view')) {
      try {
        const parsed = new URL(normalized, BASE_URL)
        const viewUrl = buildViewUrlFromViewSearchParams(parsed.searchParams, type)
        if (viewUrl) return viewUrl
      } catch (_) {
        return normalized
      }
    }
    if (normalized.startsWith('/api/files/')) {
      const nested = decodeURIComponent(normalized.replace(/^\/api\/files\//, ''))
      const viewUrl = buildViewUrlFromNestedPath(nested, type)
      if (viewUrl) return viewUrl
    }
    return normalized
  }
  const nestedViewUrl = buildViewUrlFromNestedPath(trimmed, type)
  if (nestedViewUrl) return nestedViewUrl
  if (type === 'input') {
    const filenameViewUrl = buildViewUrlFromFilename(trimmed, type)
    if (filenameViewUrl) return filenameViewUrl
  }
  return `${BASE_URL}/api/files/${trimmed}`
}

export const normalizeImageInfo = (value, defaultType = 'output') => {
  if (!value || typeof value !== 'object') return null
  let filename = typeof value.filename === 'string'
    ? value.filename
    : (typeof value.name === 'string' ? value.name : '')
  if (!filename) return null
  
  let subfolder = value.subfolder || ''
  if (filename.includes('/') && !subfolder) {
    const parts = filename.split('/')
    filename = parts.pop()
    subfolder = parts.join('/')
  }
  
  return {
    filename,
    subfolder,
    type: value.type || defaultType
  }
}

export const buildOutputFromResultImages = (value) => {
  if (!Array.isArray(value) || value.length === 0) return null
  const first = value[0]
  if (typeof first === 'string') {
    const firstUrl = first.trim()
    const urls = value
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => normalizeImageUrlString(v, 'output'))
      .filter(Boolean)
    if (!firstUrl) return null
    const normalizedFirstUrl = normalizeImageUrlString(firstUrl, 'output')
    if (!normalizedFirstUrl) return null
    return {
      imageUrl: normalizedFirstUrl,
      apiImageUrl: normalizedFirstUrl,
      resultUrls: urls,
      coverUrl: normalizedFirstUrl
    }
  }
  if (first && typeof first === 'object' && typeof first.filename === 'string') {
    const urls = value
      .filter((v) => v && typeof v === 'object' && typeof v.filename === 'string')
      .map((v) => objgetimgurl({
        filename: v.filename,
        subfolder: v.subfolder || '',
        type: v.type || 'output'
      }))
    const primaryUrl = objgetimgurl({
      filename: first.filename,
      subfolder: first.subfolder || '',
      type: first.type || 'output'
    })
    return {
      imageUrl: primaryUrl,
      apiImageUrl: primaryUrl,
      resultUrls: urls,
      coverUrl: primaryUrl
    }
  }
  return null
}

export const getOutputUrl = (job) => {
  if (!job) return null

  const normalizedCoverUrl = normalizeImageUrlString(job.output?.coverUrl, 'output')
  if (normalizedCoverUrl) return normalizedCoverUrl
  if (Array.isArray(job.output?.resultUrls) && job.output.resultUrls.length > 0) {
    return normalizeImageUrlString(job.output.resultUrls[0], 'output')
  }
  const normalizedImageUrl = normalizeImageUrlString(job.output?.imageUrl, 'output')
  if (normalizedImageUrl) return normalizedImageUrl
  const normalizedApiImageUrl = normalizeImageUrlString(job.output?.apiImageUrl, 'output')
  if (normalizedApiImageUrl) return normalizedApiImageUrl

  if (job.status === 'completed' && job.resultImages?.length > 0) {
    const resultImage = job.resultImages[0]
    if (typeof resultImage === 'string') {
      return normalizeImageUrlString(resultImage, 'output')
    }
    const safe = normalizeImageInfo(resultImage, 'output')
    if (safe) {
      return objgetimgurl(safe)
    }
  }

  const normalizedLegacyUrl = normalizeImageUrlString(job.url, 'output')
  if (normalizedLegacyUrl) return normalizedLegacyUrl
  const normalizedLegacyImageUrl = normalizeImageUrlString(job.imageUrl, 'output')
  if (normalizedLegacyImageUrl) return normalizedLegacyImageUrl
  const normalizedLegacyApiImageUrl = normalizeImageUrlString(job.apiImageUrl, 'output')
  if (normalizedLegacyApiImageUrl) return normalizedLegacyApiImageUrl

  return null
}

export const getOutputUrls = (job) => {
  if (!job) return []

  if (Array.isArray(job.output?.resultUrls) && job.output.resultUrls.length > 0) {
    return job.output.resultUrls.map((value) => normalizeImageUrlString(value, 'output')).filter(Boolean)
  }

  if (job.output?.coverUrl) {
    return [normalizeImageUrlString(job.output.coverUrl, 'output')].filter(Boolean)
  }

  if (Array.isArray(job.resultImages) && job.resultImages.length > 0) {
    const urls = job.resultImages.map((img) => {
      if (typeof img === 'string') {
        return normalizeImageUrlString(img, 'output')
      }
      const safe = normalizeImageInfo(img, 'output')
      if (safe) {
        return objgetimgurl(safe)
      }
      return null
    }).filter(Boolean)
    if (urls.length > 0) return urls
  }

  const single = getOutputUrl(job)
  return single ? [single] : []
}

export const getInputUrl = (job) => {
  if (!job) return null

  const floorplanImageInfo = normalizeImageInfo(job.input?.floorplanImage, 'input')
  if (floorplanImageInfo) return objgetimgurl(floorplanImageInfo)

  const registeredInputUrl = resolveInputAssetUrl(job.input?.floorplanAssetId)
  if (registeredInputUrl) return registeredInputUrl

  const normalizedFloorplanPath = normalizeImageUrlString(job.input?.floorplanPath, 'input')
  if (normalizedFloorplanPath) return normalizedFloorplanPath
  const normalizedStylePath = normalizeImageUrlString(job.input?.stylePath, 'input')
  if (normalizedStylePath) return normalizedStylePath

  const normalizedLegacyFloorplanPath = normalizeImageUrlString(job.floorplanPath, 'input')
  if (normalizedLegacyFloorplanPath) return normalizedLegacyFloorplanPath
  const normalizedLegacyStylePath = normalizeImageUrlString(job.stylePath, 'input')
  if (normalizedLegacyStylePath) return normalizedLegacyStylePath

  if (job.inputImages?.length > 0) {
    const inputImage = job.inputImages[0]
    if (typeof inputImage === 'string') {
      return normalizeImageUrlString(inputImage, 'input')
    }
    if (inputImage && typeof inputImage === 'object' && typeof inputImage.filename === 'string') {
      const safe = {
        filename: inputImage.filename,
        subfolder: inputImage.subfolder || '',
        type: inputImage.type || 'input'
      }
      return objgetimgurl(safe)
    }
  }

  if (job.input?.floorplanFile) return `/uploads/${job.input.floorplanFile}`

  return null
}

export const getReferenceUrl = (job) => {
  if (!job) return null

  const styleImageInfo = normalizeImageInfo(job.input?.styleImage, 'input')
  if (styleImageInfo) return objgetimgurl(styleImageInfo)

  const normalizedStylePath = normalizeImageUrlString(job.input?.stylePath, 'input')
  if (normalizedStylePath) return normalizedStylePath

  const normalizedLegacyStylePath = normalizeImageUrlString(job.stylePath, 'input')
  if (normalizedLegacyStylePath) return normalizedLegacyStylePath

  if (job.inputImages?.length > 1) {
    const referenceImage = job.inputImages[1]
    if (typeof referenceImage === 'string') {
      return normalizeImageUrlString(referenceImage, 'input')
    }
    if (referenceImage && typeof referenceImage === 'object' && typeof referenceImage.filename === 'string') {
      const safe = {
        filename: referenceImage.filename,
        subfolder: referenceImage.subfolder || '',
        type: referenceImage.type || 'input'
      }
      return objgetimgurl(safe)
    }
  }

  if (job.input?.styleFile) return `/uploads/${job.input.styleFile}`

  return null
}
