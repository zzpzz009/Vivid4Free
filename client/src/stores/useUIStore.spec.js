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

  it('persists bounded gallery and comparison work state', () => {
    const store = useUIStore()
    store.setGallerySearchText(' facade ')
    store.setRightPanelScrollTop(240)
    store.setComparisonSliderPosition(67.4)
    store.setSelectedHistoryId('job-1')
    store.setHistoryExpanded(true)
    store.setRightPanelVisible(false)

    expect(JSON.parse(localStorage.getItem('ui:rightPanel'))).toMatchObject({
      gallerySearchText: ' facade ',
      rightPanelScrollTop: 240,
      comparisonSliderPosition: 67.4,
      selectedHistoryId: 'job-1',
      isHistoryExpanded: true,
      isRightPanelVisible: false
    })
  })

  it('normalizes unsupported resource tabs to a real panel', () => {
    const store = useUIStore()
    store.setActiveRightTab('unknown')
    expect(store.activeRightTab).toBe('common')
  })

  it('persists selected local resources without storing data/blob payloads', () => {
    const store = useUIStore()
    store.setSelectedResult({ jobId: 'task-42', url: '/view?filename=result.png&type=output', inputUrl: '/view?filename=input.png&type=input' })
    expect(store.selectedResultJobId).toBe('task-42')
    expect(store.selectedResultUrl).toContain('result.png')
    expect(store.selectedResultInputUrl).toContain('input.png')

    store.setSelectedResult({ jobId: 'task-large', url: 'data:image/png;base64,AAAA', inputUrl: 'blob:http://localhost/id' })
    expect(store.selectedResultJobId).toBe('task-large')
    expect(store.selectedResultUrl).toBe('')
    expect(store.selectedResultInputUrl).toBe('')
    expect(localStorage.getItem('ui:rightPanel')).not.toContain('base64')
    expect(localStorage.getItem('ui:rightPanel')).not.toContain('blob:')
  })
})
