<template>
  <div class="desktop-shell podui-theme" :style="{ '--desktop-utility-top': `${utilityTop}px` }">
    <DesktopToolbar
      :engine-ready="engineReady" :engine-label="engineLabel" :account-label="accountLabel" :account-open="accountPanelOpen" :runtime-update-available="Boolean(runtimeCapability?.updateAvailable)" :runtime-compatible="runtimeCapability?.runtimeCompatible !== false"
      :client-update-available="Boolean(runtimeCapability?.clientUpdateAvailable)" :engine-installed="runtimeCapability?.installed !== false" :update-check-state="runtimeCapability?.updateCheckState || 'not_checked'" :update-open="runtimePanelOpen"
      :client-version="runtimeCapability?.clientVersion || ''"
      :available-compatible="runtimeCapability?.availableCompatible !== false"
      :runtime-compatibility-state="runtimeCapability?.runtimeCompatibilityState" :available-compatibility-state="runtimeCapability?.availableCompatibilityState"
      @runtime="runtimePanelOpen = true" @account="accountPanelOpen = !accountPanelOpen"
    />

    <main class="desktop-main">
      <WorkspaceHeader
        :active-workspace-tab="activeTab"
        :active-right-tab="uiStore.activeRightTab"
        :is-right-panel-expanded="uiStore.isRightPanelExpanded"
        :sidebar-open="sidebarOpen"
        :right-panel-visible="resourcesVisible"
        @tab-change="activeTab = $event"
        @right-tab-change="selectResourceTab"
        @toggle-right-panel="toggleResources"
        @resize-right-panel="uiStore.toggleRightPanel()"
        @toggle-tabs="sidebarOpen = !sidebarOpen"
      />
      <div v-show="activeTab === 'workspace'" id="view-workspace" class="workspace-row" role="tabpanel" aria-labelledby="tab-workspace" :class="{ 'sidebar-collapsed': !sidebarOpen, 'sidebar-open': sidebarOpen }">
        <WorkspaceContent ref="workspace" class="workspace-content" :engine-ready="engineReady" />
        <RightPanel
          id="desktop-resources" v-show="resourcesVisible" class="gallery-panel" :class="{ 'resource-overlay': windowWidth < 1024 }"
          variant="docked"
          :active-tab="uiStore.activeRightTab"
          :is-expanded="uiStore.isRightPanelExpanded"
          @image-select="selectImage"
        />
      </div>
      <section id="view-creative-workshop" v-show="activeTab !== 'workspace'" class="unavailable" role="tabpanel" aria-labelledby="tab-creative-workshop">
        <h2>创意工坊</h2>
        <p>此功能尚未开放。</p>
      </section>
    </main>
    <StatusBar />
    <div v-if="notice" class="desktop-notice" role="status">{{ notice }}</div>
    <ToastContainer />

    <RuntimeEnvironmentPanel
      :open="runtimePanelOpen"
      @close="runtimePanelOpen = false"
      @status="onRuntimeStatus"
    />
    <AccountPanel :open="accountPanelOpen" @close="accountPanelOpen = false" @import="importGallery" @output="openOutput" @agent="showAgentInfo" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import WorkspaceHeader from '@/components/WorkspaceHeader.vue'
import DesktopToolbar from '@/components/DesktopToolbar.vue'
import WorkspaceContent from '@/components/WorkspaceContent.vue'
import RightPanel from '@/components/RightPanel.vue'
import RuntimeEnvironmentPanel from '@/components/RuntimeEnvironmentPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import { useUIStore, useGalleryStore, useAuthStore } from '@/stores'
import AccountPanel from '@/components/AccountPanel.vue'
import Button from '@/ui/Button.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'

const uiStore = useUIStore()
watchEffect(() => { document.documentElement.dataset.vividSkin = uiStore.skin })
const galleryStore = useGalleryStore()
const authStore = useAuthStore()
const workspace = ref(null)
const notice = ref('')
let noticeTimer
function announce(message) { notice.value = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 4500) }
const capabilities = ref(null)
const runtimeSnapshot = ref(null)
const runtimePanelOpen = ref(false)
const accountPanelOpen = ref(false)
const activeTab = computed({ get: () => ['workspace', 'creative-workshop'].includes(uiStore.activeWorkspaceTab) ? uiStore.activeWorkspaceTab : 'workspace', set: tab => uiStore.setActiveWorkspaceTab(tab) })
const windowWidth = ref(window.innerWidth)
const utilityTop = ref(128)
let utilityObserver
function positionUtilities() { const nav = document.querySelector('.workspace-header'); if (nav) utilityTop.value = Math.round(nav.getBoundingClientRect().bottom) + 12 }
const sidebarOpen = ref(true)
const resourcesOpen = ref(false)
const resourcesVisible = computed(() => windowWidth.value >= 1024 ? uiStore.isRightPanelVisible : resourcesOpen.value)
const agentPanelOpen = ref(false)
const agentEndpoint = ref('')
const didAutoOpenRuntime = ref(false)
const runtimeCapability = computed(() => runtimeSnapshot.value || capabilities.value?.runtime || capabilities.value?.capabilities?.runtime)
const engineReady = computed(() => {
  if (runtimeCapability.value?.runtimeCompatible === false) return false
  if (runtimeCapability.value?.installed === false) return false
  if (['downloading', 'verifying', 'installing', 'starting'].includes(runtimeCapability.value?.state)) return false
  return Boolean(capabilities.value?.capabilities?.render?.ready) || runtimeCapability.value?.state === 'ready'
})
const engineLabel = computed(() => runtimeCapability.value?.installed === false ? '运行包未安装' : engineReady.value ? '引擎已连接' : '引擎依赖未齐')
const accountLabel = computed(() => ({ signed_in: `账号：${authStore.user?.displayName || authStore.user?.nickname || authStore.user?.username || '已登录'}`, checking: '账号：检查中', signed_out: '账号：未登录', unavailable: '账号：待验证' }[authStore.accountStatus] || '账号：待验证'))
let capabilitiesTimer, stopAgentTask
function toggleUtility(kind) {
  const wasOpen = kind === 'account' ? accountPanelOpen.value : kind === 'runtime' ? runtimePanelOpen.value : agentPanelOpen.value
  accountPanelOpen.value = kind === 'account' && !wasOpen
  runtimePanelOpen.value = kind === 'runtime' && !wasOpen
  agentPanelOpen.value = kind === 'agent' && !wasOpen
}
function onResize() {
  const previous = windowWidth.value
  windowWidth.value = window.innerWidth
  if (windowWidth.value < 1024 && previous >= 1024) resourcesOpen.value = false
}
function selectResourceTab(tab) { uiStore.setActiveRightTab(tab); if (windowWidth.value >= 1024) uiStore.setRightPanelVisible(true); else resourcesOpen.value = true }
function toggleResources() { if (windowWidth.value >= 1024) uiStore.setRightPanelVisible(!resourcesVisible.value); else resourcesOpen.value = !resourcesOpen.value }

