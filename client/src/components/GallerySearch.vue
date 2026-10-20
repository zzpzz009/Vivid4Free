<template>
  <div class="gallery-search">
    <!-- Search Header -->
    <div class="flex items-center gap-4 mb-6">
      <div class="flex-1">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索图片..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-schemes-primary focus:border-schemes-primary"
            @keyup.enter="performSearch"
          >
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              class="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>
      <button
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        @click="performSearch"
      >
        搜索
      </button>
      <button
        class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
        @click="toggleFilters"
      >
        筛选
      </button>
    </div>

    <!-- Advanced Filters -->
    <div
      v-if="showFilters"
      class="bg-gray-50 rounded-lg p-4 mb-6"
    >
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Category Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">分类</label>
          <select
            v-model="filters.categoryId"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-schemes-primary focus:border-schemes-primary"
          >
            <option value="">
              所有分类
            </option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
        </div>

        <!-- Tags Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">标签</label>
          <input
            v-model="filters.tags"
            type="text"
            placeholder="输入标签，用逗号分隔"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-schemes-primary focus:border-schemes-primary"
          >
        </div>

        <!-- Date Range Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">上传时间</label>
          <select
            v-model="filters.dateRange"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-schemes-primary focus:border-schemes-primary"
          >
            <option value="">
              任何时间
            </option>
            <option value="today">
              今天
            </option>
            <option value="week">
              本周
            </option>
            <option value="month">
              本月
            </option>
            <option value="year">
              今年
            </option>
          </select>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          @click="clearFilters"
        >
          清除筛选
        </button>
        <button
          class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          @click="applyFilters"
        >
          应用筛选
        </button>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="hasSearched">
      <!-- Results Header -->
      <div class="flex justify-between items-center mb-4">
        <div class="text-sm text-gray-600">
          找到 {{ totalResults }} 个结果
          <span v-if="searchQuery">关于 "{{ searchQuery }}"</span>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600">排序:</label>
          <select
            v-model="sortBy"
            class="border border-gray-300 rounded px-2 py-1 text-sm"
            @change="performSearch"
          >
            <option value="created_at">
              上传时间
            </option>
            <option value="original_name">
              文件名
            </option>
            <option value="size">
              文件大小
            </option>
          </select>
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex justify-center items-center h-64"
      >
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>

      <!-- Results Grid -->
      <div
        v-else-if="searchResults.length > 0"
        class="space-y-6"
      >
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div
            v-for="image in searchResults"
            :key="image.id"
            class="relative group cursor-pointer"
            @click="selectImage(image)"
          >
            <img
              :src="`/api/gallery/image/${image.categoryId}/${image.filename}`"
              :alt="image.originalName"
              class="w-full h-32 object-cover rounded-lg"
              @error="handleImageError"
            >
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
              <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="text-white bg-blue-600 px-2 py-1 rounded text-xs mr-1"
                  @click.stop="useImage(image)"
                >
                  使用
                </button>
                <button
                  class="text-white bg-gray-600 px-2 py-1 rounded text-xs"
                  @click.stop="viewImage(image)"
                >
                  查看
                </button>
              </div>
            </div>
            <div class="mt-2">
              <div class="text-xs text-gray-600 truncate">
                {{ image.originalName }}
              </div>
              <div class="text-xs text-gray-500">
                {{ formatFileSize(image.size) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="flex justify-center items-center gap-2"
        >
          <button
            :disabled="currentPage <= 1"
            class="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
            @click="goToPage(currentPage - 1)"
          >
            上一页
          </button>
          
          <div class="flex gap-1">
            <button
              v-for="page in visiblePages"
              :key="page"
              class="px-3 py-1 rounded"
              :class="{
                'bg-blue-600 text-white': page === currentPage,
                'bg-gray-200 text-gray-700': page !== currentPage
              }"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </div>

          <button
            :disabled="currentPage >= totalPages"
            class="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
            @click="goToPage(currentPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>

      <!-- No Results -->
      <div
        v-else
        class="text-center py-12"
      >
        <div class="text-4xl mb-4">
          🔍
        </div>
        <div class="text-lg text-gray-600 mb-2">
          未找到匹配的图片
        </div>
        <div class="text-sm text-gray-500">
          尝试调整搜索条件或筛选器
        </div>
      </div>
    </div>

    <!-- Initial State -->
    <div
      v-else
      class="text-center py-12"
    >
      <div class="text-4xl mb-4">
        🖼️
      </div>
      <div class="text-lg text-gray-600 mb-2">
        搜索图库
      </div>
      <div class="text-sm text-gray-500">
        输入关键词开始搜索图片
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGalleryStore } from '../stores/useGalleryStore.js'
import { storeToRefs } from 'pinia'

const emit = defineEmits(['image-select'])

const galleryStore = useGalleryStore()
const { categories, searchResults, isLoading } = storeToRefs(galleryStore)

const searchQuery = ref('')
const showFilters = ref(false)
const hasSearched = ref(false)
const sortBy = ref('created_at')
const currentPage = ref(1)
const itemsPerPage = ref(24)
const totalResults = ref(0)

const filters = ref({
  categoryId: '',
  tags: '',
  dateRange: ''
})

const totalPages = computed(() => Math.ceil(totalResults.value / itemsPerPage.value))

const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

onMounted(() => {
  galleryStore.loadCategories()
})

const toggleFilters = () => {
  showFilters.value = !showFilters.value
}

const performSearch = async () => {
  if (!searchQuery.value.trim() && !hasActiveFilters()) {
    return
  }

  hasSearched.value = true
  currentPage.value = 1

  const searchFilters = {
    keyword: searchQuery.value.trim(),
    limit: itemsPerPage.value,
    offset: 0,
    orderBy: sortBy.value,
    orderDirection: 'DESC'
  }

  // Apply filters
  if (filters.value.categoryId) {
    searchFilters.categoryId = filters.value.categoryId
  }

  if (filters.value.tags) {
    searchFilters.tags = filters.value.tags.split(',').map(tag => tag.trim()).filter(Boolean)
  }

  try {
    await galleryStore.searchImages(searchQuery.value, searchFilters)
    totalResults.value = searchResults.value.length // This should come from API response
  } catch (error) {
    console.error('Search failed:', error)
  }
}

const applyFilters = () => {
  performSearch()
}

const clearFilters = () => {
  filters.value = {
    categoryId: '',
    tags: '',
    dateRange: ''
  }
  performSearch()
}

const hasActiveFilters = () => {
  return filters.value.categoryId || filters.value.tags || filters.value.dateRange
}

const goToPage = async (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    
    const searchFilters = {
      keyword: searchQuery.value.trim(),
      limit: itemsPerPage.value,
      offset: (page - 1) * itemsPerPage.value,
      orderBy: sortBy.value,
      orderDirection: 'DESC'
    }

    if (filters.value.categoryId) {
      searchFilters.categoryId = filters.value.categoryId
    }

    if (filters.value.tags) {
      searchFilters.tags = filters.value.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    }

    await galleryStore.searchImages(searchQuery.value, searchFilters)
  }
}

const selectImage = (image) => {
  emit('image-select', image)
}

const useImage = (image) => {
  emit('image-select', image)
}

const viewImage = (image) => {
  // Open image in modal or new tab
  window.open(`/api/gallery/image/${image.categoryId}/${image.filename}`, '_blank')
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const handleImageError = (event) => {
  event.target.src = '/placeholder-image.png'
}
</script>
