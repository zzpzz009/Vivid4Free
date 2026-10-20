import { ref, computed } from 'vue'
import { GALLERY_CONFIG } from '../api/apiUtils.js'
import api from '../api/index.js'

// Global state for image usage tracking
const imageUsage = ref({})
const isLoading = ref(false)

// Load usage data from server
const loadUsageData = async () => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    // const result = await api.gallery.getUsage()

    // if (result.success) {
    //   imageUsage.value = result.data || {}
    // } else {
    //   console.warn('Usage data endpoint not available:', result.error)
    //   imageUsage.value = {}
    // }
  } catch (error) {
    console.warn('Usage data endpoint not available, using fallback:', error.message)
    imageUsage.value = {}
  } finally {
    isLoading.value = false
  }
}

// Save usage data to server
const saveUsageData = async () => {
  try {
    const result = await api.gallery.saveUsage(imageUsage.value)
    if (!result.success) {
      console.error('Error saving usage data:', result.error)
    }
  } catch (error) {
    console.error('Error saving image usage data:', error)
  }
}

// Initialize usage data on first import
loadUsageData()

export function useImageUsage() {
  const incrementUsage = async (imagePath) => {
    if (!imagePath) return

    const currentUsage = imageUsage.value[imagePath] || {
      count: 0,
      lastUsed: null,
      firstUsed: null
    }

    const now = new Date().toISOString()

    imageUsage.value[imagePath] = {
      count: currentUsage.count + 1,
      lastUsed: now,
      firstUsed: currentUsage.firstUsed || now
    }

    await saveUsageData()
  }

  const getImageUsage = (imagePath) => {
    if (!imagePath) return 0
    return imageUsage.value[imagePath]?.count || 0
  }

  const getImageLastUsed = (imagePath) => {
    if (!imagePath) return null
    return imageUsage.value[imagePath]?.lastUsed || null
  }

  const getTopUsedImages = (count = GALLERY_CONFIG.usage.topImagesCount) => {
    const usageEntries = Object.entries(imageUsage.value)
      .map(([path, data]) => ({
        path,
        count: data.count,
        lastUsed: data.lastUsed,
        firstUsed: data.firstUsed
      }))
      .sort((a, b) => {
        // Sort by usage count (descending), then by last used (descending)
        if (b.count !== a.count) {
          return b.count - a.count
        }
        return new Date(b.lastUsed) - new Date(a.lastUsed)
      })
      .slice(0, count)
    
    return usageEntries
  }

  const getRecentlyUsedImages = (count = GALLERY_CONFIG.usage.topImagesCount) => {
    const usageEntries = Object.entries(imageUsage.value)
      .map(([path, data]) => ({
        path,
        count: data.count,
        lastUsed: data.lastUsed,
        firstUsed: data.firstUsed
      }))
      .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
      .slice(0, count)
    
    return usageEntries
  }

  const clearUsageData = async () => {
    try {
      const response = await fetch('/api/gallery/usage', {
        method: 'DELETE'
      })

      const result = await response.json()
      if (result.success) {
        imageUsage.value = {}
      } else {
        console.error('Error clearing usage data:', result.error)
      }
    } catch (error) {
      console.error('Error clearing usage data:', error)
    }
  }

  const removeImageUsage = async (imagePath) => {
    if (imageUsage.value[imagePath]) {
      delete imageUsage.value[imagePath]
      await saveUsageData()
    }
  }

  const getUsageStats = () => {
    const entries = Object.values(imageUsage.value)
    const totalImages = entries.length
    const totalUsage = entries.reduce((sum, data) => sum + data.count, 0)
    const averageUsage = totalImages > 0 ? totalUsage / totalImages : 0
    
    const mostUsedEntry = Object.entries(imageUsage.value)
      .reduce((max, [path, data]) => {
        return data.count > (max?.count || 0) ? { path, ...data } : max
      }, null)
    
    return {
      totalImages,
      totalUsage,
      averageUsage,
      mostUsed: mostUsedEntry
    }
  }

  const getTopImagesCount = () => {
    return GALLERY_CONFIG.usage.topImagesCount
  }

  const reloadUsageData = async () => {
    await loadUsageData()
  }

  // Computed properties for reactive data
  const topUsedImages = computed(() => getTopUsedImages())
  const recentlyUsedImages = computed(() => getRecentlyUsedImages())
  const usageStats = computed(() => getUsageStats())

  return {
    imageUsage,
    isLoading,
    incrementUsage,
    getImageUsage,
    getImageLastUsed,
    getTopUsedImages,
    getRecentlyUsedImages,
    clearUsageData,
    removeImageUsage,
    getUsageStats,
    getTopImagesCount,
    reloadUsageData,
    topUsedImages,
    recentlyUsedImages,
    usageStats
  }
}
