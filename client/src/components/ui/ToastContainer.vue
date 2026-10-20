<template>
  <div class="fixed top-4 right-4 z-50 space-y-2">
    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      :duration="toast.duration"
      :show-progress="toast.showProgress"
      :persistent="toast.persistent"
      @close="removeToast(toast.id)"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import Toast from './Toast.vue'

export default {
  name: 'ToastContainer',
  components: {
    Toast
  },
  setup() {
    const toasts = ref([])
    let nextId = 1

    const addToast = (options) => {
      const toast = {
        id: nextId++,
        type: options.type || 'info',
        title: options.title || '',
        message: options.message || '',
        duration: options.duration !== undefined ? options.duration : 4000,
        showProgress: options.showProgress !== undefined ? options.showProgress : true,
        persistent: options.persistent || false
      }
      
      toasts.value.push(toast)
      
      // Limit the number of toasts displayed
      if (toasts.value.length > 5) {
        toasts.value.shift()
      }
      
      return toast.id
    }

    const removeToast = (id) => {
      const index = toasts.value.findIndex(toast => toast.id === id)
      if (index > -1) {
        toasts.value.splice(index, 1)
      }
    }

    const clearAll = () => {
      toasts.value = []
    }

    // Convenience methods
    const success = (message, options = {}) => {
      return addToast({ ...options, type: 'success', message })
    }

    const error = (message, options = {}) => {
      return addToast({ ...options, type: 'error', message })
    }

    const warning = (message, options = {}) => {
      return addToast({ ...options, type: 'warning', message })
    }

    const info = (message, options = {}) => {
      return addToast({ ...options, type: 'info', message })
    }

    return {
      toasts,
      addToast,
      removeToast,
      clearAll,
      success,
      error,
      warning,
      info
    }
  }
}
</script>
