<template>
  <div class="desktop-shell">
    <header class="desktop-toolbar">
      <div class="brand"><strong>VividDesktop</strong><span>本地 AI 渲染</span></div>
      <div class="toolbar-actions">
        <span class="engine-state" :class="engineReady ? 'ready' : 'waiting'">{{ engineLabel }}</span>
        <span class="account-state">账号接入待配置</span>
        <button type="button" class="runtime-entry" @click="runtimePanelOpen = true">运行环境</button>
        <button type="button" @click="importGallery">导入图库</button>
        <button type="button" @click="showAgentInfo">Agent 接口</button>
        <button type="button" @click="openOutput">输出目录</button>
      </div>
    </header>

    <main class="desktop-main">
      <WorkspaceHeader
        :active-workspace-tab="activeTab"
        :active-right-tab="uiStore.activeRightTab"
        :is-right-panel-expanded="uiStore.isRightPanelExpanded"
        @tab-change="activeTab = $event"
        @right-tab-change="uiStore.setActiveRightTab"
        @toggle-right-panel="uiStore.toggleRightPanel"
      />
      <div v-show="activeTab === 'workspace'" class="workspace-row">
        <WorkspaceContent ref="workspace" class="workspace-content" />
        <RightPanel
          class="gallery-panel"
          variant="docked"
          :active-tab="uiStore.activeRightTab"
          :is-expanded="uiStore.isRightPanelExpanded"
          @image-select="selectImage"
        />
      </div>
      <section v-show="activeTab !== 'workspace'" class="unavailable">
        <h2>创意工坊</h2>
        <p>此功能尚未开放。</p>
      </section>
    </main>
    <StatusBar />
    <div v-if="notice" class="desktop-notice" role="status">{{ notice }}</div>
    <RuntimeEnvironmentPanel
      :open="runtimePanelOpen"
      @close="runtimePanelOpen = false"
      @status="onRuntimeStatus"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import WorkspaceHeader from '@/components/WorkspaceHeader.vue'
import WorkspaceContent from '@/components/WorkspaceContent.vue'
import RightPanel from '@/components/RightPanel.vue'
import RuntimeEnvironmentPanel from '@/components/RuntimeEnvironmentPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import { useUIStore, useGalleryStore } from '@/stores'

const uiStore = useUIStore()
const galleryStore = useGalleryStore()
const workspace = ref(null)
const notice = ref('')
const capabilities = ref(null)
const runtimeSnapshot = ref(null)
const runtimePanelOpen = ref(false)
const activeTab = ref('workspace')
const didAutoOpenRuntime = ref(false)
const runtimeCapability = computed(() => runtimeSnapshot.value || capabilities.value?.runtime || capabilities.value?.capabilities?.runtime)
const engineReady = computed(() => {
  if (runtimeCapability.value?.installed === false) return false
  if (runtimeCapability.value?.state) return runtimeCapability.value.state === 'ready'
  return Boolean(capabilities.value?.capabilities?.render?.ready)
})
const engineLabel = computed(() => runtimeCapability.value?.installed === false ? '运行包未安装' : engineReady.value ? '引擎已连接' : '引擎依赖未齐')
let noticeTimer
let capabilitiesTimer

function announce(message) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 4500)
}

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
  const info = await window.vividDesktop.agentInfo()
  announce(`Agent 接口：${info.endpoint}（令牌保存在本机配置文件）`)
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
  await refreshCapabilities()
  capabilitiesTimer = setInterval(refreshCapabilities, 20000)
})

onBeforeUnmount(() => {
  clearTimeout(noticeTimer)
  clearInterval(capabilitiesTimer)
})
</script>

<style scoped>
.desktop-shell{height:100vh;display:flex;flex-direction:column;overflow:hidden;background:var(--schemes-surface,#17151c);color:var(--schemes-on-surface,#f3eff7)}
.desktop-toolbar{height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #393640;background:#201e25}
.brand,.toolbar-actions{display:flex;align-items:center;gap:14px}.brand span,.account-state{font-size:12px;color:#aaa5b2}.toolbar-actions{gap:8px}.toolbar-actions button{padding:6px 10px;border:1px solid #514c59;border-radius:7px;background:#2d2a33;color:inherit;cursor:pointer}.toolbar-actions .runtime-entry{border-color:#7562b3;color:#d4c8ff}.engine-state{font-size:12px}.engine-state.ready{color:#74d29a}.engine-state.waiting{color:#e6bc66}
.desktop-main{display:flex;flex:1;min-height:0;flex-direction:column;margin-top:12px}.workspace-row{display:flex;flex:1;min-height:0}.workspace-content{min-width:0}.gallery-panel{flex:none}.unavailable{flex:1;display:grid;align-content:center;justify-items:center;color:#c9c4cf}.unavailable h2{margin:0 0 8px}.desktop-notice{position:fixed;right:18px;bottom:52px;padding:10px 14px;border-radius:8px;background:#393540;box-shadow:0 8px 24px #0005;z-index:1000}
</style>
