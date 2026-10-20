import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/index.js'
import xmAPI from '../api/xmapi.js'
import { probeImageMeta } from '../utils/imageMeta.js'

export const useGalleryStore = defineStore('gallery', () => {
  // State
  const categories = ref([])
  const currentCategory = ref(null)
  const currentImages = ref([])
  const selectedImage = ref(null)
  const isLoading = ref(false)
  const searchResults = ref([])
  const searchQuery = ref('')
  const galleryStats = ref({
    totalCategories: 0,
    totalImages: 0,
    totalSize: 0
  })

  // Pagination state
  const currentPage = ref(1)
  const itemsPerPage = ref(20)
  const totalItems = ref(0)

  // Computed
  const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value))
  const hasNextPage = computed(() => currentPage.value < totalPages.value)
  const hasPrevPage = computed(() => currentPage.value > 1)

  const enrichImagesMeta = async (images, options = {}) => {
    const list = Array.isArray(images) ? images : []
    const extrasCount = Number.isFinite(options.extrasCount) && options.extrasCount > 0 ? Math.floor(options.extrasCount) : 0
    const extrasUrls = new Set(list.slice(0, extrasCount).map((img) => img?.url).filter(Boolean))
    const targets = list.filter((img) => {
      if (!img || typeof img.url !== 'string') return false
      const hasRatio = Number.isFinite(img.aspectRatio) && img.aspectRatio > 0
      const wantsExtras = extrasUrls.has(img.url) && (!img.dominantColor || !img.lqip)
      return !hasRatio || wantsExtras
    })
    const concurrency = Number.isFinite(options.concurrency) && options.concurrency > 0 ? Math.floor(options.concurrency) : 4

    const queue = targets.slice()
    const workers = new Array(Math.min(concurrency, queue.length)).fill(0).map(async () => {
      while (queue.length) {
        const item = queue.shift()
        if (!item) continue
        try {
          item.status = 'loading'
          const withExtras = extrasUrls.has(item.url)
          const meta = await probeImageMeta(item.url, { computeDominantColor: withExtras, computeLqip: withExtras })
          if (meta) {
            item.width = meta.width ?? item.width
            item.height = meta.height ?? item.height
            item.aspectRatio = meta.aspectRatio ?? item.aspectRatio
            item.exifOrientation = meta.exifOrientation ?? item.exifOrientation
            item.dominantColor = meta.dominantColor ?? item.dominantColor
            item.lqip = meta.lqip ?? item.lqip
          }
          item.status = 'ready'
        } catch (error) {
          item.status = 'error'
          console.error('Failed to probe image meta:', item?.url, error)
        }
      }
    })

    await Promise.all(workers)
  }

  const normalizeImages = (images) => {
    const list = Array.isArray(images) ? images : []
    return list.map((img, index) => {
      if (!img || typeof img !== 'object') return img
      const url = img.url
      return {
        id: img.id ?? url ?? `${index}`,
        name: img.name ?? img.originalName ?? url ?? `${index}`,
        path: img.path ?? url ?? `${index}`,
        url,
        thumbnail: img.thumbnail ?? img.thumb ?? null,
        width: img.width ?? null,
        height: img.height ?? null,
        aspectRatio: img.aspectRatio ?? null,
        dominantColor: img.dominantColor ?? null,
        lqip: img.lqip ?? null,
        status: img.status ?? 'idle'
      }
    })
  }

  // Actions
  const loadCategories = async () => {
    isLoading.value = true
    try {
      // const response = await api.gallery.getCategories()
      const response = await xmAPI.getbdimgs({
        page: 1,
        limit: 5000,
        orderBy: 'name',
        orderDirection: 'ASC',
        v: 1
      })
      // debugger;
      if (response.data.success) {
        // categories.value = response.data.images || [];
        currentImages.value = normalizeImages(response.data.images || [])
        totalItems.value = Number(response.data.pagination?.total ?? currentImages.value.length)
        currentPage.value = 1
        void enrichImagesMeta(currentImages.value, { extrasCount: 30 })
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
      categories.value = []
    } finally {
      isLoading.value = false
    }
  }

  const createCategory = async (categoryData) => {
    try {
      const response = await api.gallery.createCategory(categoryData)
      if (response.success) {
        categories.value.push(response.data)
        return response.data
      }
      throw new Error(response.message || 'Failed to create category')
    } catch (error) {
      console.error('Failed to create category:', error)
      throw error
    }
  }

  const updateCategory = async (categoryId, updates) => {
    try {
      const response = await api.gallery.updateCategory(categoryId, updates)
      if (response.success) {
        const index = categories.value.findIndex(cat => cat.id === categoryId)
        if (index !== -1) {
          categories.value[index] = { ...categories.value[index], ...response.data }
        }
        return response.data
      }
      throw new Error(response.message || 'Failed to update category')
    } catch (error) {
      console.error('Failed to update category:', error)
      throw error
    }
  }

  const deleteCategory = async (categoryId) => {
    try {
      const response = await api.gallery.deleteCategory(categoryId)
      if (response.success) {
        categories.value = categories.value.filter(cat => cat.id !== categoryId)
        if (currentCategory.value?.id === categoryId) {
          currentCategory.value = null
          currentImages.value = []
        }
        return true
      }
      throw new Error(response.message || 'Failed to delete category')
    } catch (error) {
      console.error('Failed to delete category:', error)
      throw error
    }
  }

  const selectCategory = async (category) => {
    currentCategory.value = category
    currentPage.value = 1
    await loadCategoryImages()
  }

  const loadCategoryImages = async (page = currentPage.value) => {
    if (!currentCategory.value) return

    isLoading.value = true
    try {
      // const response = await api.gallery.getCategoryImages(currentCategory.value.id, {
      //   page,
      //   limit: itemsPerPage.value,
      //   orderBy: 'created_at',
      //   orderDirection: 'DESC'
      // })
      const response = await xmAPI.getbdimgs({
        page,
        limit: itemsPerPage.value,
        orderBy: 'name',
        orderDirection: 'ASC',
        v: 1
      })
      
      if (response.data.success) {
        currentImages.value = normalizeImages(response.data.images || [])
        totalItems.value = response.data.pagination?.total || currentImages.value.length || 0
        currentPage.value = page
        void enrichImagesMeta(currentImages.value, { extrasCount: 30 })
      }
    } catch (error) {
      console.error('Failed to load category images:', error)
      currentImages.value = []
    } finally {
      isLoading.value = false
    }
  }

  const uploadImage = async (categoryId, file, metadata = {}) => {
    try {
      const response = await api.gallery.uploadImage(categoryId, file, metadata)
      if (response.success) {
        // Refresh current category if it matches
        if (currentCategory.value?.id === categoryId) {
          await loadCategoryImages()
        }
        // Update category image count
        const category = categories.value.find(cat => cat.id === categoryId)
        if (category) {
          category.imageCount = (category.imageCount || 0) + 1
        }
        return response.data
      }
      throw new Error(response.message || 'Failed to upload image')
    } catch (error) {
      console.error('Failed to upload image:', error)
      throw error
    }
  }

  const searchImages = async (query, filters = {}) => {
    isLoading.value = true
    searchQuery.value = query
    try {
      const response = await api.gallery.searchImages({
        keyword: query,
        ...filters,
        limit: itemsPerPage.value,
        offset: (currentPage.value - 1) * itemsPerPage.value
      })

      if (response.success) {
        searchResults.value = response.data.images || []
        totalItems.value = response.data.pagination?.total || 0
      }
    } catch (error) {
      console.error('Failed to search images:', error)
      searchResults.value = []
    } finally {
      isLoading.value = false
    }
  }

  const clearSearch = () => {
    searchResults.value = []
    searchQuery.value = ''
    currentPage.value = 1
  }

  const selectImage = (image) => {
    selectedImage.value = image
  }

  const deleteImage = async (imageId) => {
    try {
      const response = await api.gallery.deleteImage(imageId)
      if (response.success) {
        // Remove from current images
        currentImages.value = currentImages.value.filter(img => img.id !== imageId)
        // Remove from search results
        searchResults.value = searchResults.value.filter(img => img.id !== imageId)
        // Update category image count
        if (currentCategory.value) {
          currentCategory.value.imageCount = Math.max(0, (currentCategory.value.imageCount || 1) - 1)
        }
        return true
      }
      throw new Error(response.message || 'Failed to delete image')
    } catch (error) {
      console.error('Failed to delete image:', error)
      throw error
    }
  }

  const loadStats = async () => {
    try {
      // const response = await api.gallery.getStats()
      const response = await xmAPI.getbdimgs()
      // debugger;
      if (response.data.success) {
        galleryStats.value = response.data.images
      }
    } catch (error) {
      console.error('Failed to load gallery stats:', error)
    }
  }

  const nextPage = async () => {
    if (hasNextPage.value) {
      if (searchQuery.value) {
        currentPage.value++
        await searchImages(searchQuery.value)
      } else {
        await loadCategoryImages(currentPage.value + 1)
      }
    }
  }

  const prevPage = async () => {
    if (hasPrevPage.value) {
      if (searchQuery.value) {
        currentPage.value--
        await searchImages(searchQuery.value)
      } else {
        await loadCategoryImages(currentPage.value - 1)
      }
    }
  }

  const goToPage = async (page) => {
    if (page >= 1 && page <= totalPages.value) {
      if (searchQuery.value) {
        currentPage.value = page
        await searchImages(searchQuery.value)
      } else {
        await loadCategoryImages(page)
      }
    }
  }

  // Initialize
  const initialize = async () => {
    // await Promise.all([
    //   loadCategories(),
    //   loadStats()
    // ])
  }

  return {
    // State
    categories,
    currentCategory,
    currentImages,
    selectedImage,
    isLoading,
    searchResults,
    searchQuery,
    galleryStats,
    currentPage,
    itemsPerPage,
    totalItems,

    // Computed
    totalPages,
    hasNextPage,
    hasPrevPage,

    // Actions
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    selectCategory,
    loadCategoryImages,
    uploadImage,
    searchImages,
    clearSearch,
    selectImage,
    deleteImage,
    loadStats,
    nextPage,
    prevPage,
    goToPage,
    initialize
  }
})
