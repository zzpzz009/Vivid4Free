/**
 * UI Store
 * 纯 UI 状态管理 Store - 只负责界面状态，不包含业务逻辑
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

const clampNumber = (value, min, max, fallback) => {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(min, Math.min(max, next)) : fallback
}
const safeResourceUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2048) return ''
  const url = value.trim()
  if (!url || /^(data|blob|file|javascript):/i.test(url)) return ''
  if (/[?&](?:access_token|auth|key|password|secret|token)=/i.test(url)) return ''
  return url
}

export const useUIStore = defineStore('ui', () => {
  const persistKey = 'ui:rightPanel'
  const readPersisted = () => {
    try {
      const raw = localStorage.getItem(persistKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  const writePersisted = (next) => {
    try {
      localStorage.setItem(persistKey, JSON.stringify(next))
    } catch {
      // UI persistence is best-effort when browser storage is unavailable.
    }
  }

  const persisted = readPersisted()
  const activeRightTab = ref(['common', 'gallery'].includes(persisted?.activeRightTab) || persisted?.activeRightTab === null ? persisted.activeRightTab : 'common')
  const activeWorkspaceTab = ref(typeof persisted?.activeWorkspaceTab === 'string' ? persisted.activeWorkspaceTab : 'workspace')
  const isRightPanelExpanded = ref(typeof persisted?.isRightPanelExpanded === 'boolean' ? persisted.isRightPanelExpanded : false)
  const isRightPanelVisible = ref(typeof persisted?.isRightPanelVisible === 'boolean' ? persisted.isRightPanelVisible : true)
  const gallerySearchText = ref(typeof persisted?.gallerySearchText === 'string' ? persisted.gallerySearchText.slice(0, 160) : '')
  const rightPanelScrollTop = ref(clampNumber(persisted?.rightPanelScrollTop, 0, 500000, 0))
  const comparisonSliderPosition = ref(clampNumber(persisted?.comparisonSliderPosition, 0, 100, 50))
  const selectedHistoryId = ref(typeof persisted?.selectedHistoryId === 'string' ? persisted.selectedHistoryId.slice(0, 200) : '')
  const selectedResultJobId = ref(typeof persisted?.selectedResultJobId === 'string' ? persisted.selectedResultJobId.slice(0, 200) : '')
  const selectedResultUrl = ref(safeResourceUrl(persisted?.selectedResultUrl))
  const selectedResultInputUrl = ref(safeResourceUrl(persisted?.selectedResultInputUrl))
  const isHistoryExpanded = ref(Boolean(persisted?.isHistoryExpanded))
  const showShortcutsHelp = ref(false)
  const isProd = import.meta.env.PROD
  const envUseGenerationMock = import.meta.env.VITE_USE_GENERATION_MOCK === 'true' || import.meta.env.VITE_USE_GENERATION_MOCK === '1'
  const useGenerationMock = ref(!isProd && (typeof persisted?.useGenerationMock === 'boolean' ? persisted.useGenerationMock : envUseGenerationMock))
  const mockScenario = ref(typeof persisted?.mockScenario === 'string' ? persisted.mockScenario : 'success')
  const mockFailAtPercent = ref(Number.isFinite(Number(persisted?.mockFailAtPercent)) ? Number(persisted.mockFailAtPercent) : 70)
  const mockFailRate = ref(Number.isFinite(Number(persisted?.mockFailRate)) ? Number(persisted.mockFailRate) : 0.3)
  const mockCancelAfterMs = ref(Number.isFinite(Number(persisted?.mockCancelAfterMs)) ? Number(persisted.mockCancelAfterMs) : 900)

  const persist = () => writePersisted({
    activeRightTab: activeRightTab.value,
    activeWorkspaceTab: activeWorkspaceTab.value,
    isRightPanelExpanded: isRightPanelExpanded.value,
    isRightPanelVisible: isRightPanelVisible.value,
    gallerySearchText: gallerySearchText.value,
    rightPanelScrollTop: rightPanelScrollTop.value,
    comparisonSliderPosition: comparisonSliderPosition.value,
    selectedHistoryId: selectedHistoryId.value,
    selectedResultJobId: selectedResultJobId.value,
    selectedResultUrl: selectedResultUrl.value,
    selectedResultInputUrl: selectedResultInputUrl.value,
    isHistoryExpanded: isHistoryExpanded.value,
    useGenerationMock: useGenerationMock.value,
    mockScenario: mockScenario.value,
    mockFailAtPercent: mockFailAtPercent.value,
    mockFailRate: mockFailRate.value,
    mockCancelAfterMs: mockCancelAfterMs.value
  })

  const setActiveRightTab = (tab) => {
    activeRightTab.value = tab === null ? null : (['common', 'gallery'].includes(tab) ? tab : 'common')
    persist()
  }
  const setActiveWorkspaceTab = (tab) => {
    activeWorkspaceTab.value = tab
    if (tab === 'local-repaint') isRightPanelExpanded.value = false
    else if (!activeRightTab.value) activeRightTab.value = 'common'
    persist()
  }
  const toggleRightPanel = (forceState) => {
    isRightPanelExpanded.value = typeof forceState === 'boolean' ? forceState : !isRightPanelExpanded.value
    persist()
  }
  const setRightPanelExpanded = (expanded) => {
    isRightPanelExpanded.value = Boolean(expanded)
    persist()
  }
  const setRightPanelVisible = (visible) => {
    isRightPanelVisible.value = Boolean(visible)
    persist()
  }
  const setGallerySearchText = (value) => {
    gallerySearchText.value = String(value || '').slice(0, 160)
    persist()
  }
  const setRightPanelScrollTop = (value) => {
    rightPanelScrollTop.value = clampNumber(value, 0, 500000, 0)
    persist()
  }
  const setComparisonSliderPosition = (value) => {
    comparisonSliderPosition.value = clampNumber(value, 0, 100, comparisonSliderPosition.value)
    persist()
  }
  const setSelectedHistoryId = (value) => {
    selectedHistoryId.value = typeof value === 'string' ? value.slice(0, 200) : ''
    persist()
  }
  const setSelectedResultJobId = (value) => {
    selectedResultJobId.value = typeof value === 'string' ? value.slice(0, 200) : ''
    persist()
  }
  const setSelectedResult = ({ jobId = '', url = '', inputUrl = '' } = {}) => {
    selectedResultJobId.value = typeof jobId === 'string' ? jobId.slice(0, 200) : ''
    selectedResultUrl.value = safeResourceUrl(url)
    selectedResultInputUrl.value = safeResourceUrl(inputUrl)
    persist()
  }
  const setHistoryExpanded = (value) => {
    isHistoryExpanded.value = Boolean(value)
    persist()
  }
  const toggleShortcutsHelp = () => { showShortcutsHelp.value = !showShortcutsHelp.value }
  const setShowShortcutsHelp = (show) => { showShortcutsHelp.value = Boolean(show) }
  const setUseGenerationMock = (next) => {
    if (isProd) {
      useGenerationMock.value = false
      return
    }
    useGenerationMock.value = Boolean(next)
    persist()
  }
  const toggleUseGenerationMock = () => setUseGenerationMock(!useGenerationMock.value)
  const cycleMockScenario = () => {
    const list = ['success', 'fail', 'cancel', 'randomFail']
    const idx = list.indexOf(mockScenario.value)
    mockScenario.value = list[(idx + 1) % list.length]
    persist()
  }
  const currentWorkspaceComponent = () => {
    switch (activeWorkspaceTab.value) {
      case 'batch-preview': return 'SingleEditContent'
      case 'local-repaint': return 'LocalRepaintContent'
      case 'workspace':
      default: return 'WorkspaceContent'
    }
  }

  return {
    activeRightTab, activeWorkspaceTab, isRightPanelExpanded, isRightPanelVisible, gallerySearchText, rightPanelScrollTop,
    comparisonSliderPosition, selectedHistoryId, selectedResultJobId, selectedResultUrl, selectedResultInputUrl, isHistoryExpanded,
    showShortcutsHelp, useGenerationMock, mockScenario, mockFailAtPercent, mockFailRate, mockCancelAfterMs,
    setActiveRightTab, setActiveWorkspaceTab, toggleRightPanel, setRightPanelExpanded, setRightPanelVisible,
    setGallerySearchText, setRightPanelScrollTop, setComparisonSliderPosition, setSelectedHistoryId,
    setSelectedResultJobId, setSelectedResult, setHistoryExpanded, toggleShortcutsHelp, setShowShortcutsHelp,
    setUseGenerationMock, toggleUseGenerationMock, cycleMockScenario, currentWorkspaceComponent
  }
})

export default useUIStore
