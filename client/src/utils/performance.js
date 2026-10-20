/**
 * Performance monitoring and optimization utilities
 */

// Performance metrics collection
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
    this.observers = []
    this.isEnabled = process.env.NODE_ENV === 'development'
  }

  // Start timing a operation
  startTiming(name) {
    if (!this.isEnabled) return

    const startTime = performance.now()
    this.metrics.set(name, {
      startTime,
      endTime: null,
      duration: null,
      type: 'timing'
    })
  }

  // End timing and calculate duration
  endTiming(name) {
    if (!this.isEnabled) return

    const metric = this.metrics.get(name)
    if (metric) {
      metric.endTime = performance.now()
      metric.duration = metric.endTime - metric.startTime
      
      console.log(`⏱️ ${name}: ${metric.duration.toFixed(2)}ms`)
      
      // Notify observers
      this.notifyObservers(name, metric)
    }
  }

  // Record a custom metric
  recordMetric(name, value, type = 'custom') {
    if (!this.isEnabled) return

    const metric = {
      value,
      type,
      timestamp: performance.now()
    }
    
    this.metrics.set(name, metric)
    this.notifyObservers(name, metric)
  }

  // Get all metrics
  getMetrics() {
    return Object.fromEntries(this.metrics)
  }

  // Clear all metrics
  clearMetrics() {
    this.metrics.clear()
  }

  // Add observer for metric changes
  addObserver(callback) {
    this.observers.push(callback)
  }

  // Remove observer
  removeObserver(callback) {
    const index = this.observers.indexOf(callback)
    if (index > -1) {
      this.observers.splice(index, 1)
    }
  }

  // Notify all observers
  notifyObservers(name, metric) {
    this.observers.forEach(callback => {
      try {
        callback(name, metric)
      } catch (error) {
        console.error('Performance observer error:', error)
      }
    })
  }

  // Monitor Web Vitals
  monitorWebVitals() {
    if (!this.isEnabled || typeof window === 'undefined') return

    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          this.recordMetric('LCP', lastEntry.startTime, 'web-vital')
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

        // First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach(entry => {
            this.recordMetric('FID', entry.processingStart - entry.startTime, 'web-vital')
          })
        })
        fidObserver.observe({ entryTypes: ['first-input'] })

        // Cumulative Layout Shift
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
              this.recordMetric('CLS', clsValue, 'web-vital')
            }
          })
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })
      } catch (error) {
        console.warn('Web Vitals monitoring not supported:', error)
      }
    }
  }

  // Monitor memory usage
  monitorMemory() {
    if (!this.isEnabled || !performance.memory) return

    const memoryInfo = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    }

    this.recordMetric('memory', memoryInfo, 'memory')
    return memoryInfo
  }

  // Monitor network performance
  monitorNetwork() {
    if (!this.isEnabled || !navigator.connection) return

    const networkInfo = {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData
    }

    this.recordMetric('network', networkInfo, 'network')
    return networkInfo
  }
}

// Image optimization utilities
export const ImageOptimizer = {
  // Compress image file
  compressImage(file, quality = 0.8, maxWidth = 1920, maxHeight = 1080) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(resolve, 'image/jpeg', quality)
      }

      img.src = URL.createObjectURL(file)
    })
  },

  // Create thumbnail
  createThumbnail(file, size = 200) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        const { width, height } = img
        const ratio = Math.min(size / width, size / height)
        
        canvas.width = width * ratio
        canvas.height = height * ratio

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        canvas.toBlob(resolve, 'image/jpeg', 0.7)
      }

      img.src = URL.createObjectURL(file)
    })
  },

  // Lazy load images
  lazyLoadImage(img, src) {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.src = src
            observer.unobserve(entry.target)
          }
        })
      })
      observer.observe(img)
    } else {
      // Fallback for older browsers
      img.src = src
    }
  }
}

// Debounce utility for performance
export function debounce(func, wait, immediate = false) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func(...args)
  }
}

// Throttle utility for performance
export function throttle(func, limit) {
  let inThrottle
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Memory cleanup utilities
export const MemoryManager = {
  // Clean up object URLs
  cleanupObjectURLs(urls) {
    if (Array.isArray(urls)) {
      urls.forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    } else if (urls && urls.startsWith('blob:')) {
      URL.revokeObjectURL(urls)
    }
  },

  // Clean up canvas contexts
  cleanupCanvas(canvas) {
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  },

  // Force garbage collection (development only)
  forceGC() {
    if (process.env.NODE_ENV === 'development' && window.gc) {
      window.gc()
    }
  }
}

// Bundle size analyzer
export const BundleAnalyzer = {
  // Analyze chunk sizes
  analyzeChunks() {
    if (process.env.NODE_ENV !== 'development') return

    const chunks = []
    const scripts = document.querySelectorAll('script[src]')
    
    scripts.forEach(script => {
      const src = script.src
      if (src.includes('chunk') || src.includes('vendor')) {
        chunks.push({
          name: src.split('/').pop(),
          url: src
        })
      }
    })

    console.table(chunks)
    return chunks
  },

  // Monitor bundle loading performance
  monitorBundleLoading() {
    if (process.env.NODE_ENV !== 'development') return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach(entry => {
        if (entry.name.includes('.js') || entry.name.includes('.css')) {
          console.log(`📦 ${entry.name}: ${entry.duration.toFixed(2)}ms`)
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })
  }
}

// Create global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Auto-start monitoring in development
if (process.env.NODE_ENV === 'development') {
  performanceMonitor.monitorWebVitals()
  performanceMonitor.monitorMemory()
  performanceMonitor.monitorNetwork()
  BundleAnalyzer.monitorBundleLoading()
}

// Performance timing decorator
export function withTiming(name) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function(...args) {
      performanceMonitor.startTiming(`${name || propertyKey}`)
      try {
        const result = await originalMethod.apply(this, args)
        return result
      } finally {
        performanceMonitor.endTiming(`${name || propertyKey}`)
      }
    }

    return descriptor
  }
}

export default {
  performanceMonitor,
  ImageOptimizer,
  MemoryManager,
  BundleAnalyzer,
  debounce,
  throttle,
  withTiming
}
