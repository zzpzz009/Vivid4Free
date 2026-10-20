/**
 * Store Index
 * 统一导出所有 stores
 */

// UI Layer - 纯界面状态
export { useUIStore } from './useUIStore.js'

// Business Layer - 业务逻辑
export { useAssetStore } from './useAssetStore.js'

// Data Layer - 数据管理
export { useJobStore } from './useJobStore.js'
export { useGalleryStore } from './useGalleryStore.js'

// Auth Layer - 认证管理
export { useAuthStore } from './useAuthStore.js'

// Legacy stores (待重构或移除)
export { useImageStore } from './useImageStore.js'
// 项目所用参数
export { useXMStore } from './xmStore.js'