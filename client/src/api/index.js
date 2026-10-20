/**
 * Frontend API Module for ArchViz Generator
 * Centralized API client for all backend communications
 * 统一的 API 入口，整合所有 API 模块
 */

// Import API modules
import systemAPI from './systemAPI.js'
import galleryAPI from './galleryAPI.js'
import jobsAPI from './jobsAPI.js'
import resultsAPI from './resultsAPI.js'
import xmAPI from './xmapi.js'

// Simple API configuration
// const BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? import.meta.env.DEV : 'http://localhost:3123')

// API Error class
export class APIError extends Error {
  constructor(message, status, response) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.response = response
  }
}

// Export main API object
export const api = {
  system: systemAPI,
  results: resultsAPI,
  gallery: galleryAPI,
  jobs: jobsAPI,
  xmAPI:xmAPI,
}

// Export individual components for direct import
export { systemAPI } from './systemAPI.js'
export { galleryAPI } from './galleryAPI.js'
export { jobsAPI } from './jobsAPI.js'
export { resultsAPI } from './resultsAPI.js'
export { xmAPI } from './xmapi.js'

// Default export
export default api
