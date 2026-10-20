/**
 * Results API Module
 * 结果管理相关的 API 接口
 */

import { apiRequest, apiGet, apiPut, apiDelete, apiBlobRequest } from './apiUtils.js'

export const resultsAPI = {
  // Get all results with pagination
  async getResults(page = 1, limit = 20) {
    return apiGet('/api/results', { page, limit })
  },

  // Get latest result
  async getLatest() {
    return apiRequest('/api/results/latest')
  },

  // Get specific result
  async getResult(id) {
    return apiRequest(`/api/results/${id}`)
  },

  // Get result image
  async getResultImage(id) {
    return apiBlobRequest(`/api/results/${id}/image`)
  },

  // Delete result
  async deleteResult(id) {
    return apiDelete(`/api/results/${id}`)
  },

  // Get result metadata
  async getResultMetadata(id) {
    return apiRequest(`/api/results/${id}/metadata`)
  },

  // Update result metadata
  async updateResultMetadata(id, metadata) {
    return apiPut(`/api/results/${id}/metadata`, metadata)
  },

  // Download result
  async downloadResult(id) {
    return apiBlobRequest(`/api/results/${id}/download`)
  },

  // Get results by job ID
  async getResultsByJobId(jobId) {
    return apiRequest(`/api/results/job/${jobId}`)
  },

  // Get results statistics
  async getResultsStats() {
    return apiRequest('/api/results/stats')
  }
}

export default resultsAPI
