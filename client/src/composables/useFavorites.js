import { ref, reactive } from 'vue'

// Global state for favorites
const favorites = ref([])
const STORAGE_KEY = 'archviz-favorites'

// Load favorites from localStorage
const loadFavorites = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      favorites.value = JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading favorites:', error)
    favorites.value = []
  }
}

// Save favorites to localStorage
const saveFavorites = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value))
  } catch (error) {
    console.error('Error saving favorites:', error)
  }
}

// Initialize favorites on first import
loadFavorites()

export function useFavorites() {
  const addToFavorites = async (image) => {
    // Check if already in favorites
    const existingIndex = favorites.value.findIndex(fav =>
      fav.path === image.path || fav.imageId === image.id
    )
    if (existingIndex !== -1) {
      console.log('Image already in favorites')
      return
    }

    // Create favorite object
    const favorite = {
      id: Date.now() + Math.random(), // Simple unique ID
      imageId: image.id, // Gallery image ID
      name: image.originalName || image.name,
      path: image.path || `/api/gallery/image/${image.categoryId}/${image.filename}`,
      thumbnail: image.thumbnailPath || image.thumbnail || image.path,
      categoryId: image.categoryId,
      filename: image.filename,
      usageCount: 0,
      dateAdded: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      originalFolder: image.folder || image.categoryName || '',
      tags: image.tags || [],
      size: image.size,
      mimeType: image.mimeType
    }

    favorites.value.unshift(favorite)
    saveFavorites()

    console.log('Added to favorites:', favorite.name)
  }

  const removeFromFavorites = async (favoriteId) => {
    const index = favorites.value.findIndex(fav => fav.id === favoriteId)
    if (index !== -1) {
      const removed = favorites.value.splice(index, 1)[0]
      saveFavorites()
      console.log('Removed from favorites:', removed.name)
    }
  }

  const incrementUsage = (favoriteId) => {
    const favorite = favorites.value.find(fav => fav.id === favoriteId)
    if (favorite) {
      favorite.usageCount++
      favorite.lastUsed = new Date().toISOString()
      saveFavorites()
    }
  }

  const clearFavorites = async () => {
    favorites.value = []
    saveFavorites()
  }

  const sortFavorites = (sortBy = 'usage') => {
    const sorted = [...favorites.value]
    
    switch (sortBy) {
      case 'usage':
        return sorted.sort((a, b) => b.usageCount - a.usageCount)
      case 'recent':
        return sorted.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'date':
        return sorted.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
      default:
        return sorted
    }
  }

  const isFavorite = (imagePath) => {
    return favorites.value.some(fav => fav.path === imagePath)
  }

  const getFavoriteByPath = (imagePath) => {
    return favorites.value.find(fav => fav.path === imagePath)
  }

  const reorderFavorites = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    
    const item = favorites.value.splice(fromIndex, 1)[0]
    favorites.value.splice(toIndex, 0, item)
    saveFavorites()
  }

  const updateFavorite = (favoriteId, updates) => {
    const favorite = favorites.value.find(fav => fav.id === favoriteId)
    if (favorite) {
      Object.assign(favorite, updates)
      saveFavorites()
    }
  }

  const getFavoriteStats = () => {
    const totalUsage = favorites.value.reduce((sum, fav) => sum + fav.usageCount, 0)
    const mostUsed = favorites.value.reduce((max, fav) => 
      fav.usageCount > (max?.usageCount || 0) ? fav : max, null)
    
    return {
      total: favorites.value.length,
      totalUsage,
      mostUsed,
      averageUsage: favorites.value.length > 0 ? totalUsage / favorites.value.length : 0
    }
  }

  return {
    favorites,
    addToFavorites,
    removeFromFavorites,
    incrementUsage,
    clearFavorites,
    sortFavorites,
    isFavorite,
    getFavoriteByPath,
    reorderFavorites,
    updateFavorite,
    getFavoriteStats
  }
}
