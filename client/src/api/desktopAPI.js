import { apiRequest } from './apiUtils.js'

/** @typedef {{ signal?: AbortSignal, timeoutMs?: number, retries?: number, retryDelayMs?: number }} RequestOptions */

// Only currently supported desktop HTTP operations belong here. The shared
// request helper owns cancellation, deadlines and read-only retry policy.
export const desktopAPI = {
  /** @param {RequestOptions} [options] */
  capabilities: (options = {}) => apiRequest('/api/desktop/capabilities', { ...options, method: 'GET', cache: 'no-store' }),
  /** @param {RequestOptions} [options] */
  listTasks: (options = {}) => apiRequest('/api/desktop/tasks', { ...options, method: 'GET', cache: 'no-store' }),
  /** @param {string} taskId @param {RequestOptions} [options] */
  getTask: (taskId, options = {}) => apiRequest(`/api/desktop/tasks/${encodeURIComponent(taskId)}`, { ...options, method: 'GET', cache: 'no-store' }),
  /** @param {object} parameters @param {RequestOptions} [options] */
  submitTask: (parameters, options = {}) => apiRequest('/api/desktop/tasks', {
    ...options, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parameters)
  }),
  /** @param {string} taskId @param {RequestOptions} [options] */
  cancelTask: (taskId, options = {}) => apiRequest(`/api/desktop/tasks/${encodeURIComponent(taskId)}/cancel`, { ...options, method: 'POST' }),
  inputImageUrl: filename => `/view?filename=${encodeURIComponent(filename)}&type=input`
}
