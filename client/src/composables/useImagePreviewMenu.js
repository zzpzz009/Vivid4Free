import { computed, nextTick, ref } from 'vue'
import { useToast } from '@/utils/toast.js'

export const useImagePreviewMenu = (options = {}) => {
  const onPrimary = typeof options.onPrimary === 'function' ? options.onPrimary : null
  const onSecondary = typeof options.onSecondary === 'function' ? options.onSecondary : null

  const { success, error } = useToast()

  const previewVisible = ref(false)
  const previewImage = ref(null)
  const previewReturnFocus = ref(null)

  const menuVisible = ref(false)
  const menuImage = ref(null)
  const menuTriggerElement = ref(null)
  const menuPos = ref({ x: 0, y: 0 })

  const menuStyle = computed(() => {
    const width = 160
    const height = 168
    const pad = 8
    const vw = window.innerWidth || 0
    const vh = window.innerHeight || 0
    const left = Math.min(Math.max(menuPos.value.x, pad), Math.max(pad, vw - width - pad))
    const top = Math.min(Math.max(menuPos.value.y, pad), Math.max(pad, vh - height - pad))
    return { left: `${left}px`, top: `${top}px`, width: `${width}px` }
  })

  const openPreview = (image, returnFocusElement = document.activeElement) => {
    previewImage.value = image
    previewReturnFocus.value = returnFocusElement
    previewVisible.value = true
  }

  const closePreview = () => {
    previewVisible.value = false
    previewImage.value = null
  }

  const openMenu = ({ image, x, y, triggerElement }) => {
    menuImage.value = image
    menuPos.value = { x, y }
    menuTriggerElement.value = triggerElement || document.activeElement
    menuVisible.value = true
  }

  const closeMenu = (reason = 'outside') => {
    const trigger = menuTriggerElement.value
    menuVisible.value = false
    menuImage.value = null
    menuTriggerElement.value = null
    if (reason === 'escape' || reason === 'action') {
      nextTick(() => { if (trigger?.isConnected) trigger.focus?.() })
    }
  }

  const menuPreview = () => {
    const image = menuImage.value
    const trigger = menuTriggerElement.value
    closeMenu('silent')
    if (image) openPreview(image, trigger)
  }

  const menuPrimary = () => {
    const image = menuImage.value
    closeMenu('action')
    if (image && onPrimary) onPrimary(image)
  }

  const menuSecondary = () => {
    const image = menuImage.value
    closeMenu('action')
    if (image && onSecondary) onSecondary(image)
  }

  const menuCopy = async () => {
    const url = menuImage.value?.url || ''
    closeMenu('action')
    if (!url) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const el = document.createElement('textarea')
        el.value = url
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      success('已复制链接')
    } catch (e) {
      error('复制失败')
      console.debug('[gallery] copy failed', e)
    }
  }

  const menuOpenOriginal = () => {
    const url = menuImage.value?.url || ''
    closeMenu('action')
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return {
    previewVisible,
    previewImage,
    previewReturnFocus,
    openPreview,
    closePreview,
    menuVisible,
    menuStyle,
    openMenu,
    closeMenu,
    menuPreview,
    menuPrimary,
    menuSecondary,
    menuCopy,
    menuOpenOriginal
  }
}
