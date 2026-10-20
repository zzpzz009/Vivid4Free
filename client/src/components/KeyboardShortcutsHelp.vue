<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">
          键盘快捷键
        </h3>
        <button
          class="text-gray-500 hover:text-gray-700"
          @click="$emit('close')"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-gray-600">生成图片</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + Enter</kbd>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">上传图片</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + U</kbd>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">清除图片</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + D</kbd>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">显示帮助</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">F1</kbd>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">切换全屏</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">F11</kbd>
        </div>
      </div>

      <div class="mt-6 text-center">
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          @click="$emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'KeyboardShortcutsHelp',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close']
}
</script>