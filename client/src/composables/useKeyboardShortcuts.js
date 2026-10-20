// Keyboard shortcuts composable
import { onMounted, onUnmounted } from 'vue'

export function useKeyboardShortcuts(shortcuts = {}) {
  const handleKeyDown = (event) => {
    // Build key combination string
    const keys = []
    
    if (event.ctrlKey || event.metaKey) keys.push('cmd')
    if (event.altKey) keys.push('alt')
    if (event.shiftKey) keys.push('shift')
    
    // Add the main key
    const key = event.key.toLowerCase()
    keys.push(key)
    
    const combination = keys.join('+')
    
    // Check if this combination has a handler
    if (shortcuts[combination]) {
      event.preventDefault()
      shortcuts[combination](event)
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    handleKeyDown
  }
}

// Common shortcut combinations
export const SHORTCUTS = {
  GENERATE: 'cmd+enter',
  PREVIEW: 'cmd+shift+p',
  UPLOAD_IMAGE: 'cmd+u',
  UPLOAD_REFERENCE: 'cmd+shift+u',
  TOGGLE_ADVANCED: 'cmd+shift+a',
  SAVE: 'cmd+s',
  COPY: 'cmd+c',
  PASTE: 'cmd+v',
  UNDO: 'cmd+z',
  REDO: 'cmd+shift+z',
  ESCAPE: 'escape',
  ENTER: 'enter',
  SPACE: ' '
}

// Shortcut descriptions for help
export const SHORTCUT_DESCRIPTIONS = {
  [SHORTCUTS.GENERATE]: '生成图像',
  [SHORTCUTS.PREVIEW]: '预览效果',
  [SHORTCUTS.UPLOAD_IMAGE]: '上传待处理图片',
  [SHORTCUTS.UPLOAD_REFERENCE]: '上传参考图片',
  [SHORTCUTS.TOGGLE_ADVANCED]: '切换高级参数',
  [SHORTCUTS.SAVE]: '保存当前设置',
  [SHORTCUTS.ESCAPE]: '关闭弹窗/取消操作'
}

// Helper function to format shortcut for display
export function formatShortcut(shortcut) {
  return shortcut
    .split('+')
    .map(key => {
      switch (key) {
        case 'cmd': return '⌘'
        case 'ctrl': return 'Ctrl'
        case 'alt': return '⌥'
        case 'shift': return '⇧'
        case 'enter': return '↵'
        case 'escape': return 'Esc'
        case ' ': return 'Space'
        default: return key.toUpperCase()
      }
    })
    .join(' + ')
}
