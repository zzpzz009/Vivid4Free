// Toast service for global toast management
import { ref } from 'vue'

// Global toast state
const toasts = ref([])
let nextId = 1

// Toast service
export const useToast = () => {
  const addToast = (options) => {
    const toast = {
      id: nextId++,
      type: options.type || 'info',
      title: options.title || '',
      message: options.message || '',
      duration: options.duration !== undefined ? options.duration : 4000,
      showProgress: options.showProgress !== undefined ? options.showProgress : true,
      persistent: options.persistent || false,
      progress: options.progress,
      timestamp: Date.now()
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
    toasts.value.splice(0)
  }

  // Convenience methods
  const success = (message, options = {}) => {
    return addToast({ 
      ...options, 
      type: 'success', 
      message,
      title: options.title || '成功'
    })
  }

  const error = (message, options = {}) => {
    return addToast({ 
      ...options, 
      type: 'error', 
      message,
      title: options.title || '错误',
      duration: options.duration !== undefined ? options.duration : 6000 // Longer for errors
    })
  }

  const warning = (message, options = {}) => {
    return addToast({ 
      ...options, 
      type: 'warning', 
      message,
      title: options.title || '警告'
    })
  }

  const info = (message, options = {}) => {
    return addToast({ 
      ...options, 
      type: 'info', 
      message,
      title: options.title || '信息'
    })
  }

  // Loading toast with custom handling
  const loading = (message, options = {}) => {
    return addToast({
      ...options,
      type: 'info',
      message,
      title: options.title || '处理中',
      persistent: true,
      showProgress: false
    })
  }

  // Update existing toast
  const updateToast = (id, updates) => {
    const toast = toasts.value.find(t => t.id === id)
    if (toast) {
      Object.assign(toast, updates)
    }
  }

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
    loading,
    updateToast
  }
}

// Global toast instance
export const toast = useToast()

// Export individual methods for convenience
export const { success, error, warning, info, loading, removeToast } = toast
