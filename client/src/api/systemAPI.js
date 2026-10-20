/**
 * System API Module
 * 系统相关的 API 接口
 */

import { apiRequest } from './apiUtils.js'

export const systemAPI = {
  // Health check
  async getHealth() {
    return apiRequest('/health')
  },

  // Network information
  async getNetworkInfo() {
    return apiRequest('/network-info')
  },

  // System status
  async getStatus() {
    return apiRequest('/api/system/status')
  },

  // System info
  async getInfo() {
    return apiRequest('/api/system/info')
  }
}

export default systemAPI
