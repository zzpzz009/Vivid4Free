<template>
  <div class="gallery-manager h-full flex flex-col">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-semibold text-gray-900">
          图库管理
        </h2>
        <p class="text-sm text-gray-600 mt-1">
          管理图片分类和内容
        </p>
      </div>
      <div class="flex gap-3">
        <button
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          @click="showCreateCategory = true"
        >
          新建分类
        </button>
        <button
          class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          @click="refreshData"
        >
          刷新
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-4 rounded-lg shadow">
        <div class="text-2xl font-bold text-blue-600">
          {{ galleryStats.totalCategories }}
        </div>
        <div class="text-sm text-gray-600">
          分类总数
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <div class="text-2xl font-bold text-green-600">
          {{ galleryStats.totalImages }}
        </div>
        <div class="text-sm text-gray-600">
          图片总数
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <div class="text-2xl font-bold text-purple-600">
          {{ formatFileSize(galleryStats.totalSize) }}
        </div>
        <div class="text-sm text-gray-600">
          存储空间
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Categories Panel -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          分类列表
        </h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="category in categories"
            :key="category.id"
            class="p-3 rounded-lg cursor-pointer transition-colors"
            :class="{
              'bg-blue-50 border border-blue-200': currentCategory?.id === category.id,
              'hover:bg-gray-50': currentCategory?.id !== category.id
            }"
            @click="selectCategory(category)"
          >
            <div class="flex justify-between items-center">
              <div>
                <div class="font-medium text-gray-900">
                  {{ category.name }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ category.imageCount || 0 }} 张图片
                </div>
              </div>
              <div class="flex gap-1">
                <button
                  class="text-blue-600 hover:text-blue-800 p-1"
                  title="编辑"
                  @click.stop="editCategory(category)"
                >
                  ✏️
                </button>
                <button
                  class="text-red-600 hover:text-red-800 p-1"
                  title="删除"
                  @click.stop="deleteCategory(category)"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Images Panel -->
      <div class="lg:col-span-2 bg-white rounded-lg shadow p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            {{ currentCategory ? currentCategory.name : '选择分类查看图片' }}
          </h3>
          <div class="flex gap-2">
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleFileUpload"
            >
            <button
              v-if="currentCategory"
              class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              @click="$refs.fileInput.click()"
            >
              上传图片
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div
          v-if="isLoading"
          class="flex justify-center items-center h-64"
        >
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>

        <!-- Images Grid -->
        <div
          v-else-if="currentImages.length > 0"
          class="space-y-4"
        >
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div
              v-for="image in currentImages"
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
                <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button
                    class="text-white bg-blue-600 px-2 py-1 rounded text-xs"
                    @click.stop="viewImage(image)"
                  >
                    查看
                  </button>
                  <button
                    class="text-white bg-red-600 px-2 py-1 rounded text-xs"
                    @click.stop="deleteImage(image)"
                  >
                    删除
                  </button>
                </div>
              </div>
              <div class="mt-2 text-xs text-gray-600 truncate">
                {{ image.originalName }}
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div
            v-if="totalPages > 1"
            class="flex justify-center items-center gap-2 mt-4"
          >
            <button
              :disabled="!hasPrevPage"
              class="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
              @click="prevPage"
            >
              上一页
            </button>
            <span class="text-sm text-gray-600">
              第 {{ currentPage }} 页，共 {{ totalPages }} 页
            </span>
            <button
              :disabled="!hasNextPage"
              class="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
              @click="nextPage"
            >
              下一页
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="currentCategory"
          class="flex flex-col items-center justify-center h-64 text-gray-500"
        >
          <div class="text-4xl mb-2">
            📷
          </div>
          <div class="text-lg">
            暂无图片
          </div>
          <div class="text-sm">
            点击上传按钮添加图片
          </div>
        </div>

        <!-- No Category Selected -->
        <div
          v-else
          class="flex flex-col items-center justify-center h-64 text-gray-500"
        >
          <div class="text-4xl mb-2">
            📁
          </div>
          <div class="text-lg">
            请选择分类
          </div>
          <div class="text-sm">
            从左侧选择一个分类查看图片
          </div>
        </div>
      </div>
    </div>

    <!-- Create Category Modal -->
    <div
      v-if="showCreateCategory"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-medium mb-4">
          创建新分类
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分类名称</label>
            <input
              v-model="newCategory.name"
              type="text"
              class="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="输入分类名称"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              v-model="newCategory.description"
              class="w-full border border-gray-300 rounded-md px-3 py-2"
              rows="3"
              placeholder="输入分类描述"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            @click="showCreateCategory = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
            @click="createCategory"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGalleryStore } from '../stores/useGalleryStore.js'
import { storeToRefs } from 'pinia'

const galleryStore = useGalleryStore()
const {
  categories,
  currentCategory,
  currentImages,
  isLoading,
  galleryStats,
  currentPage,
  totalPages,
  hasNextPage,
  hasPrevPage
} = storeToRefs(galleryStore)

const showCreateCategory = ref(false)
const newCategory = ref({ name: '', description: '' })
const fileInput = ref(null)

onMounted(() => {
  galleryStore.initialize()
})

const selectCategory = (category) => {
  galleryStore.selectCategory(category)
}

const createCategory = async () => {
  try {
    await galleryStore.createCategory(newCategory.value)
    showCreateCategory.value = false
    newCategory.value = { name: '', description: '' }
  } catch (error) {
    alert('创建分类失败: ' + error.message)
  }
}

const deleteCategory = async (category) => {
  if (confirm(`确定要删除分类"${category.name}"吗？此操作将删除分类下的所有图片。`)) {
    try {
      await galleryStore.deleteCategory(category.id)
    } catch (error) {
      alert('删除分类失败: ' + error.message)
    }
  }
}

const handleFileUpload = async (event) => {
  const files = Array.from(event.target.files)
  if (files.length === 0 || !currentCategory.value) return

  for (const file of files) {
    try {
      await galleryStore.uploadImage(currentCategory.value.id, file)
    } catch (error) {
      alert(`上传文件 ${file.name} 失败: ${error.message}`)
    }
  }
  
  // Clear file input
  event.target.value = ''
}

const deleteImage = async (image) => {
  if (confirm(`确定要删除图片"${image.originalName}"吗？`)) {
    try {
      await galleryStore.deleteImage(image.id)
    } catch (error) {
      alert('删除图片失败: ' + error.message)
    }
  }
}

const refreshData = () => {
  galleryStore.initialize()
}

const nextPage = () => {
  galleryStore.nextPage()
}

const prevPage = () => {
  galleryStore.prevPage()
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleImageError = (event) => {
  event.target.src = '/placeholder-image.png'
}
</script>
