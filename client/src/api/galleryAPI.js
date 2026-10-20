/**
 * Gallery API Module
 * 图库相关的 API 接口
 */

import { apiRequest, apiPost, apiPut, apiDelete, apiGet, apiBlobRequest, BASE_URL } from './apiUtils.js'

export const galleryAPI = {
  // Get all categories
  async getCategories() {
    return apiRequest('/api/gallery/categories')
  },

  // Create new category
  async createCategory(categoryData) {
    return apiPost('/api/gallery/categories', categoryData)
  },

  // Update category
  async updateCategory(categoryId, updates) {
    return apiPut(`/api/gallery/categories/${categoryId}`, updates)
  },

  // Delete category
  async deleteCategory(categoryId) {
    return apiDelete(`/api/gallery/categories/${categoryId}`)
  },

  // Get category details
  async getCategory(categoryId) {
    return apiRequest(`/api/gallery/categories/${categoryId}`)
    // return apiRequest(`/bd/img/images`)
  },

  // Get images in category
  async getCategoryImages(categoryId, params = {}) {
    return apiGet(`/api/gallery/images/${categoryId}`, params)
  },

  // Upload image to category
  async uploadImage(categoryId, file, metadata = {}) {
    const formData = new FormData()
    formData.append('image', file)

    if (metadata.tags) {
      formData.append('tags', JSON.stringify(metadata.tags))
    }
    if (metadata.description) {
      formData.append('description', metadata.description)
    }

    return apiPost(`/api/gallery/images/${categoryId}`, formData)
  },

  // Search images
  async searchImages(params = {}) {
    return apiGet('/api/gallery/search', params)
  },

  // Get image file
  async getImageFile(categoryId, filename) {
    return apiBlobRequest(`/api/gallery/image/${categoryId}/${filename}`)
  },

  // Get image details
  async getImage(imageId) {
    return apiRequest(`/api/gallery/images/details/${imageId}`)
  },

  // Update image metadata
  async updateImage(imageId, updates) {
    return apiPut(`/api/gallery/images/details/${imageId}`, updates)
  },

  // Delete image
  async deleteImage(imageId) {
    return apiDelete(`/api/gallery/images/details/${imageId}`)
  },

  // Get gallery statistics
  async getStats() {
    return apiRequest('/api/gallery/stats')
  },

  // Legacy compatibility methods
  async getFolders() {
    const response = await this.getCategories()
    return {
      success: response.success,
      folders: response.data?.map(category => ({
        name: category.id,
        displayName: category.name,
        imageCount: category.imageCount,
        path: category.id
      })) || []
    }
  },

  async getFolderImages(folderId) {
    const response = await this.getCategoryImages(folderId)
    return {
      success: response.success,
      images: response.data?.images?.map(image => ({
        name: image.originalName,
        path: image.id,
        url: `/api/gallery/image/${image.categoryId}/${image.filename}`,
        thumbnail: image.thumbnailPath ? `/api/gallery/image/${image.categoryId}/${image.filename}` : null
      })) || []
    }
  },

  // Get usage statistics (for favorites)
  async getUsage() {
    return apiRequest('/api/gallery/usage')
  },

  // Save usage statistics (for favorites)
  async saveUsage(usageData) {
    return apiPost('/api/gallery/usage', usageData)
  },

  // Get usage stats summary (for favorites)
  async getUsageStats() {
    return apiRequest('/api/gallery/usage/stats')
  }
}

export default galleryAPI
