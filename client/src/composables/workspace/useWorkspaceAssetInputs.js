import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import xmAPI from '@/api/xmapi.js'
import { useToast } from '@/utils/toast.js'
import { resizeImageFileForWorkspace } from '@/utils/workspaceImageResize.js'
import { useAssetStore, useImageStore, useJobStore } from '@/stores'
import { useXMStore } from '@/stores/xmStore.js'

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (event) => resolve(event.target.result)
  reader.onerror = (err) => reject(err)
  reader.readAsDataURL(file)
})

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

  const clearXMAsset = (type) => {
    if (type === 'dcl') {
      xm.deldcl()
      return
    }
    xm.delck()
  }

  const setAssetByType = (type, file) => {
    if (type === 'dcl') {
      return assetStore.setFloorplanFile(file)
    }
    return assetStore.setStyleFile(file)
  }

  const syncUploadedAsset = async (type, file) => {
    const uploaded = await xmAPI.uploadimgapi(file)
    if (!uploaded?.name) {
      return uploaded
    }
    const comfyImageInfo = normalizeUploadedImageInfo(uploaded)

    const base64 = await fileToBase64(file)
    if (type === 'dcl') {
      if (floorplanFile.value) {
        floorplanFile.value = {
          ...floorplanFile.value,
          comfyImageInfo
        }
      }
      xm.savedclimg(uploaded.name)
      xm.savedclimgurl(base64)
      return uploaded
    }

    if (styleFile.value) {
      styleFile.value = {
        ...styleFile.value,
        comfyImageInfo
      }
    }
    xm.saveckimg(uploaded.name)
    xm.saveckimgurl(base64)
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

    const resizeResult = await resizeImageFileForWorkspace(type, file)
    if (resizeResult.resized) {
      const { originalWidth, originalHeight, targetWidth, targetHeight } = resizeResult.plan
      info(`图片过大，已自动缩放：${originalWidth}×${originalHeight} → ${targetWidth}×${targetHeight}`)
    }
    return resizeResult
  }

  const handleAssetUpload = async (type, file, successMessage, failureLabel) => {
    try {
      const prepared = await prepareWorkspaceFile(type, file)
      const nextFile = prepared.file
      const result = await setAssetByType(type, nextFile)
      if (!result.success) {
        error(`${failureLabel}处理失败：${result.error}`)
        return
      }

      if (type === 'dcl') {
        await imageStore.setUploadedImageFile(result.file || nextFile)
      } else {
        await imageStore.setUploadedReferenceFile(result.file || nextFile)
      }

      clearXMAsset(type)
      await syncUploadedAsset(type, nextFile)
      success(buildResizeMessage(successMessage, prepared))
    } catch {
      clearXMAsset(type)
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
    xm.deldcl()
    await assetStore.clearFloorplan()
  }

  const handleClearReference = async () => {
    xm.delck()
    await assetStore.clearStyle()
  }

  const handlePromptChange = (newPrompt) => {
    xm.savetsc(newPrompt)
  }

  const handleSizeChange = (newSize) => {
    xm.savesize(newSize)
  }

  const selectimg = async ({ image, type }, fn) => {
    try {
      const imageUrl = image.url || image.path || image
      jobStore.setStatusMessage('正在加载参考图片...', 'info')

      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }

      const blob = await response.blob()
      const fileName = deriveFileName(imageUrl, image.name, blob.type)
      const selectedFile = new File([blob], fileName, {
        type: blob.type || 'image/jpeg'
      })
      const prepared = await prepareWorkspaceFile(type, selectedFile)
      const nextFile = prepared.file

      let assetResult = null
      if (type === 'dcl') {
        assetResult = await assetStore.setFloorplanFile(nextFile)
        await imageStore.setUploadedImageFile(assetResult?.file || nextFile)
      } else if (type === 'ck') {
        assetResult = await assetStore.setStyleFile(nextFile)
        await imageStore.setUploadedReferenceFile(assetResult?.file || nextFile)
      }

      nextFile.preview = imageUrl
      nextFile.url = imageUrl
      nextFile.path = image.path || imageUrl

      clearXMAsset(type)

      let uploaded = null
      try {
        uploaded = await xmAPI.uploadimgapi(nextFile)
      } catch (uploadErr) {
        console.error('Reference upload failed:', uploadErr)
        error('图片已选择，但上传到Comfy失败，请重试或更换来源')
        return
      }

      if (!uploaded?.name) {
        return
      }
      const comfyImageInfo = normalizeUploadedImageInfo(uploaded)
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

      const base64 = await fileToBase64(nextFile)
      if (type === 'dcl') {
        xm.savedclimg(uploaded.name)
        xm.savedclimgurl(base64)
        return
      }

      if (type === 'ck') {
        xm.saveckimg(uploaded.name)
        xm.saveckimgurl(base64)
      }
    } catch (err) {
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
