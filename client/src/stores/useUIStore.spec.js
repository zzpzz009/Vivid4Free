import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUIStore } from './useUIStore'

describe('useUIStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    if (!global.localStorage) {
      const store = new Map()
      global.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear()
      }
    }
    localStorage.clear()
  })

  it('toggleRightPanel should toggle state', () => {
    const store = useUIStore()
    store.isRightPanelExpanded = false
    store.toggleRightPanel()
    expect(store.isRightPanelExpanded).toBe(true)
    store.toggleRightPanel()
    expect(store.isRightPanelExpanded).toBe(false)
  })

  it('toggleRightPanel should accept forceState', () => {
    const store = useUIStore()
    store.isRightPanelExpanded = false
    store.toggleRightPanel(true)
    expect(store.isRightPanelExpanded).toBe(true)
    store.toggleRightPanel(false)
    expect(store.isRightPanelExpanded).toBe(false)
  })

  it('setActiveWorkspaceTab to local-repaint should collapse expanded state', () => {
    const store = useUIStore()
    store.activeRightTab = 'common'
    store.isRightPanelExpanded = true
    
    store.setActiveWorkspaceTab('local-repaint')
    
    expect(store.activeWorkspaceTab).toBe('local-repaint')
    expect(store.activeRightTab).toBe('common')
    expect(store.isRightPanelExpanded).toBe(false)
  })

  it('setActiveWorkspaceTab to workspace should restore default right tab if null', () => {
    const store = useUIStore()
    store.activeRightTab = null
    
    store.setActiveWorkspaceTab('workspace')
    
    expect(store.activeWorkspaceTab).toBe('workspace')
    expect(store.activeRightTab).toBe('common')
  })
  
  it('setActiveWorkspaceTab to workspace should keep existing right tab if not null', () => {
    const store = useUIStore()
    store.activeRightTab = 'gallery'
    
    store.setActiveWorkspaceTab('workspace')
    
    expect(store.activeWorkspaceTab).toBe('workspace')
    expect(store.activeRightTab).toBe('gallery')
  })

  it('should hydrate right panel state from localStorage', () => {
    localStorage.setItem(
      'ui:rightPanel',
      JSON.stringify({ activeRightTab: 'gallery', activeWorkspaceTab: 'workspace', isRightPanelExpanded: true })
    )
    const store = useUIStore()
    expect(store.activeRightTab).toBe('gallery')
    expect(store.activeWorkspaceTab).toBe('workspace')
    expect(store.isRightPanelExpanded).toBe(true)
  })
})
