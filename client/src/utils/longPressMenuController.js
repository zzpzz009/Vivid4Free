export const createLongPressMenuController = (options = {}) => {
  const delayMs = options.delayMs ?? 520
  const moveThreshold = options.moveThreshold ?? 8
  const onMenu = typeof options.onMenu === 'function' ? options.onMenu : null

  const timers = new Map()
  const suppress = new Set()
  const pressPos = new Map()

  const clearTimer = (key) => {
    const timer = timers.get(key)
    if (timer) clearTimeout(timer)
    timers.delete(key)
  }

  const handlePointerDown = (key, payload, event) => {
    if (!key) return
    if (event?.button === 2) return
    pressPos.set(key, { x: event?.clientX ?? 0, y: event?.clientY ?? 0 })
    clearTimer(key)
    const timer = window.setTimeout(() => {
      suppress.add(key)
      if (onMenu) onMenu(payload, event)
    }, delayMs)
    timers.set(key, timer)
  }

  const handlePointerMove = (key, event) => {
    if (!key) return
    if (!timers.has(key)) return
    const origin = pressPos.get(key)
    if (!origin) return
    const dx = Math.abs((event?.clientX ?? 0) - origin.x)
    const dy = Math.abs((event?.clientY ?? 0) - origin.y)
    if (dx > moveThreshold || dy > moveThreshold) clearTimer(key)
  }

  const handlePointerUp = (key) => {
    if (!key) return
    clearTimer(key)
  }

  const shouldSuppressClick = (key) => {
    if (!key) return false
    if (!suppress.has(key)) return false
    suppress.delete(key)
    return true
  }

  const destroy = () => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    suppress.clear()
    pressPos.clear()
  }

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    shouldSuppressClick,
    destroy
  }
}

