import { computed, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import xmAPI from '@/api/xmapi.js'
import { useToast } from '@/utils/toast.js'
import { resizeImageFileForWorkspace } from '@/utils/workspaceImageResize.js'
import { useAssetStore, useImageStore, useJobStore } from '@/stores'
import { useXMStore } from '@/stores/xmStore.js'

const deriveFileName = (url, fallbackName, mimeType) => {
  const fallback = String(fallbackName || '').trim()
  let candidate = fallback

  if (!candidate) {
    try {
      const parsed = new URL(url, window.location.origin)
      const queryFilename = parsed.searchParams.get('filename')
      if (queryFilename) {
        candidate = decodeURIComponent(queryFilename)
      } else {
        candidate = decodeURIComponent(parsed.pathname.split('/').pop() || '')
      }
    } catch {
      candidate = String(url || '').split('/').pop() || ''
    }
  }

  candidate = String(candidate || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()

  if (!candidate) {
    candidate = 'selected-reference'
  }

  if (!/\.[a-zA-Z0-9]{2,8}$/.test(candidate)) {
    const extFromMime = String(mimeType || '').split('/')[1]?.split('+')[0] || 'jpg'
    candidate = `${candidate}.${extFromMime}`
  }

  return candidate
}

export const useWorkspaceAssetInputs = (options = {}) => {
  const assetStore = useAssetStore()
  const imageStore = useImageStore()
  const jobStore = useJobStore()
  const xm = useXMStore()
  const { success, error, info } = useToast()
  const shouldResizeFile = typeof options.shouldResizeFile === 'function' ? options.shouldResizeFile : () => true

  const { floorplanFile, styleFile } = storeToRefs(assetStore)

  const uploadedReferenceFile = styleFile
  const uploadedImage = computed(() => floorplanFile.value)

  const normalizeUploadedImageInfo = (uploaded) => {
    const filename = String(uploaded?.filename || uploaded?.name || '').trim()
    if (!filename) return null
    return {
      filename,
      subfolder: String(uploaded?.subfolder || '').trim(),
      type: String(uploaded?.type || 'input').trim() || 'input'
    }
  }

  const cacheKey = 'workspace:input-assets'
  const revisions = { dcl: 0, ck: 0 }
  const restoreController = new AbortController()
  const inputViewUrl = (image) => `/view?${new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || '', type: 'input' })}`
  const readCache = () => { try { return JSON.parse(localStorage.getItem(cacheKey) || '{}') || {} } catch { return {} } }
  const saveCachedAsset = (type, image) => {
    try { const cached = readCache(); if (image) cached[type] = image; else delete cached[type]; localStorage.setItem(cacheKey, JSON.stringify(cached)) } catch {}
  }
  onMounted(async () => {
    const cached = readCache()
    for (const type of ['dcl', 'ck']) {
      const image = cached[type]
      if (!image || typeof image.filename !== 'string' || !image.filename || image.filename.length > 256 || /[\\/]/.test(image.filename)) continue
      if (typeof image.subfolder !== 'string' || image.subfolder.includes('..') || image.subfolder.length > 256) continue
      const asset = type === 'dcl' ? floorplanFile : styleFile
      const revision = revisions[type]
      if (asset.value) continue
      try {
        const url = inputViewUrl(image)
        const response = await fetch(url, { signal: restoreController.signal })
        if (!response.ok) continue
        const blob = await response.blob()
        if (!blob.type.startsWith('image/') || blob.size > 10 * 1024 * 1024 || asset.value || revision !== revisions[type]) continue
        const file = new File([blob], image.filename, { type: blob.type })
        asset.value = { file, preview: url, url, name: file.name, size: file.size, type: file.type, comfyImageInfo: image }
        if (type === 'dcl') { await imageStore.setUploadedImageFile(asset.value); xm.savedclimg(image.filename); xm.savedclimgurl(url) }
        else { await imageStore.setUploadedReferenceFile(asset.value); xm.saveckimg(image.filename); xm.saveckimgurl(url) }
      } catch { /* Keep cached metadata for a later retry if the engine is not available. */ }
    }
  })
  onBeforeUnmount(() => restoreController.abort())

  const clearXMAsset = (type, invalidate = true) => {
    if (invalidate) revisions[type] += 1
    saveCachedAsset(type, null)

    if (type === 'dcl') {
      xm.deldcl()
      return
    }
    xm.delck()
  }

  const setAssetByType = (type, file, isCurrent) => {
    if (type === 'dcl') {
      return assetStore.setFloorplanFile(file, isCurrent)
    }
    return assetStore.setStyleFile(file, isCurrent)
  }

  const syncUploadedAsset = async (type, file, revision) => {
    const uploaded = await xmAPI.uploadimgapi(file)
    if (revisions[type] !== revision) return null
    if (!uploaded?.name) {
      return uploaded
    }
    const comfyImageInfo = normalizeUploadedImageInfo(uploaded)
    saveCachedAsset(type, comfyImageInfo)

    if (type === 'dcl') {
      if (floorplanFile.value) {
        floorplanFile.value = {
          ...floorplanFile.value,
          comfyImageInfo
        }
      }
      xm.savedclimg(uploaded.name)
      xm.savedclimgurl(inputViewUrl(comfyImageInfo))
      return uploaded
    }

    if (styleFile.value) {
      styleFile.value = {
        ...styleFile.value,
        comfyImageInfo
      }
    }
    xm.saveckimg(uploaded.name)
    xm.saveckimgurl(inputViewUrl(comfyImageInfo))
    return uploaded
  }

  const buildResizeMessage = (baseMessage, resizeResult) => {
    if (!resizeResult?.resized) {
      return baseMessage
    }
    const { plan } = resizeResult
    return `${baseMessage}，已自动缩放为 ${plan.targetWidth}×${plan.targetHeight}`
  }

  const prepareWorkspaceFile = async (type, file) => {
    if (!(file instanceof File)) {
      return {
        file,
        resized: false
      }
    }

    if (!shouldResizeFile(type, file)) {
      return {
        file,
        resized: false,
        skipped: true
      }
    }

    const resizeResult = await resizeImageFileForWorkspace(type, file, options.preserveOriginalWhenWithinLimits === true)
    if (resizeResult.resized) {
      const { originalWidth, originalHeight, targetWidth, targetHeight } = resizeResult.plan
      info(`图片过大，已自动缩放：${originalWidth}×${originalHeight} → ${targetWidth}×${targetHeight}`)
    }
    return resizeResult
  }

  const handleAssetUpload = async (type, file, successMessage, failureLabel) => {
    const revision = ++revisions[type]
    try {
      const prepared = await prepareWorkspaceFile(type, file)
      if (revisions[type] !== revision) return
      const nextFile = prepared.file
      const result = await setAssetByType(type, nextFile, () => revisions[type] === revision)
      if (revisions[type] !== revision) return
      if (!result.success) {
        error(`${failureLabel}处理失败：${result.error}`)
        return
      }

      if (type === 'dcl') {
        await imageStore.setUploadedImageFile(result.file || nextFile)
      } else {
        await imageStore.setUploadedReferenceFile(result.file || nextFile)
      }

      if (revisions[type] !== revision) return
      clearXMAsset(type, false)
      const uploaded = await syncUploadedAsset(type, nextFile, revision)
      if (revisions[type] !== revision || !uploaded?.name) return
      success(buildResizeMessage(successMessage, prepared))
    } catch {
      if (revisions[type] !== revision) return
      clearXMAsset(type, false)
      error('上传图片失败，请重新上传')
    }
  }

  const handleImageUpload = async (file) => {
    await handleAssetUpload('dcl', file, '平面图已选择', '平面图')
  }

  const handleReferenceUpload = async (file) => {
    await handleAssetUpload('ck', file, '风格参考图已选择', '风格参考图')
  }

  const handleClearImage = async () => {
    clearXMAsset('dcl')
    imageStore.clearImage()
    await assetStore.clearFloorplan()
  }

  const handleClearReference = async () => {
    clearXMAsset('ck')
    imageStore.clearReference()
    await assetStore.clearStyle()
  }

  const handlePromptChange = (newPrompt) => {
    xm.savetsc(newPrompt)
  }

  const handleSizeChange = (newSize) => {
    xm.savesize(newSize)
  }

  const selectimg = async ({ image, type }, fn) => {
    if (!['dcl', 'ck'].includes(type) || !image) return
    const revision = ++revisions[type]
    try {
      const imageUrl = image.url || image.path || image
      jobStore.setStatusMessage('正在加载参考图片...', 'info')

      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }

      const blob = await response.blob()
      if (revisions[type] !== revision) return
      const fileName = deriveFileName(imageUrl, image.name, blob.type)
      const selectedFile = new File([blob], fileName, {
        type: blob.type || 'image/jpeg'
      })
      const prepared = await prepareWorkspaceFile(type, selectedFile)
      if (revisions[type] !== revision) return
      const nextFile = prepared.file

      let assetResult = null
      if (type === 'dcl') {
        assetResult = await assetStore.setFloorplanFile(nextFile, () => revisions[type] === revision)
        if (revisions[type] !== revision || !assetResult.success) return
        await imageStore.setUploadedImageFile(assetResult?.file || nextFile)
      } else if (type === 'ck') {
        assetResult = await assetStore.setStyleFile(nextFile, () => revisions[type] === revision)
        if (revisions[type] !== revision || !assetResult.success) return
        await imageStore.setUploadedReferenceFile(assetResult?.file || nextFile)
      }

      nextFile.preview = imageUrl
      nextFile.url = imageUrl
      nextFile.path = image.path || imageUrl

      if (revisions[type] !== revision) return
      clearXMAsset(type, false)

      let uploaded = null
      try {
        uploaded = await xmAPI.uploadimgapi(nextFile)
        if (revisions[type] !== revision) return
      } catch (uploadErr) {
        if (revisions[type] !== revision) return
        console.error('Reference upload failed:', uploadErr)
        error('图片已选择，但上传到Comfy失败，请重试或更换来源')
        return
      }

      if (!uploaded?.name) {
        return
      }
      const comfyImageInfo = normalizeUploadedImageInfo(uploaded)
      saveCachedAsset(type, comfyImageInfo)
      if (type === 'dcl' && floorplanFile.value) {
        floorplanFile.value = {
          ...floorplanFile.value,
          comfyImageInfo
        }
      }
      if (type === 'ck' && styleFile.value) {
        styleFile.value = {
          ...styleFile.value,
          comfyImageInfo
        }
      }

      success(buildResizeMessage('参考图片选择成功！', prepared))

      if (fn) {
        fn(uploaded)
        return
      }

      if (type === 'dcl') {
        xm.savedclimg(uploaded.name)
        xm.savedclimgurl(inputViewUrl(comfyImageInfo))
        return
      }

      if (type === 'ck') {
        xm.saveckimg(uploaded.name)
        xm.saveckimgurl(inputViewUrl(comfyImageInfo))
      }
    } catch (err) {
      if (revisions[type] !== revision) return
      console.error('Reference selection failed:', err)
      error('参考图片加载失败，请重试')
    }
  }

  return {
    uploadedReferenceFile,
    uploadedImage,
    handleImageUpload,
    handleReferenceUpload,
    handleClearImage,
    handleClearReference,
    handlePromptChange,
    handleSizeChange,
    selectimg
  }
}
