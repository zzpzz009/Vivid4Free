/**
 * API Utilities
 * 共享的 API 工具函数和配置
 */

import { warning } from '@/utils/toast.js'
// console.log('import.meta.env.VITE_API_BASE_URL:',import.meta.env.VITE_API_BASE_URL)
// API Configuration
export const BASE_URL = ''
export const BASE2_URL = ''

export const BASE_BDURL = ''

export const COMFY_URL = ''

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

const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504])

async function request(endpoint, options, consume) {
  const {
    signal,
    timeoutMs,
    retries = 1,
    retryDelayMs = 300,
    ...init
  } = options
  const method = (init.method || 'GET').toUpperCase()
  const readOnly = method === 'GET' || method === 'HEAD'
  const attempts = readOnly ? Math.min(2, Math.max(0, Number(retries) || 0)) : 0
  const controller = new AbortController()
  const cancel = () => controller.abort(signal.reason)
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  const duration =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : readOnly
        ? 15000
        : 150000
  const timer = setTimeout(
    () =>
      controller.abort(new DOMException('请求超时，请重试', 'TimeoutError')),
    duration
  )
  try {
    for (let attempt = 0; ; attempt++) {
      controller.signal.throwIfAborted()
      try {
        const response = await fetch(`${endpoint}`, {
          ...init,
          signal: controller.signal
        })
        if (
          readOnly &&
          RETRYABLE_STATUS.has(response.status) &&
          attempt < attempts
        ) {
          await response.body?.cancel()
        } else {
          return await consume(response)
        }
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason
        if (!readOnly || attempt >= attempts || !(error instanceof TypeError))
          throw error
      }
      await new Promise((resolve, reject) => {
        const abort = () => {
          clearTimeout(delay)
          reject(controller.signal.reason)
        }
        const delay = setTimeout(
          () => {
            controller.signal.removeEventListener('abort', abort)
            resolve()
          },
          Math.max(0, retryDelayMs)
        )
        controller.signal.addEventListener('abort', abort, { once: true })
        if (controller.signal.aborted) abort()
      })
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}

async function requireSuccess(endpoint, response) {
  if (!response.ok) {
    if (endpoint === '/api/upload/image') {
      warning('上传图片失败，请重新上传')
    }
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

// The deadline includes reading the response body and all read-only retries.
export async function apiRequest(endpoint, options = {}) {
  const headers =
    options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers }
  return request(endpoint, { ...options, headers }, async (response) => {
    await requireSuccess(endpoint, response)
    try {
      const text = await response.text()
      if (!text) return {} // 如果响应体为空，返回空对象而不是尝试解析 JSON
      return JSON.parse(text)
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError')
        throw error
      throw new APIError(`JSON Parse Error: ${error.message}`, 500, response)
    }
  })
}

// Fetch wrapper for blob responses (images, files)
export async function apiBlobRequest(endpoint, options = {}) {
  return request(`${BASE_URL}${endpoint}`, options, async (response) => {
    await requireSuccess(endpoint, response)
    return response.blob()
  })
}

// Helper for building query strings
export function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams()

  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      searchParams.append(key, params[key])
    }
  })

  return searchParams.toString()
}

// Helper for GET requests with query parameters
export async function apiGet(endpoint, params = {}, options = {}) {
  const queryString = buildQueryString(params)
  const url = queryString ? `${endpoint}?${queryString}` : endpoint
  return apiRequest(url, options)
}

// Helper for POST requests
export async function apiPost(endpoint, data = null, options = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
    ...options,
    headers:
      data instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers }
  })
}

// Helper for PUT requests
export async function apiPut(endpoint, data = null, options = {}) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: data instanceof FormData ? data : JSON.stringify(data),
    ...options,
    headers:
      data instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers }
  })
}

// Helper for DELETE requests
export async function apiDelete(endpoint, options = {}) {
  return apiRequest(endpoint, {
    method: 'DELETE',
    ...options
  })
}
