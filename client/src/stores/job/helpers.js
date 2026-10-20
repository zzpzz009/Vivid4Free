import {
  normalizeJobStatus,
  getStageInfo,
  normalizeProgressValue
} from './statusNormalize.js'

import {
  normalizeImageInfo,
  buildOutputFromResultImages,
  getOutputUrl,
  getOutputUrls,
  getInputUrl,
  getReferenceUrl
} from './urlNormalize.js'

import {
  toTimestampMs,
  normalizeHistoryUrl,
  normalizeHistoryItem,
  normalizeJobsHistoryPayload,
  normalizeLegacyHistoryPayload,
  mergeHistoryItems
} from './resultMapper.js'

export const extractJobsArray = (payload) => {
  const list = payload?.data?.jobs || payload?.jobs || payload?.data?.data?.jobs || []
  return Array.isArray(list) ? list : []
}

export const pickJobId = (item) => {
  if (!item) return null
  if (typeof item.id === 'string' && item.id.trim()) return item.id
  if (typeof item.jobId === 'string' && item.jobId.trim()) return item.jobId
  if (typeof item.id === 'number' && Number.isFinite(item.id)) return String(item.id)
  if (typeof item.jobId === 'number' && Number.isFinite(item.jobId)) return String(item.jobId)
  return null
}

export const createHelpers = (ctx) => {
  const { jobs, historyArchiveItems, progressMap, queuePositionMap } = ctx

  const getDisplayProgressById = (jobId) => {
    if (!jobId) return 0
    const fromMap = progressMap.value?.[jobId]
    if (Number.isFinite(Number(fromMap))) return normalizeProgressValue(fromMap, 0)
    const existing = jobs.find((j) => j?.id === jobId)
    if (existing && Number.isFinite(Number(existing.progress))) return normalizeProgressValue(existing.progress, 0)
    return 0
  }

  return {
    normalizeJobStatus,
    getStageInfo,
    normalizeImageInfo,
    buildOutputFromResultImages,
    getOutputUrl,
    getOutputUrls,
    normalizeProgressValue,
    getDisplayProgressById,
    getInputUrl,
    getReferenceUrl,
    toTimestampMs,
    normalizeHistoryUrl,
    normalizeHistoryItem,
    normalizeJobsHistoryPayload,
    normalizeLegacyHistoryPayload,
    mergeHistoryItems
  }
}
