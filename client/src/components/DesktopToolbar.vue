<template>
  <header class="desktop-toolbar">
    <div class="brand"><strong>VividDesktop</strong><span>本地 AI 渲染</span></div>
    <div class="toolbar-actions">
      <button type="button" class="runtime-entry" :title="`运行环境：${engineLabel}`" :aria-label="`运行环境：${engineLabel}`" @click="$emit('runtime')">
        <span class="engine-dot" :class="engineReady ? 'ready' : 'waiting'" aria-hidden="true" />
        <span>{{ engineReady ? '引擎已连接' : engineLabel === '运行包未安装' ? '安装运行包' : '引擎未就绪' }}</span>
      </button>
      <span class="toolbar-divider" aria-hidden="true" />
      <button type="button" class="account-entry" :title="accountLabel" :aria-expanded="accountOpen" aria-controls="desktop-account-panel" @click="$emit('account')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg>
        <span class="account-name">{{ accountText }}</span>
      </button>
      <div v-if="desktopWindow" class="window-controls" role="group" aria-label="窗口操作">
        <button type="button" class="window-control" title="最小化" aria-label="最小化" @click="controlWindow('minimize')"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 8h10"/></svg></button>
        <button type="button" class="window-control" :title="maximized ? '还原' : '最大化'" :aria-label="maximized ? '还原' : '最大化'" @click="controlWindow('toggle-maximize')"><svg v-if="maximized" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 5V3h8v8h-2M3 5h8v8H3Z"/></svg><svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx=".5"/></svg></button>
        <button type="button" class="window-control window-close" title="关闭窗口" aria-label="关闭窗口" @click="controlWindow('close')"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg></button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  engineReady: Boolean,
  engineLabel: { type: String, required: true },
  accountLabel: { type: String, required: true },
  accountOpen: Boolean
})
defineEmits(['runtime', 'account'])
const accountText = computed(() => props.accountLabel === '账号：未登录' ? '登录 / 注册' : props.accountLabel.replace(/^账号：/, ''))
const desktopWindow = Boolean(window.vividDesktop?.windowAction)
const maximized = ref(false)
let unsubscribeWindow
function updateWindowState(state) { maximized.value = Boolean(state?.maximized || state?.fullscreen) }
async function controlWindow(action) { await window.vividDesktop?.windowAction(action) }
onMounted(async () => {
  unsubscribeWindow = window.vividDesktop?.onWindowState(updateWindowState)
  if (window.vividDesktop?.windowState) updateWindowState(await window.vividDesktop.windowState())
})
onBeforeUnmount(() => unsubscribeWindow?.())
</script>

<style scoped>
.desktop-toolbar{height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 18px;border-bottom:1px solid #393640;background:#201e25;-webkit-app-region:drag;user-select:none}
.brand,.toolbar-actions{display:flex;align-items:center}.brand{gap:14px;white-space:nowrap}.brand span{font-size:12px;color:#aaa5b2}.toolbar-actions{gap:8px;min-width:0}
.toolbar-actions{-webkit-app-region:no-drag}.toolbar-actions button{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:32px;padding:0 10px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--schemes-on-surface-variant);font-size:12px;line-height:1;cursor:pointer;white-space:nowrap}
.toolbar-actions button:hover,.toolbar-actions button[aria-expanded=true]{background:#2d2a33}.toolbar-actions button:focus-visible{outline:2px solid var(--schemes-primary);outline-offset:2px}.toolbar-actions svg{width:16px;height:16px;flex:none}
.engine-dot{width:6px;height:6px;flex:none;border-radius:50%}.engine-dot.ready{background:#74d29a}.engine-dot.waiting{background:#e6bc66}.toolbar-divider{height:16px;width:1px;background:#393640;flex:none}
.account-name{max-width:140px;overflow:hidden;text-overflow:ellipsis}.window-controls{display:flex;gap:2px;margin-left:8px;padding-left:8px;border-left:1px solid #393640}.toolbar-actions .window-control{width:36px;padding:0}.toolbar-actions .window-control svg{width:14px;height:14px}.toolbar-actions .window-close:hover{background:var(--schemes-error-container);color:var(--schemes-on-error-container)}
@media(max-width:767px){.desktop-toolbar{padding:0 12px;gap:8px}.brand span{display:none}.brand{font-size:14px}.toolbar-actions{gap:4px}.toolbar-actions button{padding:0 8px}.account-name{max-width:88px}}
</style>
