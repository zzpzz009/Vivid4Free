/**
 * API Utilities
 * 共享的 API 工具函数和配置
 */

import {warning} from '@/utils/toast.js'
// console.log('import.meta.env.VITE_API_BASE_URL:',import.meta.env.VITE_API_BASE_URL)
// API Configuration
export const BASE_URL = ''
export const BASE2_URL = ''
export const WS_URL = ''

export const BASE_BDURL = ''

export const COMFY_URL = '/comfy'
export const COMFY_WS_URL = '/comfy'


// Gallery Configuration (从 config/gallery.js 合并的实际使用部分)
export const GALLERY_CONFIG = {
  usage: {
    topImagesCount: 20
  }
}

// API Error class
export class APIError extends Error {
  constructor(message, status, response) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.response = response
  }
}

// Simple fetch wrapper for JSON requests
export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  
  if (!response.ok) {
    if(endpoint === '/api/upload/image'){
      warning('上传图片失败，请重新上传')
    } else {
      // 尝试解析错误信息，但不抛出 json 解析异常
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errData = await response.clone().json()
        if (errData && errData.error) {
          errorMsg = errData.error
        }
      } catch (e) {
        try {
          const text = await response.clone().text()
          if (text) errorMsg = `HTTP ${response.status}: ${text.slice(0, 100)}`
        } catch (e2) {
          errorMsg = `HTTP ${response.status}: ${response.statusText}`
        }
      }
      throw new APIError(errorMsg, response.status, response)
    }
  }
  
  try {
    const text = await response.text()
    if (!text) return {} // 如果响应体为空，返回空对象而不是尝试解析 JSON
    return JSON.parse(text)
  } catch (error) {
    throw new APIError(`JSON Parse Error: ${error.message}`, 500, response)
  }
}

// Fetch wrapper for blob responses (images, files)
export async function apiBlobRequest(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, options)
  
  if (!response.ok) {
    throw new APIError(`HTTP ${response.status}: ${response.statusText}`, response.status, response)
  }
  
  return response.blob()
}

// Helper for building query strings
export function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams()
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      searchParams.append(key, params[key])
    }
  })
  
  return searchParams.toString()
}

// Helper for GET requests with query parameters
export async function apiGet(endpoint, params = {}) {
  const queryString = buildQueryString(params)
  const url = queryString ? `${endpoint}?${queryString}` : endpoint
  return apiRequest(url)
}

// Helper for POST requests
export async function apiPost(endpoint, data = null, options = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
    ...options,
    headers: data instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers }
  })
}

// Helper for PUT requests
export async function apiPut(endpoint, data = null, options = {}) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: data instanceof FormData ? data : JSON.stringify(data),
    ...options,
    headers: data instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers }
  })
}

// Helper for DELETE requests
export async function apiDelete(endpoint, options = {}) {
  return apiRequest(endpoint, {
    method: 'DELETE',
    ...options
  })
}
