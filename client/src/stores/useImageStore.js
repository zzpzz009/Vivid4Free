import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImageStore = defineStore('image', () => {
  const cleanupSingleFileUrl = (value) => {
    const nextUrl = value?.url || value?.preview
    if (typeof nextUrl === 'string' && nextUrl.startsWith('blob:')) {
      URL.revokeObjectURL(nextUrl)
    }
  }

  const normalizeSingleFile = (file) => {
    if (!file) return null
    const actualFile = file.file || file
    if (!(actualFile instanceof File)) return file
    const previewUrl = file.preview || file.url || URL.createObjectURL(actualFile)
    return {
      file: actualFile,
      preview: previewUrl,
      url: previewUrl,
      name: file.name || actualFile.name,
      size: file.size || actualFile.size,
      type: file.type || actualFile.type,
      lastModified: file.lastModified || actualFile.lastModified
    }
  }

  // 单图模式 - 当前上传的文件（用于生成）
  const uploadedImageFile = ref(null)
  const uploadedReferenceFile = ref(null)

  // 批量模式 - 多张图片（用于批量处理）
  const uploadedImages = ref([])
  const uploadedReferences = ref([])

  // 当前模式：'single' | 'batch'
  const currentMode = ref('single')

  // Actions 待处理图片处理
  const setUploadedImageFile = async (file) => {
    cleanupSingleFileUrl(uploadedImageFile.value)
    uploadedImageFile.value = normalizeSingleFile(file)
  }

  // 参考图片处理
  const setUploadedReferenceFile = async (file) => {
    cleanupSingleFileUrl(uploadedReferenceFile.value)
    uploadedReferenceFile.value = normalizeSingleFile(file)
  }

  const clearImage = () => {
    cleanupSingleFileUrl(uploadedImageFile.value)
    uploadedImageFile.value = null
  }

  const clearReference = () => {
    cleanupSingleFileUrl(uploadedReferenceFile.value)
    uploadedReferenceFile.value = null
  }

  const clearAll = () => {
    clearImage()
    clearReference()
    uploadedImages.value = []
    uploadedReferences.value = []
  }

  // 批量模式操作
  const setMode = (mode) => {
    currentMode.value = mode
    if (mode === 'single') {
      // 切换到单图模式时清空批量数据
      uploadedImages.value = []
      uploadedReferences.value = []
    } else if (mode === 'batch') {
      // 切换到批量模式时清空单图数据
      clearImage()
      clearReference()
    }
  }

  const addImages = (files) => {
    const processedFiles = files.map(file => {
      const imageUrl = URL.createObjectURL(file)
      return Object.assign(file, {
        id: Date.now() + Math.random(),
        preview: imageUrl,
        url: imageUrl
      })
    })
    uploadedImages.value.push(...processedFiles)
  }

  const addReferences = (files) => {
    const processedFiles = files.map(file => {
      const imageUrl = URL.createObjectURL(file)
      return Object.assign(file, {
        id: Date.now() + Math.random(),
        preview: imageUrl,
        url: imageUrl
      })
    })
    uploadedReferences.value.push(...processedFiles)
  }

  const removeImage = (index) => {
    if (index >= 0 && index < uploadedImages.value.length) {
      const file = uploadedImages.value[index]
      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url)
      }
      uploadedImages.value.splice(index, 1)
    }
  }

  const removeReference = (index) => {
    if (index >= 0 && index < uploadedReferences.value.length) {
      const file = uploadedReferences.value[index]
      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url)
      }
      uploadedReferences.value.splice(index, 1)
    }
  }

  const clearImages = () => {
    uploadedImages.value.forEach(file => {
      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url)
      }
    })
    uploadedImages.value = []
  }

  const clearReferences = () => {
    uploadedReferences.value.forEach(file => {
      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url)
      }
    })
    uploadedReferences.value = []
  }

  // API 集成函数已移除 - 现在使用 AssetStore 进行文件管理
  // 上传功能现在在 JobStore 的生成流程中统一处理

  // Getters
  const hasUploadedImage = () => {
    if (currentMode.value === 'single') {
      return uploadedImageFile.value !== null
    } else {
      return uploadedImages.value.length > 0
    }
  }

  const hasUploadedReference = () => {
    if (currentMode.value === 'single') {
      return uploadedReferenceFile.value !== null
    } else {
      return uploadedReferences.value.length > 0
    }
  }

  const canGenerate = () => hasUploadedImage() && hasUploadedReference()

  const canPreview = () => {
    if (currentMode.value === 'single') {
      return uploadedImageFile.value !== null && uploadedReferenceFile.value !== null
    } else {
      return uploadedImages.value.length > 0 && uploadedReferences.value.length > 0
    }
  }

  // 获取当前有效的图片和参考图
  const getCurrentImages = () => {
    if (currentMode.value === 'single') {
      return uploadedImageFile.value ? [uploadedImageFile.value] : []
    } else {
      return uploadedImages.value
    }
  }

  const getCurrentReferences = () => {
    if (currentMode.value === 'single') {
      return uploadedReferenceFile.value ? [uploadedReferenceFile.value] : []
    } else {
      return uploadedReferences.value
    }
  }

  return {
    // State
    uploadedImageFile,
    uploadedReferenceFile,
    uploadedImages,
    uploadedReferences,
    currentMode,

    // Single mode actions
    setUploadedImageFile,
    setUploadedReferenceFile,
    clearImage,
    clearReference,
    clearAll,

    // Batch mode actions
    setMode,
    addImages,
    addReferences,
    removeImage,
    removeReference,
    clearImages,
    clearReferences,

    // API Actions - 已移除，现在使用 AssetStore + JobStore 架构

    // Getters
    hasUploadedImage,
    hasUploadedReference,
    canGenerate,
    canPreview,
    getCurrentImages,
    getCurrentReferences
  }
})
