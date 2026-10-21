<template>
  <div class="workspace-header relative mx-4 mb-4">
    <button type="button" class="sidebar-toggle absolute left-[14px] top-1 z-10 w-8 h-8 flex items-center justify-center rounded-lg" aria-label="切换输入面板" :aria-expanded="sidebarOpen" aria-controls="workspace-inputs" @click="toggleTabs"><img class="w-6 h-6" :src="menuIcon" alt="" /></button>

    <div class="flex flex-row items-center w-full h-10 overflow-hidden gap-4">
      <TabGroup
        class="flex-1 bg-schemes-surface-container rounded-corner-medium h-full"
        :selected-index="selectedIndex"
        @change="handleTabChange"
      >
        <TabList class="flex flex-row items-center justify-between h-full px-2">
          <Tab
            v-for="tab in navigationTabs"
            :key="tab.id"
            v-slot="{ selected }"
            class="nav-tab focus:outline-none"
            :data-testid="`workspace-tab-${tab.id}`"
          >
            <div :class="selected ? 'nav-tab-active' : 'nav-tab-inactive'">
              <div class="nav-tab-content">
                <img
                  class="nav-tab-icon"
                  :src="selected ? tab.activeIcon : tab.inactiveIcon"
                  :alt="tab.name"
                >
                <div
                  :class="selected ? 'nav-tab-text-active' : 'nav-tab-text-inactive'"
                  class="letter-spacing-m3-label-medium"
                >
                  {{ tab.name }}
                </div>
              </div>
            </div>
          </Tab>
        </TabList>
      </TabGroup>

      <!-- Vertical Divider -->
      <div class="w-[1px] h-6 bg-schemes-outline opacity-20"></div>

      <div class="flex flex-row h-10 bg-schemes-surface-container rounded-corner-medium items-center px-1">
        <div class="pt-1.5 pb-1.5 flex flex-row gap-0 items-center justify-center" data-testid="toolbar-right-tabs">
          <button
            v-for="tab in rightTabs"
            :key="tab.id"
            class="pt-1.5 pb-1.5 flex flex-col gap-1 items-center justify-center w-[120px] cursor-pointer outline-none"
            :class="tab.id === activeRightTab ? 'bg-schemes-secondary-container rounded-xl' : ''"
            :data-testid="`right-tab-${tab.id}`"
            type="button"
            @click="handleRightTabClick(tab.id)"
          >
            <div class="text-center font-m3-label-large-emphasized-font-family text-m3-label-large-emphasized-font-size leading-m3-label-large-emphasized-line-height font-m3-label-large-emphasized-font-weight relative self-stretch letter-spacing-m3-label-large-emphasized text-schemes-on-surface-variant">
              {{ tab.name }}
            </div>
          </button>
        </div>

        <div class="flex items-center pr-2 gap-1">
          <button
            class="w-8 h-8 flex items-center justify-center transition-opacity hover:opacity-90"
            :title="isRightPanelExpanded ? '收缩面板' : '展开面板'" :aria-label="isRightPanelExpanded ? '紧凑资源面板' : '展开资源面板'"
            type="button"
            data-testid="btn-expand-panel"
            @click="toggleRightPanel"
          >
            <img
              :src="isRightPanelExpanded ? navigateNextIcon : navigatePreviousIcon"
              alt="Toggle"
              class="w-8 h-8 opacity-60"
            >
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { TabGroup, TabList, Tab } from '@headlessui/vue'
import { icons } from '../utils/assets.js'

export default {
  name: 'WorkspaceHeader',
  components: {
    TabGroup,
    TabList,
    Tab
  },
  props: {
    activeWorkspaceTab: {
      type: String,
      default: 'workspace'
    },
    activeRightTab: {
      type: String,
      default: 'common'
    },
    sidebarOpen: { type: Boolean, default: true },
    rightPanelVisible: { type: Boolean, default: true },
    isRightPanelExpanded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['tab-change', 'toggle-tabs', 'right-tab-change', 'toggle-right-panel', 'resize-right-panel'],
  setup(props, { emit }) {
    const menuIcon = icons.menu
    const navigateNextIcon = icons.navigateNext
    const navigatePreviousIcon = icons.navigatePrevious

    const navigationTabs = [
      {
        id: 'workspace',
        name: '工作区',
        activeIcon: icons.workspaceActive,
        inactiveIcon: icons.workspaceInactive
      },
      {
        id: 'creative-workshop',
        name: '创意工坊',
        activeIcon: icons.localRepaintActive,
        inactiveIcon: icons.localRepaintInactive
      }
    ]

    const rightTabs = [
      { id: 'common', name: '常用' },
      { id: 'gallery', name: '图库' }
    ]

    // 计算当前选中的索引
    const selectedIndex = computed(() => {
      const index = navigationTabs.findIndex(tab => tab.id === props.activeWorkspaceTab)
      return index >= 0 ? index : 0
    })

    const handleTabChange = (index) => {
      const selectedTab = navigationTabs[index]
      if (!selectedTab) return
      emit('tab-change', selectedTab.id)
    }

    const toggleTabs = () => {
      emit('toggle-tabs')

    }

    const handleRightTabClick = (tabId) => {
      emit('right-tab-change', tabId)
    }

    const toggleRightPanel = () => {
      emit(props.rightPanelVisible ? 'resize-right-panel' : 'toggle-right-panel')
    }

    return {
      navigationTabs,
      rightTabs,
      menuIcon,
      navigateNextIcon,
      navigatePreviousIcon,
      selectedIndex,
      handleTabChange,
      toggleTabs,
      handleRightTabClick,
      toggleRightPanel
    }
  }
}
</script>

<style scoped>
@media(max-width:1023px){.workspace-header{margin-left:8px;margin-right:8px}.workspace-header :deep(.nav-tab-active){width:auto;max-width:100%}.workspace-header :deep(.nav-tab-content){padding-left:8px;padding-right:8px}.workspace-header [data-testid=toolbar-right-tabs]>button{width:64px}.sidebar-toggle{left:4px}.workspace-header :deep(.nav-tab:first-child){padding-left:28px}}
@media(max-width:767px){.workspace-header [data-testid=toolbar-right-tabs]>button{width:48px}}
</style>
