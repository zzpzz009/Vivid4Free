import { objgetimgurl } from '@/utils/utils.js'
import { BASE_URL } from '@/api/apiUtils.js'
import config from '@/config/config.js'
import { normalizeJobStatus } from './statusNormalize.js'
import { getOutputUrls, normalizeImageInfo, normalizeImageUrlString } from './urlNormalize.js'
import { selectPreferredComfyResultUrls } from './comfyResultSelection.js'

export const toTimestampMs = (value) => {
  if (!value) return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const normalizeHistoryUrl = (value, defaultType = 'output') => {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return null
    }
    if (/([?&]|^)type=temp([&#]|$)/i.test(trimmed)) {
      return null
    }
    return normalizeImageUrlString(trimmed, defaultType)
  }
  const safe = normalizeImageInfo(value, defaultType)
  if (safe?.type === 'temp') return null
  if (safe) return objgetimgurl(safe)
  return null
}

export const normalizeHistoryItem = (item, fallbackOrigin = 'job') => {
  if (!item || typeof item !== 'object') return null
  const status = normalizeJobStatus(item.status)
  const createdAt = item.createdAt || item.timestamp || item.updatedAt || new Date().toISOString()
  const completedAt = item.completedAt || (status === 'completed' ? createdAt : null)
  const rawResultUrls = Array.isArray(item.output?.resultUrls) && item.output.resultUrls.length > 0
    ? item.output.resultUrls
    : getOutputUrls(item)
  const stableResultUrls = Array.from(new Set((rawResultUrls || []).map((url) => normalizeHistoryUrl(url, 'output')).filter(Boolean)))
  const resultUrls = stableResultUrls
  const coverSource = item.output?.coverUrl || item.output?.imageUrl || item.url || resultUrls[0]
  const coverUrl = normalizeHistoryUrl(coverSource, 'output')
    || resultUrls[0]
  const floorplanPath = normalizeHistoryUrl(item.input?.floorplanPath || item.floorplanPath, 'input')
  const stylePath = normalizeHistoryUrl(item.input?.stylePath || item.stylePath, 'input')
  const floorplanImage = normalizeImageInfo(item.input?.floorplanImage || item.floorplanImage, 'input')
  const styleImage = normalizeImageInfo(item.input?.styleImage || item.styleImage, 'input')
  if (status === 'completed' && !coverUrl && resultUrls.length === 0) return null
  const id = item.id || item.jobId || `${fallbackOrigin}-${createdAt}`
  const workflowId = item.workflowId || item.workflow_id || 'unknown'
  return {
    ...item,
    id: String(id),
    workflowId,
    status,
    createdAt,
    completedAt,
    origin: item.origin || fallbackOrigin,
    input: {
      ...(item.input || {}),
      floorplanPath: floorplanPath || null,
      stylePath: stylePath || null,
      floorplanImage: floorplanImage || null,
      styleImage: styleImage || null
    },
    output: {
      ...(item.output || {}),
      resultUrls,
      coverUrl: coverUrl || null
    },
    timestamp: toTimestampMs(createdAt)
  }
}

export const normalizePendingHistoryItem = (item, fallbackOrigin = 'job') => {
  if (!item || typeof item !== 'object') return null
  if (normalizeJobStatus(item.status) !== 'completed') return null
  if (!item.isPreview && !item.allowTempOutput) return null

  const rawPreviewUrls = Array.isArray(item.output?.resultUrls) && item.output.resultUrls.length > 0
    ? item.output.resultUrls
    : getOutputUrls(item)
  const rawPreviewCover = typeof item.output?.coverUrl === 'string' ? item.output.coverUrl.trim() : ''
  const coverIsEphemeral = rawPreviewCover.startsWith('data:')
    || rawPreviewCover.startsWith('blob:')
    || /([?&]|^)type=temp([&#]|$)/i.test(rawPreviewCover)
  const hasEphemeralPreview = (rawPreviewUrls || []).some((url) => {
    const trimmed = typeof url === 'string' ? url.trim() : ''
    return trimmed.startsWith('data:')
      || trimmed.startsWith('blob:')
      || /([?&]|^)type=temp([&#]|$)/i.test(trimmed)
  }) || coverIsEphemeral
  if (!hasEphemeralPreview) return null

  const createdAt = item.createdAt || item.timestamp || item.updatedAt || new Date().toISOString()
  const completedAt = item.completedAt || createdAt
  const floorplanPath = normalizeHistoryUrl(item.input?.floorplanPath || item.floorplanPath, 'input')
  const stylePath = normalizeHistoryUrl(item.input?.stylePath || item.stylePath, 'input')
  const workflowId = item.workflowId || item.workflow_id || 'unknown'

  return {
    ...item,
    id: String(item.id || item.jobId || `${fallbackOrigin}-${createdAt}`),
    workflowId,
    status: 'archiving',
    createdAt,
    completedAt,
    origin: item.origin || fallbackOrigin,
    pendingHistoryOutput: true,
    stageInfo: item.stageInfo || '等待稳定输出写入历史',
    input: {
      ...(item.input || {}),
      floorplanPath: floorplanPath || null,
      stylePath: stylePath || null
    },
    output: {
      ...(item.output || {}),
      resultUrls: [],
      coverUrl: null
    },
    timestamp: toTimestampMs(createdAt)
  }
}

const getComfyMessageTimestamp = (messages = [], eventName) => {
  if (!Array.isArray(messages)) return 0
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index]
    if (!Array.isArray(entry) || entry[0] !== eventName) continue
    const timestamp = Number(entry?.[1]?.timestamp)
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp
  }
  return 0
}

const getComfyWorkflowInputs = (promptValue) => {
  const workflow = Array.isArray(promptValue) && typeof promptValue?.[2] === 'object' && promptValue?.[2]
    ? promptValue[2]
    : {}
  const loadImages = Object.values(workflow)
    .filter((node) => node && typeof node === 'object' && node.class_type === 'LoadImage')
    .map((node) => node?.inputs?.image)
    .filter((value) => typeof value === 'string' && value.trim())

  const toInputImageInfo = (value) => {
    const normalized = String(value || '').trim().replace(/\\/g, '/')
    if (!normalized) return null
    const parts = normalized.split('/').filter(Boolean)
    const filename = parts.pop() || ''
    if (!filename) return null
    return {
      filename,
      subfolder: parts.join('/'),
      type: 'input'
    }
  }

  return {
    floorplanPath: loadImages[0] || null,
    stylePath: loadImages[1] || null,
    floorplanImage: toInputImageInfo(loadImages[0]),
    styleImage: toInputImageInfo(loadImages[1])
  }
}

const preferredHistoryOutputNodeIds = [
  config?.config?.yl?.output?.img,
  config?.config?.sc?.output?.img,
  config?.config?.outpaint?.output?.img,
  config?.config?.inpaint?.output?.img,
  config?.config?.imageEdit?.output?.img
].filter(Boolean)

const getPromptSaveImageNodeIds = (prompt) => {
  const graph = Array.isArray(prompt) && prompt[2] && typeof prompt[2] === 'object'
    ? prompt[2]
    : {}
  return Object.entries(graph)
    .filter(([, node]) => node?.class_type === 'SaveImage')
    .map(([nodeId]) => nodeId)
}

const getComfyOutputUrls = (outputs, prompt) => {
  const promptOutputNodeIds = getPromptSaveImageNodeIds(prompt)
  const preferredNodeIds = promptOutputNodeIds.length > 0 ? promptOutputNodeIds : preferredHistoryOutputNodeIds
  const preferredUrls = selectPreferredComfyResultUrls(outputs, preferredNodeIds, {
    strictPreferred: promptOutputNodeIds.length > 0
  })
  return preferredUrls
}

const normalizeComfyHistoryPayload = (payload, options = {}) => {
  const source = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload
  if (!source || typeof source !== 'object' || Array.isArray(source)) return []

  const normalized = Object.entries(source)
    .map(([promptId, record], index) => {
      if (!record || typeof record !== 'object') return null
      const messageList = Array.isArray(record?.status?.messages) ? record.status.messages : []
      const createdTs = getComfyMessageTimestamp(messageList, 'execution_start')
      const completedTs = getComfyMessageTimestamp(messageList, 'execution_success')
      const fallbackTs = completedTs || createdTs || (Date.now() - index * 1000)
      const outputUrls = getComfyOutputUrls(record.outputs, record.prompt)
      const comfyStatus = record?.status?.completed === true || record?.status?.status_str === 'success'
        ? 'completed'
        : record?.status?.status_str === 'error'
          ? 'failed'
          : record?.status?.status_str || 'completed'

      const workflowId = 'local-task'

      return normalizeHistoryItem({
        id: promptId,
        jobId: promptId,
        workflowId,
        status: comfyStatus,
        createdAt: new Date(createdTs || fallbackTs).toISOString(),
        completedAt: completedTs ? new Date(completedTs).toISOString() : (comfyStatus === 'completed' ? new Date(fallbackTs).toISOString() : null),
        origin: 'comfy-history',
        stageInfo: '',
        input: getComfyWorkflowInputs(record.prompt),
        output: {
          resultUrls: outputUrls,
          coverUrl: outputUrls[0] || null
        }
      }, 'comfy-history')
    })
    .filter(Boolean)
    .sort((a, b) => toTimestampMs(b.completedAt || b.createdAt || b.timestamp) - toTimestampMs(a.completedAt || a.createdAt || a.timestamp))

  const limit = Number(options?.limit)
  if (Number.isFinite(limit) && limit > 0) {
    return normalized.slice(0, limit)
  }
  return normalized
}

export const normalizeJobsHistoryPayload = (payload, options = {}) => {
  const jobsList = payload?.data?.jobs ?? payload?.jobs ?? payload?.data?.data?.jobs
  if (Array.isArray(jobsList)) {
    const normalizedJobs = jobsList.map((item) => normalizeHistoryItem(item, item?.origin || 'job')).filter(Boolean)
    const limit = Number(options?.limit)
    if (Number.isFinite(limit) && limit > 0) {
      return normalizedJobs.slice(0, limit)
    }
    return normalizedJobs
  }
  return normalizeComfyHistoryPayload(payload, options)
}

export const normalizeLegacyHistoryPayload = (payload) => {
  const list = payload?.data?.images || payload?.images || payload?.data?.data?.images || payload?.data?.records || payload?.data?.list || []
  if (!Array.isArray(list)) return []
  return list.map((item, index) => {
    const normalizedUrl = normalizeHistoryUrl(item?.url || item?.imageUrl || item?.path, 'output')
    if (!normalizedUrl) return null
    const timestamp = item?.timestamp || Date.now() - index * 60000
    return normalizeHistoryItem({
      id: `temp_history_${item?.id ?? index}`,
      status: 'completed',
      createdAt: new Date(timestamp).toISOString(),
      completedAt: new Date(timestamp).toISOString(),
      origin: 'degraded-legacy',
      output: {
        resultUrls: [normalizedUrl],
        coverUrl: normalizedUrl
      },
      url: normalizedUrl
    }, 'degraded-legacy')
  }).filter(Boolean)
}

export const mergeHistoryItems = (sources = []) => {
  const mergedMap = new Map()
  const buildKey = (item, index) => item.id || item.output?.coverUrl || item.output?.resultUrls?.[0] || `${item.origin || 'history'}-${item.createdAt || index}-${index}`
  for (const source of sources) {
    if (!Array.isArray(source)) continue
    source.forEach((item, index) => {
      if (!item) return
      const normalized = normalizeHistoryItem(item, item.origin || 'job')
      if (!normalized) return
      const key = buildKey(normalized, index)
      if (!mergedMap.has(key)) mergedMap.set(key, normalized)
    })
  }
  return Array.from(mergedMap.values()).sort((a, b) => toTimestampMs(b.createdAt || b.timestamp) - toTimestampMs(a.createdAt || a.timestamp))
}