function closeUtilityOnEscape(event) { if (event.key === 'Escape') { agentPanelOpen.value = false; if (windowWidth.value < 1024) resourcesOpen.value = false } }

function selectImage(payload) {
  workspace.value?.selectimg?.(payload)
}

async function importGallery() {
  if (!window.vividDesktop?.importGallery) return announce('图库导入需要桌面应用')
  try {
    const result = await window.vividDesktop.importGallery()
    if (result?.cancelled) return
    await galleryStore.loadCategories()
    announce(`已导入 ${result?.added || 0} 张图片，图库共 ${result?.total || 0} 张`)
  } catch (error) {
    announce(`导入失败：${error.message}`)
  }
}

async function showAgentInfo() {
  if (!window.vividDesktop?.agentInfo) return announce('Agent 接口需要桌面应用')
  try {
    const info = await window.vividDesktop.agentInfo()
    announce(`Agent 接口：${info.endpoint}（令牌保存在本机配置文件）`)
  } catch { announce('暂时无法读取 Agent 接口') }
}

async function openOutput() {
  await window.vividDesktop?.openOutput?.()
}

function onRuntimeStatus(status) {
  if (!status) return
  runtimeSnapshot.value = status
  if (!didAutoOpenRuntime.value && !status.installed) {
    didAutoOpenRuntime.value = true
    runtimePanelOpen.value = true
  }
}

async function refreshCapabilities() {
  try {
    const response = await fetch('/api/desktop/capabilities', { cache: 'no-store' })
    if (response.ok) {
      capabilities.value = await response.json()
      if (capabilities.value.runtime) runtimeSnapshot.value = capabilities.value.runtime
    }
  } catch { /* runtimeStatus in the panel supplies actionable local state */ }
}

onMounted(async () => {
  stopAgentTask = window.vividDesktop?.onAgentTask?.(task => {
    activeTab.value = 'workspace'
    uiStore.setSelectedHistoryId(task.id)
    uiStore.setSelectedResult({ jobId: task.id, url: task.resultImages[0] })
    uiStore.setComparisonSliderPosition(0)
  })
  utilityObserver = new ResizeObserver(positionUtilities)
  document.querySelectorAll('.desktop-toolbar, .workspace-header').forEach(element => utilityObserver.observe(element))
  positionUtilities()
  window.addEventListener('resize', onResize)
  document.addEventListener('keydown', closeUtilityOnEscape)
  await refreshCapabilities()
  capabilitiesTimer = setInterval(refreshCapabilities, 20000)
})

onBeforeUnmount(() => {
  stopAgentTask?.()
  clearTimeout(noticeTimer)
  utilityObserver?.disconnect()
  window.removeEventListener('resize', onResize)
  document.removeEventListener('keydown', closeUtilityOnEscape)
  clearInterval(capabilitiesTimer)
})
</script>

<style scoped>
.desktop-shell{height:100vh;display:flex;flex-direction:column;overflow:hidden;background:var(--schemes-surface,#17151c);color:var(--schemes-on-surface,#f3eff7)}
.desktop-main{display:flex;flex:1;min-height:0;flex-direction:column;margin-top:12px}.workspace-row{display:flex;flex:1;min-height:0}.workspace-content{min-width:0}.gallery-panel{flex:none}.unavailable{flex:1;display:grid;align-content:center;justify-items:center;color:#c9c4cf}.unavailable h2{margin:0 0 8px}.desktop-notice{position:fixed;right:18px;bottom:52px;padding:10px 14px;border-radius:8px;background:#393540;box-shadow:0 8px 24px #0005;z-index:1000}

.workspace-row{position:relative}
.sidebar-collapsed :deep([data-testid=unified-sidebar]){display:none}
.desktop-utility-panel{position:fixed;z-index:1100;top:var(--desktop-utility-top,128px);right:var(--space-4);width:min(400px,calc(100vw - 32px));padding:var(--space-6);box-shadow:var(--shadow-lg)}.utility-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space-4)}.utility-heading h2{font-size:16px}.desktop-utility-panel p{margin:var(--space-4) 0 var(--space-2);font-size:12px;color:var(--text-secondary)}.desktop-utility-panel code{font-size:12px;overflow-wrap:anywhere}
@media(max-width:1023px){.resource-overlay{position:absolute;z-index:30;right:0;top:8px;bottom:8px;height:auto!important;background:var(--schemes-surface-container);border:1px solid var(--border-color);border-radius:var(--border-radius-base);box-shadow:var(--shadow-lg)}}
</style>
