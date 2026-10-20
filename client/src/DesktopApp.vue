<template>
  <div class="desktop-shell podui-theme" :style="{ '--desktop-utility-top': `${utilityTop}px` }">
    <header class="desktop-toolbar">
      <div class="brand"><strong>VividDesktop</strong><span>本地 AI 渲染</span></div>
      <div class="toolbar-actions">
        <span class="engine-state" :class="engineReady ? 'ready' : 'waiting'">{{ engineLabel }}</span>
        <Button variant="secondary" size="sm" class="account-entry" :aria-expanded="accountPanelOpen" aria-controls="desktop-account-panel" @click="toggleUtility('account')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg>{{ accountLabel }}
        </Button>
        <Button variant="secondary" size="sm" class="runtime-entry" :aria-expanded="runtimePanelOpen" aria-controls="desktop-runtime-panel" @click="toggleUtility('runtime')">运行环境</Button>
        <Button variant="ghost" size="sm" @click="importGallery">导入图库</Button>
        <Button variant="ghost" size="sm" :aria-expanded="agentPanelOpen" @click="showAgentInfo">Agent 接口</Button>
        <Button variant="ghost" size="sm" @click="openOutput">输出目录</Button>
      </div>
    </header>

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
    <ToastContainer />
    <Panel v-if="agentPanelOpen" class="desktop-utility-panel" role="region" aria-labelledby="agent-title">
      <div class="utility-heading"><h2 id="agent-title">Agent 接口</h2><IconButton size="sm" aria-label="关闭 Agent 接口面板" @click="agentPanelOpen = false">×</IconButton></div>
      <p>本机控制地址</p><code>{{ agentEndpoint }}</code><p>连接令牌保存在本机配置文件中。</p>
    </Panel>
    <RuntimeEnvironmentPanel
      :open="runtimePanelOpen"
      @close="runtimePanelOpen = false"
      @status="onRuntimeStatus"
    />
    <AccountPanel :open="accountPanelOpen" @close="accountPanelOpen = false" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import WorkspaceHeader from '@/components/WorkspaceHeader.vue'
import WorkspaceContent from '@/components/WorkspaceContent.vue'
import RightPanel from '@/components/RightPanel.vue'
import RuntimeEnvironmentPanel from '@/components/RuntimeEnvironmentPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import { useUIStore, useGalleryStore, useAuthStore } from '@/stores'
import AccountPanel from '@/components/AccountPanel.vue'
import Button from '@/ui/Button.vue'
import Panel from '@/ui/Panel.vue'
import IconButton from '@/ui/IconButton.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useToast } from '@/utils/toast.js'

const uiStore = useUIStore()
const galleryStore = useGalleryStore()
const authStore = useAuthStore()
const workspace = ref(null)
const { info: announce } = useToast()
const capabilities = ref(null)
const runtimeSnapshot = ref(null)
const runtimePanelOpen = ref(false)
const accountPanelOpen = ref(false)
const activeTab = computed({ get: () => ['workspace', 'creative-workshop'].includes(uiStore.activeWorkspaceTab) ? uiStore.activeWorkspaceTab : 'workspace', set: tab => uiStore.setActiveWorkspaceTab(tab) })
const windowWidth = ref(window.innerWidth)
const utilityTop = ref(128)
let utilityObserver
function positionUtilities() { const nav = document.querySelector('.workspace-header'); if (nav) utilityTop.value = Math.round(nav.getBoundingClientRect().bottom) + 12 }
const sidebarOpen = ref(window.innerWidth >= 768)
const resourcesOpen = ref(false)
const resourcesVisible = computed(() => windowWidth.value >= 1024 ? uiStore.isRightPanelVisible : resourcesOpen.value)
const agentPanelOpen = ref(false)
const agentEndpoint = ref('')
const didAutoOpenRuntime = ref(false)
const runtimeCapability = computed(() => runtimeSnapshot.value || capabilities.value?.runtime || capabilities.value?.capabilities?.runtime)
const engineReady = computed(() => {
  if (runtimeCapability.value?.installed === false) return false
  if (['downloading', 'verifying', 'installing', 'starting'].includes(runtimeCapability.value?.state)) return false
  return Boolean(capabilities.value?.capabilities?.render?.ready) || runtimeCapability.value?.state === 'ready'
})
const engineLabel = computed(() => runtimeCapability.value?.installed === false ? '运行包未安装' : engineReady.value ? '引擎已连接' : '引擎依赖未齐')
const accountLabel = computed(() => ({ signed_in: `账号：${authStore.user?.displayName || authStore.user?.nickname || authStore.user?.username || '已登录'}`, checking: '账号：检查中', signed_out: '账号：未登录', unavailable: '账号：待验证' }[authStore.accountStatus] || '账号：待验证'))
let capabilitiesTimer
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
  if (windowWidth.value < 768 && previous >= 768) sidebarOpen.value = false
}
function selectResourceTab(tab) { uiStore.setActiveRightTab(tab); if (windowWidth.value >= 1024) uiStore.setRightPanelVisible(true); else resourcesOpen.value = true }
function toggleResources() { if (windowWidth.value >= 1024) uiStore.setRightPanelVisible(!resourcesVisible.value); else resourcesOpen.value = !resourcesOpen.value }

