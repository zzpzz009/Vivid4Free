import { normalizeJobStatus, normalizeProgressValue } from './statusNormalize.js'
import { getOutputUrl } from './urlNormalize.js'

export const JOB_STORAGE_KEY = 'archviz-jobs'
const MAX_SNAPSHOT_DATA_URL_LENGTH = 180000

const isCompactSnapshotUrl = (value) => {
  if (typeof value !== 'string') return false
  return value.startsWith('data:image/') && value.length <= MAX_SNAPSHOT_DATA_URL_LENGTH
}

export const isStorageSafeUrl = (value, options = {}) => {
  if (typeof value !== 'string') return value ?? null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:')) {
    return options.allowSnapshotDataUrl && isCompactSnapshotUrl(trimmed) ? trimmed : null
  }
  if (/([?&]|^)type=temp([&#]|$)/i.test(trimmed)) return null
  return trimmed
}

export const compactStorageImage = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    return isStorageSafeUrl(value)
  }
  if (typeof value === 'object') {
    if (value.type === 'temp') return null
    if (typeof value.filename === 'string' && value.filename.trim()) {
      return {
        filename: value.filename,
        subfolder: value.subfolder || '',
        type: value.type || 'output'
      }
    }
  }
  return null
}

export const compactStorageInput = (input) => {
  if (!input || typeof input !== 'object') return input || {}
  return {
    ...input,
    floorplanPath: isStorageSafeUrl(input.floorplanPath),
    stylePath: isStorageSafeUrl(input.stylePath),
    floorplanAssetId: typeof input.floorplanAssetId === 'string' ? input.floorplanAssetId : null,
    floorplanImage: compactStorageImage(input.floorplanImage),
    styleImage: compactStorageImage(input.styleImage),
    floorplanFile: typeof input.floorplanFile === 'string' ? input.floorplanFile : null,
    styleFile: typeof input.styleFile === 'string' ? input.styleFile : null,
    maskFile: typeof input.maskFile === 'string' ? input.maskFile : null,
    wireframeFile: typeof input.wireframeFile === 'string' ? input.wireframeFile : null,
    materialFile: typeof input.materialFile === 'string' ? input.materialFile : null
  }
}

export const compactStorageOutput = (output) => {
  if (!output || typeof output !== 'object') return null
  const resultUrls = Array.isArray(output.resultUrls)
    ? output.resultUrls.map((value) => isStorageSafeUrl(value, { allowSnapshotDataUrl: true })).filter(Boolean)
    : []
  const coverUrl = isStorageSafeUrl(output.coverUrl, { allowSnapshotDataUrl: true })
  const imageUrl = isStorageSafeUrl(output.imageUrl, { allowSnapshotDataUrl: true })
  const apiImageUrl = isStorageSafeUrl(output.apiImageUrl, { allowSnapshotDataUrl: true })
  if (!coverUrl && !imageUrl && !apiImageUrl && resultUrls.length === 0) {
    return null
  }
  return {
    ...output,
    coverUrl,
    imageUrl,
    apiImageUrl,
    resultUrls
  }
}

export const compactJobForStorage = (job) => {
  const resultImages = Array.isArray(job?.resultImages)
    ? job.resultImages.map(compactStorageImage).filter(Boolean)
    : []
  const output = compactStorageOutput(job?.output)
  return {
    ...job,
    input: compactStorageInput(job?.input),
    output,
    resultImages,
    logs: Array.isArray(job?.logs) ? job.logs.slice(-20) : []
  }
}

export const getStorageCandidates = (jobs) => {
  const compactedJobs = (jobs || []).map(compactJobForStorage)
  const recentCompactedJobs = compactedJobs.slice(0, 60)
  const minimalJobs = recentCompactedJobs.map((job) => ({
    ...job,
    logs: []
  }))
  return [compactedJobs, recentCompactedJobs, minimalJobs]
}

export const saveJobsToStorage = (jobs) => {
  let lastError = null
  for (const candidate of getStorageCandidates(jobs)) {
    try {
      localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(candidate))
      return true
    } catch (error) {
      lastError = error
    }
  }
  if (lastError) {
    console.error('Failed to save jobs to localStorage:', lastError)
  }
  return false
}

export const parseJobsFromStorage = (storedData) => {
  if (!storedData) return { jobs: [], progressMap: {} }
  try {
    const jobData = JSON.parse(storedData)
    if (!Array.isArray(jobData) || jobData.length === 0) {
      return { jobs: [], progressMap: {} }
    }
    const normalizedJobs = jobData
      .map((job) => {
        const normalizedJob = {
          ...job,
          status: normalizeJobStatus(job?.status)
        }
        if (normalizedJob.status === 'completed' && !getOutputUrl(normalizedJob)) {
          return null
        }
        return normalizedJob
      })
      .filter(Boolean)
    
    const progressMap = {}
    normalizedJobs.forEach((job) => {
      if (job?.id && Number.isFinite(Number(job.progress))) {
        progressMap[job.id] = normalizeProgressValue(job.progress, 0)
      }
    })
    return { jobs: normalizedJobs, progressMap }
  } catch (error) {
    console.error('Failed to parse jobs from storage data:', error)
    return { jobs: [], progressMap: {} }
  }
}
