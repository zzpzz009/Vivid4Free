import { ref } from 'vue'

export const createImageLoadController = (options = {}) => {
  const maxConcurrentLoads = options.maxConcurrentLoads ?? 6
  const root = options.root ?? null
  const rootMargin = options.rootMargin ?? '200px 0px'
  const threshold = options.threshold ?? 0.01
  const debug = typeof options.debug === 'function' ? options.debug : null

  const shouldLoad = ref(new Set())
  const loadedKeys = ref(new Set())
  const errorKeys = ref(new Set())

  const pendingQueue = []
  const retryCounts = new Map()
  let inFlightLoads = 0
  let intersectionObserver = null
  const keyToEl = new Map()
  const keyToImage = new Map()

  const setShouldLoad = (key) => {
    if (shouldLoad.value.has(key)) return
    shouldLoad.value = new Set([...shouldLoad.value, key])
  }

  const setLoaded = (key) => {
    if (loadedKeys.value.has(key)) return
    loadedKeys.value = new Set([...loadedKeys.value, key])
  }

  const setError = (key) => {
    if (errorKeys.value.has(key)) return
    errorKeys.value = new Set([...errorKeys.value, key])
  }

  const clearError = (key) => {
    if (!errorKeys.value.has(key)) return
    const next = new Set(errorKeys.value)
    next.delete(key)
    errorKeys.value = next
  }

  const clearLoaded = (key) => {
    if (!loadedKeys.value.has(key)) return
    const next = new Set(loadedKeys.value)
    next.delete(key)
    loadedKeys.value = next
  }

  const clearShouldLoad = (key) => {
    if (!shouldLoad.value.has(key)) return
    const next = new Set(shouldLoad.value)
    next.delete(key)
    shouldLoad.value = next
  }

  const drainQueue = () => {
    while (inFlightLoads < maxConcurrentLoads && pendingQueue.length) {
      const nextKey = pendingQueue.shift()
      if (!nextKey) continue
      requestLoad(nextKey)
    }
  }

  const requestLoad = (key, image) => {
    if (!key) return
    const img = image || keyToImage.get(key)
    const url = typeof img?.url === 'string' ? img.url : ''
    if (loadedKeys.value.has(key)) return
    if (errorKeys.value.has(key)) return
    if (shouldLoad.value.has(key)) return
    if (!url) {
      setError(key)
      if (img) img.status = 'error'
      if (debug) debug('error', { key })
      return
    }

    if (inFlightLoads >= maxConcurrentLoads) {
      if (!pendingQueue.includes(key)) pendingQueue.push(key)
      return
    }

    inFlightLoads += 1
    setShouldLoad(key)
    if (img) img.status = 'loading'
  }

  const markLoaded = (key, image) => {
    if (!key) return
    setLoaded(key)
    clearError(key)
    const img = image || keyToImage.get(key)
    if (img) img.status = 'ready'
    inFlightLoads = Math.max(0, inFlightLoads - 1)
    drainQueue()
  }

  const markError = (key, image) => {
    if (!key) return
    setError(key)
    clearShouldLoad(key)
    const img = image || keyToImage.get(key)
    if (img) img.status = 'error'
    inFlightLoads = Math.max(0, inFlightLoads - 1)
    if (debug) debug('error', { key })
    drainQueue()
  }

  const retry = (key, image) => {
    if (!key) return
    const nextCount = (retryCounts.get(key) ?? 0) + 1
    retryCounts.set(key, nextCount)
    clearError(key)
    clearLoaded(key)
    clearShouldLoad(key)
    const img = image || keyToImage.get(key)
    if (img) img.status = 'idle'
    if (debug) debug('retry', { key, attempt: nextCount })
    requestLoad(key, img)
  }

  const ensureObserver = () => {
    if (intersectionObserver) return
    if (!('IntersectionObserver' in window)) return
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const key = entry.target?.dataset?.lazyKey
          if (!key) continue
          requestLoad(key)
        }
      },
      { root, rootMargin, threshold }
    )
    for (const el of keyToEl.values()) intersectionObserver.observe(el)
  }

  const observe = (key, el, image) => {
    if (!key) return
    if (el) {
      el.dataset.lazyKey = key
      keyToEl.set(key, el)
      if (image) keyToImage.set(key, image)
      ensureObserver()
      if (intersectionObserver) intersectionObserver.observe(el)
      return
    }

    const prev = keyToEl.get(key)
    if (prev && intersectionObserver) intersectionObserver.unobserve(prev)
    keyToEl.delete(key)
    keyToImage.delete(key)
  }

  const reset = () => {
    shouldLoad.value = new Set()
    loadedKeys.value = new Set()
    errorKeys.value = new Set()
    pendingQueue.splice(0, pendingQueue.length)
    retryCounts.clear()
    inFlightLoads = 0
  }

  const disconnect = () => {
    if (intersectionObserver) intersectionObserver.disconnect()
    intersectionObserver = null
    keyToEl.clear()
    keyToImage.clear()
    reset()
  }

  return {
    shouldLoad,
    loadedKeys,
    errorKeys,
    requestLoad,
    markLoaded,
    markError,
    retry,
    observe,
    reset,
    disconnect
  }
}
