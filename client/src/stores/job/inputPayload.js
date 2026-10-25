import { objgetimgurl } from '@/utils/utils.js'

export const mergeJobInput = (existingInput = {}, nextInput = {}) => ({
  ...existingInput,
  ...nextInput,
  floorplanPath:
    nextInput?.floorplanPath || existingInput?.floorplanPath || null,
  stylePath: nextInput?.stylePath || existingInput?.stylePath || null,
  floorplanAssetId:
    nextInput?.floorplanAssetId || existingInput?.floorplanAssetId || null,
  floorplanImage:
    nextInput?.floorplanImage || existingInput?.floorplanImage || null,
  styleImage: nextInput?.styleImage || existingInput?.styleImage || null
})

export const buildQueuedInputSnapshot = (assetStore, prompt) => ({
  floorplanPath:
    assetStore?.floorplanFile?.preview ||
    assetStore?.floorplanFile?.url ||
    null,
  stylePath:
    assetStore?.styleFile?.preview || assetStore?.styleFile?.url || null,
  prompt: prompt || '建筑可视化预览'
})

export const buildInputPathFromInputImage = (value, defaultType) => {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (
      trimmed.startsWith('http') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('/')
    )
      return trimmed
    return defaultType === 'input'
      ? objgetimgurl({ filename: trimmed, type: defaultType })
      : `/api/files/${trimmed}`
  }
  return typeof value === 'object' && typeof value.filename === 'string'
    ? objgetimgurl({
        filename: value.filename,
        subfolder: value.subfolder || '',
        type: value.type || defaultType
      })
    : null
}
