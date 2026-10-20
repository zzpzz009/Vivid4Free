import { objgetimgurl } from '@/utils/utils.js'
import { normalizeImageInfo, normalizeImageUrlString } from './urlNormalize.js'

const toNodeId = (value) => {
  if (value == null) return null
  return String(value)
}

const getNodeImages = (outputs, nodeId) => {
  if (!outputs || typeof outputs !== 'object' || !nodeId) return []
  const nodeOutput = outputs?.[nodeId] || {}
  const images = Array.isArray(nodeOutput.images) ? nodeOutput.images : []
  if (images.length > 0) {
    return images
  }
  const comparedImages = Array.isArray(nodeOutput.a_images) ? nodeOutput.a_images : []
  return comparedImages
}

const normalizeCandidate = (image) => {
  if (!image) return null
  if (typeof image === 'string') {
    const url = normalizeImageUrlString(image, 'output')
    if (!url) return null
    return { raw: image, url, type: /([?&]|^)type=temp([&#]|$)/i.test(url) ? 'temp' : 'output' }
  }
  const safe = normalizeImageInfo(image, 'output')
  if (!safe) return null
  return { raw: image, url: objgetimgurl(safe), type: safe.type || 'output' }
}

const splitCandidates = (images = []) => {
  const normalized = images.map(normalizeCandidate).filter(Boolean)
  const stable = normalized.filter((item) => item.type !== 'temp')
  const temp = normalized.filter((item) => item.type === 'temp')
  return { stable, temp }
}

const dedupeUrls = (items = []) => Array.from(new Set(items.map((item) => item.url).filter(Boolean)))

export const selectPreferredComfyImage = (outputs, preferredNodeIds = [], options = {}) => {
  const strictPreferred = options?.strictPreferred === true
  const allowTemp = options?.allowTemp === true
  const preferredIds = preferredNodeIds.map(toNodeId).filter(Boolean)
  for (const nodeId of preferredIds) {
    const { stable, temp } = splitCandidates(getNodeImages(outputs, nodeId))
    const selected = stable.at(-1) || (allowTemp ? temp.at(-1) : null)
    if (selected) return selected.raw
  }
  if (strictPreferred && preferredIds.length > 0) {
    return null
  }

  const allImages = Object.values(outputs || {}).flatMap((nodeOutput) => {
    if (Array.isArray(nodeOutput?.images) && nodeOutput.images.length > 0) {
      return nodeOutput.images
    }
    if (Array.isArray(nodeOutput?.a_images) && nodeOutput.a_images.length > 0) {
      return nodeOutput.a_images
    }
    return []
  })
  const { stable, temp } = splitCandidates(allImages)
  return stable.at(-1)?.raw || temp.at(-1)?.raw || null
}

export const selectPreferredComfyResultUrls = (outputs, preferredNodeIds = [], options = {}) => {
  const allowTemp = options?.allowTemp === true
  const strictPreferred = options?.strictPreferred === true
  const preferredIds = preferredNodeIds.map(toNodeId).filter(Boolean)
  for (const nodeId of preferredIds) {
    const { stable, temp } = splitCandidates(getNodeImages(outputs, nodeId))
    const stableUrls = dedupeUrls(stable)
    if (stableUrls.length > 0) return stableUrls
    if (allowTemp) {
      const tempUrls = dedupeUrls(temp)
      if (tempUrls.length > 0) return tempUrls
    }
  }

  if (strictPreferred && preferredIds.length > 0) return []

  const allImages = Object.values(outputs || {}).flatMap((nodeOutput) => {
    if (Array.isArray(nodeOutput?.images) && nodeOutput.images.length > 0) {
      return nodeOutput.images
    }
    if (Array.isArray(nodeOutput?.a_images) && nodeOutput.a_images.length > 0) {
      return nodeOutput.a_images
    }
    return []
  })
  const { stable, temp } = splitCandidates(allImages)
  const stableUrls = dedupeUrls(stable)
  if (stableUrls.length > 0) return stableUrls
  return allowTemp ? dedupeUrls(temp) : []
}