function closeUtilityOnEscape(event) { if (event.key === 'Escape') { agentPanelOpen.value = false; if (windowWidth.value < 1024) resourcesOpen.value = false; if (windowWidth.value < 768) sidebarOpen.value = false } }

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
    agentEndpoint.value = info.endpoint
    toggleUtility('agent')
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
  utilityObserver = new ResizeObserver(positionUtilities)
  document.querySelectorAll('.desktop-toolbar, .workspace-header').forEach(element => utilityObserver.observe(element))
  positionUtilities()
  window.addEventListener('resize', onResize)
  document.addEventListener('keydown', closeUtilityOnEscape)
  void authStore.initAuth()
  await refreshCapabilities()
  capabilitiesTimer = setInterval(refreshCapabilities, 20000)
})

onBeforeUnmount(() => {
  utilityObserver?.disconnect()
  window.removeEventListener('resize', onResize)
  document.removeEventListener('keydown', closeUtilityOnEscape)
  clearInterval(capabilitiesTimer)
})
</script>

<style scoped>
.desktop-shell{--desktop-utility-top:72px;height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-page);color:var(--text-primary)}
.desktop-toolbar{min-height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding:var(--space-2) var(--space-4);border-bottom:1px solid var(--border-color);background:var(--workspace-bg-header)}
.brand,.toolbar-actions{display:flex;align-items:center;gap:var(--space-3)}.brand{flex:none}.brand strong{font-size:16px;line-height:24px}.brand span{font-size:12px;color:var(--text-secondary)}.toolbar-actions{gap:var(--space-2);flex-wrap:wrap;justify-content:flex-end}.account-entry{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.engine-state{font-size:12px;white-space:nowrap;color:var(--text-secondary)}.engine-state.ready{color:var(--ui-green-color)}
.desktop-main{display:flex;flex:1;min-height:0;flex-direction:column}.workspace-row{position:relative;display:flex;flex:1;min-height:0}.workspace-content{min-width:0}.gallery-panel{flex:none}.sidebar-collapsed :deep([data-testid=unified-sidebar]){display:none}.unavailable{flex:1;display:grid;align-content:center;justify-items:center;color:var(--text-secondary)}.unavailable h2{margin:0 0 var(--space-2);font-size:16px;color:var(--text-primary)}
.desktop-utility-panel{position:fixed;z-index:1100;top:var(--desktop-utility-top);right:var(--space-4);width:min(400px,calc(100vw - 32px));padding:var(--space-6);box-shadow:var(--shadow-lg)}.utility-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space-4)}.utility-heading h2{font-size:16px}.desktop-utility-panel p{margin:var(--space-4) 0 var(--space-2);font-size:12px;color:var(--text-secondary)}.desktop-utility-panel code{font-size:12px;overflow-wrap:anywhere}
@media(max-width:1280px){.brand span{display:none}}
@media(max-width:1023px){.desktop-shell{--desktop-utility-top:112px}.desktop-toolbar{flex-wrap:wrap;gap:var(--space-2)}.toolbar-actions{gap:var(--space-1)}.resource-overlay{position:absolute;z-index:30;right:0;top:var(--space-2);bottom:var(--space-2);height:auto!important;background:var(--bg-component-solid);border:1px solid var(--border-color);border-radius:var(--border-radius-lg);box-shadow:var(--shadow-lg)}}
@media(max-width:767px){.desktop-toolbar{padding:var(--space-2)}.brand strong{font-size:14px}.toolbar-actions :deep(button){padding:var(--space-2);font-size:12px}.sidebar-open :deep([data-testid=unified-sidebar]){position:absolute;z-index:35;left:var(--space-2);top:var(--space-2);bottom:var(--space-2);height:auto;background:var(--workspace-bg-sidebar);border:1px solid var(--border-color);border-radius:var(--border-radius-lg);box-shadow:var(--shadow-lg)}.account-entry{max-width:150px}}
</style>
