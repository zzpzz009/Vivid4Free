/**
 * UI Store
 * 纯 UI 状态管理 Store - 只负责界面状态，不包含业务逻辑
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

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
    } catch (error) {
      return
    }
  }

  const persisted = readPersisted()

  // ===== UI 状态 =====
  const activeRightTab = ref(typeof persisted?.activeRightTab === 'string' ? persisted.activeRightTab : 'common')
  const activeWorkspaceTab = ref(typeof persisted?.activeWorkspaceTab === 'string' ? persisted.activeWorkspaceTab : 'workspace')
  const isRightPanelExpanded = ref(typeof persisted?.isRightPanelExpanded === 'boolean' ? persisted.isRightPanelExpanded : false)
  const showShortcutsHelp = ref(false)
  const isProd = import.meta.env.PROD
  const envUseGenerationMock = import.meta.env.VITE_USE_GENERATION_MOCK === 'true' || import.meta.env.VITE_USE_GENERATION_MOCK === '1'
  const useGenerationMock = ref(!isProd && (typeof persisted?.useGenerationMock === 'boolean' ? persisted.useGenerationMock : envUseGenerationMock))
  const mockScenario = ref(typeof persisted?.mockScenario === 'string' ? persisted.mockScenario : 'success')
  const mockFailAtPercent = ref(Number.isFinite(Number(persisted?.mockFailAtPercent)) ? Number(persisted.mockFailAtPercent) : 70)
  const mockFailRate = ref(Number.isFinite(Number(persisted?.mockFailRate)) ? Number(persisted.mockFailRate) : 0.3)
  const mockCancelAfterMs = ref(Number.isFinite(Number(persisted?.mockCancelAfterMs)) ? Number(persisted.mockCancelAfterMs) : 900)

  // ===== 面板控制 =====
  const setActiveRightTab = (tab) => {
    activeRightTab.value = tab
    writePersisted({
      activeRightTab: activeRightTab.value,
      activeWorkspaceTab: activeWorkspaceTab.value,
      isRightPanelExpanded: isRightPanelExpanded.value,
      useGenerationMock: useGenerationMock.value,
      mockScenario: mockScenario.value,
      mockFailAtPercent: mockFailAtPercent.value,
      mockFailRate: mockFailRate.value,
      mockCancelAfterMs: mockCancelAfterMs.value
    })
  }

  const setActiveWorkspaceTab = (tab) => {
    activeWorkspaceTab.value = tab
    
    // 模式切换时的状态重置钩子
    if (tab === 'local-repaint') {
      isRightPanelExpanded.value = false
    } else {
      // 切回常规模式：确保右侧面板有选中项（如果之前被隐藏了）
      if (!activeRightTab.value) {
        activeRightTab.value = 'common'
      }
    }
    writePersisted({
      activeRightTab: activeRightTab.value,
      activeWorkspaceTab: activeWorkspaceTab.value,
      isRightPanelExpanded: isRightPanelExpanded.value,
      useGenerationMock: useGenerationMock.value,
      mockScenario: mockScenario.value,
      mockFailAtPercent: mockFailAtPercent.value,
      mockFailRate: mockFailRate.value,
      mockCancelAfterMs: mockCancelAfterMs.value
    })
  }

  const toggleRightPanel = (forceState) => {
    if (typeof forceState === 'boolean') {
      isRightPanelExpanded.value = forceState
    } else {
      isRightPanelExpanded.value = !isRightPanelExpanded.value
    }
    writePersisted({
      activeRightTab: activeRightTab.value,
      activeWorkspaceTab: activeWorkspaceTab.value,
      isRightPanelExpanded: isRightPanelExpanded.value,
      useGenerationMock: useGenerationMock.value,
      mockScenario: mockScenario.value,
      mockFailAtPercent: mockFailAtPercent.value,
      mockFailRate: mockFailRate.value,
      mockCancelAfterMs: mockCancelAfterMs.value
    })
  }

  const setRightPanelExpanded = (expanded) => {
    isRightPanelExpanded.value = expanded
    writePersisted({
      activeRightTab: activeRightTab.value,
      activeWorkspaceTab: activeWorkspaceTab.value,
      isRightPanelExpanded: isRightPanelExpanded.value,
      useGenerationMock: useGenerationMock.value,
      mockScenario: mockScenario.value,
      mockFailAtPercent: mockFailAtPercent.value,
      mockFailRate: mockFailRate.value,
      mockCancelAfterMs: mockCancelAfterMs.value
    })
  }

  const toggleShortcutsHelp = () => {
    showShortcutsHelp.value = !showShortcutsHelp.value
  }

  const setShowShortcutsHelp = (show) => {
    showShortcutsHelp.value = show
  }

  const setUseGenerationMock = (next) => {
    if (isProd) {
      useGenerationMock.value = false
      return
    }
    useGenerationMock.value = Boolean(next)
    writePersisted({
      activeRightTab: activeRightTab.value,
      activeWorkspaceTab: activeWorkspaceTab.value,
      isRightPanelExpanded: isRightPanelExpanded.value,
      useGenerationMock: useGenerationMock.value,
      mockScenario: mockScenario.value,
      mockFailAtPercent: mockFailAtPercent.value,
      mockFailRate: mockFailRate.value,
      mockCancelAfterMs: mockCancelAfterMs.value
    })
  }

  const toggleUseGenerationMock = () => {
    setUseGenerationMock(!useGenerationMock.value)
  }

  const cycleMockScenario = () => {
    const list = ['success', 'fail', 'cancel', 'randomFail']
    const idx = list.indexOf(mockScenario.value)
    mockScenario.value = list[(idx + 1) % list.length]
    writePersisted({
      activeRightTab: activeRightTab.value,
      activeWorkspaceTab: activeWorkspaceTab.value,
      isRightPanelExpanded: isRightPanelExpanded.value,
      useGenerationMock: useGenerationMock.value,
      mockScenario: mockScenario.value,
      mockFailAtPercent: mockFailAtPercent.value,
      mockFailRate: mockFailRate.value,
      mockCancelAfterMs: mockCancelAfterMs.value
    })
  }

  const currentWorkspaceComponent = () => {
    switch (activeWorkspaceTab.value) {
      case 'batch-preview':
        return 'SingleEditContent'
      case 'local-repaint':
        return 'LocalRepaintContent'
      case 'workspace':
      default:
        return 'WorkspaceContent'
    }
  }

  return {
    // State
    activeRightTab,
    activeWorkspaceTab,
    isRightPanelExpanded,
    showShortcutsHelp,
    useGenerationMock,
    mockScenario,
    mockFailAtPercent,
    mockFailRate,
    mockCancelAfterMs,

    // Actions
    setActiveRightTab,
    setActiveWorkspaceTab,
    toggleRightPanel,
    setRightPanelExpanded,
    toggleShortcutsHelp,
    setShowShortcutsHelp,
    setUseGenerationMock,
    toggleUseGenerationMock,
    cycleMockScenario,

    // Computed
    currentWorkspaceComponent
  }
})

export default useUIStore
