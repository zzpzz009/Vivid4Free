const MAX_ENTRIES = 24
const cache = new Map()

function touch(key, value) {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size <= MAX_ENTRIES) return
  const firstKey = cache.keys().next().value
  cache.delete(firstKey)
}

export function getDragFile(url) {
  if (!url) return null
  const key = String(url)
  const value = cache.get(key)
  if (!value) return null
  touch(key, value)
  return value
}

export async function warmDragFile(url, suggestedName) {
  if (!url) return null
  const key = String(url)
  const cached = cache.get(key)
  if (cached) {
    touch(key, cached)
    return cached
  }
  const response = await fetch(key, { cache: 'force-cache' })
  if (!response.ok) return null
  const blob = await response.blob()
  if (!blob || !String(blob.type || '').startsWith('image/')) return null
  const fileName = String(suggestedName || '').trim() || (() => {
    try {
      const u = new URL(key, window.location.href)
      return u.pathname.split('/').pop() || 'image'
    } catch (e) {
      return key.split('/').pop() || 'image'
    }
  })()
  const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
  touch(key, file)
  return file
}

