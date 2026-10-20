/**
 * Asset Store
 * 资源管理 Store - 负责图片、文件等资源的状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 文件处理工具函数
const createEnhancedFile = (file) => {
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file object')
  }

  const imageUrl = URL.createObjectURL(file)

  return {
    file: file,
    preview: imageUrl,
    url: imageUrl,
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified
  }
}

const validateFile = (file, options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    maxSize = 10 * 1024 * 1024,
    required = true
  } = options

  if (!file) {
    return {
      valid: !required,
      error: required ? '请选择文件' : null
    }
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `不支持的文件类型。支持的类型：${allowedTypes.join(', ')}`
    }
  }

  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    return {
      valid: false,
      error: `文件大小超过限制（最大 ${maxSizeMB}MB）`
    }
  }

  return { valid: true, error: null }
}

const processFileUpload = async (file, options = {}) => {
  try {
    const validation = validateFile(file, options)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    const enhancedFile = createEnhancedFile(file)
    return {
      success: true,
      file: enhancedFile,
      error: null
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      file: null
    }
  }
}

const cleanupFileUrl = (fileOrUrl) => {
  try {
    if (typeof fileOrUrl === 'string') {
      URL.revokeObjectURL(fileOrUrl)
    } else if (fileOrUrl && fileOrUrl.url) {
      URL.revokeObjectURL(fileOrUrl.url)
    } else if (fileOrUrl && fileOrUrl.preview) {
      URL.revokeObjectURL(fileOrUrl.preview)
    }
  } catch (error) {
    console.warn('Failed to cleanup file URL:', error)
  }
}

const cleanupFileUrls = (files) => {
  if (Array.isArray(files)) {
    files.forEach(file => cleanupFileUrl(file))
  }
}

export const useAssetStore = defineStore('asset', () => {
  // ===== 单图模式状态 =====
  const floorplanFile = ref(null)
  const styleFile = ref(null)
  const maskFile = ref(null)

  // ===== 批量模式状态 =====
  const floorplanFiles = ref([])
  const styleFiles = ref([])

  // ===== 高级参数文件 =====
  const wireframeFile = ref(null)
  const materialFile = ref(null)

  // ===== 模式管理 =====
  const currentMode = ref('single') // 'single' | 'batch'

  // ===== Computed =====
  const hasFloorplan = computed(() => {
    return currentMode.value === 'single' 
      ? !!floorplanFile.value 
      : floorplanFiles.value.length > 0
  })

  const hasStyle = computed(() => {
    return currentMode.value === 'single' 
      ? !!styleFile.value 
      : styleFiles.value.length > 0
  })

  const hasMask = computed(() => !!maskFile.value)

  const canGenerate = computed(() => {
    if (currentMode.value === 'single') {
      return hasFloorplan.value && hasStyle.value
    } else {
      return floorplanFiles.value.length > 0 && 
             styleFiles.value.length > 0 && 
             floorplanFiles.value.length === styleFiles.value.length
    }
  })

  const getCurrentAssets = computed(() => {
    if (currentMode.value === 'single') {
      return {
        floorplans: floorplanFile.value ? [floorplanFile.value] : [],
        styles: styleFile.value ? [styleFile.value] : [],
        mask: maskFile.value,
        wireframe: wireframeFile.value,
        material: materialFile.value
      }
    } else {
      return {
        floorplans: floorplanFiles.value,
        styles: styleFiles.value,
        mask: null,
        wireframe: wireframeFile.value,
        material: materialFile.value
      }
    }
  })

  // ===== Actions =====

  // 模式切换
  const setMode = (mode) => {
    if (mode !== currentMode.value) {
      // 切换模式时清空当前资源
      clearAll()
      currentMode.value = mode
    }
  }

  // 单图模式 - 设置文件
  const setFloorplanFile = async (file, isCurrent = () => true) => {
    if (!isCurrent()) return { success: false, cancelled: true }
    if (!file) {
      floorplanFile.value = null
      return { success: true }
    }

    const result = await processFileUpload(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxSize: 10 * 1024 * 1024
    })

    if (!isCurrent()) {
      if (result.file) cleanupFileUrl(result.file)
      return { success: false, cancelled: true }
    }
    if (result.success) {
      // 清理旧文件URL
      if (floorplanFile.value) {
        cleanupFileUrl(floorplanFile.value)
      }
      floorplanFile.value = result.file
    }

    return result
  }

  const setStyleFile = async (file, isCurrent = () => true) => {
    if (!isCurrent()) return { success: false, cancelled: true }
    if (!file) {
      styleFile.value = null
      return { success: true }
    }

    const result = await processFileUpload(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxSize: 10 * 1024 * 1024
    })

    if (!isCurrent()) {
      if (result.file) cleanupFileUrl(result.file)
      return { success: false, cancelled: true }
    }
    if (result.success) {
      // 清理旧文件URL
      if (styleFile.value) {
        cleanupFileUrl(styleFile.value)
      }
      styleFile.value = result.file
    }

    return result
  }

  const setMaskFile = async (file) => {
    if (!file) {
      maskFile.value = null
      return { success: true }
    }

    const result = await processFileUpload(file, {
      allowedTypes: ['image/png'], // 蒙版通常是PNG
      maxSize: 10 * 1024 * 1024
    })

    if (result.success) {
      // 清理旧文件URL
      if (maskFile.value) {
        cleanupFileUrl(maskFile.value)
      }
      maskFile.value = result.file
    }

    return result
  }

  // 高级参数文件
  const setWireframeFile = async (file) => {
    if (!file) {
      wireframeFile.value = null
      return { success: true }
    }

    const result = await processFileUpload(file)
    if (result.success) {
      if (wireframeFile.value) {
        cleanupFileUrl(wireframeFile.value)
      }
      wireframeFile.value = result.file
    }
    return result
  }

  const setMaterialFile = async (file) => {
    if (!file) {
      materialFile.value = null
      return { success: true }
    }

    const result = await processFileUpload(file)
    if (result.success) {
      if (materialFile.value) {
        cleanupFileUrl(materialFile.value)
      }
      materialFile.value = result.file
    }
    return result
  }

  // 批量模式 - 添加文件
  const addFloorplanFiles = async (files) => {
    const results = []
    for (const file of files) {
      const result = await processFileUpload(file)
      if (result.success) {
        floorplanFiles.value.push(result.file)
      }
      results.push(result)
    }
    return results
  }

  const addStyleFiles = async (files) => {
    const results = []
    for (const file of files) {
      const result = await processFileUpload(file)
      if (result.success) {
        styleFiles.value.push(result.file)
      }
      results.push(result)
    }
    return results
  }

  // 批量模式 - 添加单个文件
  const addFloorplanFile = async (file) => {
    const result = await processFileUpload(file)
    if (result.success) {
      floorplanFiles.value.push(result.file)
    }
    return result
  }

  const addStyleFile = async (file) => {
    const result = await processFileUpload(file)
    if (result.success) {
      styleFiles.value.push(result.file)
    }
    return result
  }

  // 移除文件
  const removeFloorplanFile = (index) => {
    if (currentMode.value === 'batch' && floorplanFiles.value[index]) {
      cleanupFileUrl(floorplanFiles.value[index])
      floorplanFiles.value.splice(index, 1)
    }
  }

  const removeStyleFile = (index) => {
    if (currentMode.value === 'batch' && styleFiles.value[index]) {
      cleanupFileUrl(styleFiles.value[index])
      styleFiles.value.splice(index, 1)
    }
  }

  // 清空操作
  const clearFloorplan = () => {
    if (currentMode.value === 'single') {
      if (floorplanFile.value) {
        cleanupFileUrl(floorplanFile.value)
        floorplanFile.value = null
      }
    } else {
      cleanupFileUrls(floorplanFiles.value)
      floorplanFiles.value = []
    }
  }

  const clearStyle = () => {
    if (currentMode.value === 'single') {
      if (styleFile.value) {
        cleanupFileUrl(styleFile.value)
        styleFile.value = null
      }
    } else {
      cleanupFileUrls(styleFiles.value)
      styleFiles.value = []
    }
  }

  const clearMask = () => {
    if (maskFile.value) {
      cleanupFileUrl(maskFile.value)
      maskFile.value = null
    }
  }

  const clearAdvancedFiles = () => {
    if (wireframeFile.value) {
      cleanupFileUrl(wireframeFile.value)
      wireframeFile.value = null
    }
    if (materialFile.value) {
      cleanupFileUrl(materialFile.value)
      materialFile.value = null
    }
  }

  // 批量模式 - 清空文件数组
  const clearFloorplanFiles = () => {
    cleanupFileUrls(floorplanFiles.value)
    floorplanFiles.value = []
  }

  const clearStyleFiles = () => {
    cleanupFileUrls(styleFiles.value)
    styleFiles.value = []
  }

  const clearAll = () => {
    clearFloorplan()
    clearStyle()
    clearMask()
    clearAdvancedFiles()
  }

  return {
    // State
    floorplanFile,
    styleFile,
    maskFile,
    floorplanFiles,
    styleFiles,
    wireframeFile,
    materialFile,
    currentMode,

    // Computed
    hasFloorplan,
    hasStyle,
    hasMask,
    canGenerate,
    getCurrentAssets,

    // Actions
    setMode,
    setFloorplanFile,
    setStyleFile,
    setMaskFile,
    setWireframeFile,
    setMaterialFile,
    addFloorplanFiles,
    addStyleFiles,
    addFloorplanFile,
    addStyleFile,
    removeFloorplanFile,
    removeStyleFile,
    clearFloorplan,
    clearStyle,
    clearFloorplanFiles,
    clearStyleFiles,
    clearMask,
    clearAdvancedFiles,
    clearAll
  }
})

export default useAssetStore
