<template>
  <section v-if="open" ref="surface" class="runtime-backdrop">
    <Panel id="desktop-runtime-panel" class="runtime-panel" role="region" aria-labelledby="runtime-title">
      <header class="panel-header">
        <div>
          <h2 id="runtime-title">运行环境</h2>
        </div>
        <IconButton size="sm" aria-label="关闭运行环境面板" data-runtime-close @click="closePanel()">×</IconButton>
      </header>

      <div class="panel-body">
        <div class="runtime-intro">
          <span class="runtime-mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6h.01M7 17h.01"/></svg></span>
          <div>
            <h2>CF 独立运行包</h2>
            <p>运行包单独下载和更新；客户端与图库会保留。</p>
          </div>
          <span class="state-pill" :class="`state-${status?.state || (bridgeUnavailable ? 'error' : 'checking')}`">
            {{ stateLabel }}
          </span>
        </div>

        <div v-if="bridgeUnavailable" class="notice notice-warning" role="status">
          此功能需要桌面客户端中的运行包管理接口。图库仍可使用。
        </div>
        <div v-else-if="!status && !error" class="notice" role="status">正在读取运行包状态…</div>
        <div v-else-if="status && !status.installed" class="notice notice-warning" role="status">
          <strong>{{ availabilityMessage }}</strong>
          <span>本地渲染和放大暂不可用；安装运行包后即可使用，图库不受影响。</span>
        </div>

        <dl class="runtime-details">
          <div><dt>已安装版本</dt><dd>{{ status?.version || '未安装' }}</dd></div>
          <div><dt>可用版本</dt><dd>{{ status?.availableVersion || (status?.available ? '检查中' : '暂无') }}</dd></div>
          <div class="directory-row">
            <dt>安装目录</dt>
            <dd>{{ status?.storageDir || '尚未选择' }}</dd>
            <Button variant="outline" size="xs" type="button" class="text-button" :disabled="isBusy || isTransitioning || bridgeUnavailable" @click="chooseDirectory">选择</Button>
          </div>
        </dl>

        <div class="download-block">
          <div class="download-labels">
            <span>{{ progressLabel }}</span>
            <span>{{ byteLabel }}</span>
          </div>
          <div class="progress-track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
        </div>

        <div v-if="userStatusMessage" class="status-message" role="status">{{ userStatusMessage }}</div>
        <div v-if="error" class="notice notice-error" role="alert">
          <strong>{{ error }}</strong>
          <span>检查网络和安装目录后可以重试。</span>
        </div>

        <div class="actions">
          <Button variant="secondary" type="button" class="button button-secondary" :disabled="isBusy || isTransitioning || bridgeUnavailable" @click="checkRuntime">
            {{ busyAction === 'checking' ? '正在检查…' : '检查运行包' }}
          </Button>
          <Button variant="generate"
            type="button"
            class="button button-primary"
            :disabled="isBusy || isTransitioning || bridgeUnavailable || !status?.available"
            @click="installRuntime"
          >
            {{ installLabel }}
          </Button>
          <Button variant="secondary"
            v-if="status?.state === 'downloading'"
            type="button"
            class="button button-secondary"
            :disabled="pausePending || !canPause || bridgeUnavailable"
            @click="pauseRuntime"
          >暂停下载</Button>
          <Button variant="secondary"
            v-if="status?.installed"
            type="button"
            class="button button-secondary"
            :disabled="isBusy || isTransitioning || bridgeUnavailable"
            @click="startEngine"
          >{{ busyAction === 'starting' ? '正在启动…' : '启动 / 重试引擎' }}</Button>
        </div>

        <footer class="panel-footer">
          <span>本地渲染与放大不扣额度</span>
          <span>创意工坊尚未开放</span>
        </footer>
      </div>
    </Panel>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import Button from '@/ui/Button.vue'
import Panel from '@/ui/Panel.vue'
import IconButton from '@/ui/IconButton.vue'
import { useRuntimeEnvironment } from '@/composables/useRuntimeEnvironment.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'status'])
const surface = ref(null)
let opener
function closePanel(restore = true) { emit('close'); if (restore && opener?.isConnected) opener.focus() }
function onEscape(event) { if (props.open && event.key === 'Escape') { event.preventDefault(); closePanel() } }
function onOutside(event) { if (props.open && !surface.value?.querySelector('.runtime-panel')?.contains(event.target) && !event.target.closest?.('.runtime-entry')) closePanel(false) }
watch(() => props.open, async open => { if (open) { opener = document.activeElement; await nextTick(); surface.value?.querySelector('[data-runtime-close]')?.focus() } })
onMounted(() => { document.addEventListener('keydown', onEscape); document.addEventListener('pointerdown', onOutside, true) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onEscape); document.removeEventListener('pointerdown', onOutside, true) })
const runtime = useRuntimeEnvironment(typeof window === 'undefined' ? null : window.vividDesktop)
const { status, busyAction, pausePending, error, bridgeUnavailable } = runtime
const isBusy = computed(() => Boolean(busyAction.value))
const isTransitioning = computed(() => ['checking', 'downloading', 'verifying', 'installing', 'starting'].includes(status.value?.state))
const canPause = computed(() => busyAction.value === 'installing' && status.value?.state === 'downloading')
const userStatusMessage = computed(() => {
  if (!status.value?.message) return ''
  if (status.value.state === 'error') return status.value.message.includes('运行包下载地址尚未配置') ? status.value.message : '运行包操作失败，请检查安装目录后重试。'
  return status.value.message
})
const progress = computed(() => {
  const value = Number(status.value?.progress)
  if (Number.isFinite(value)) return Math.min(100, Math.max(0, Math.round(value)))
  const downloaded = Number(status.value?.downloadedBytes || 0)
  const total = Number(status.value?.totalBytes || 0)
  return total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : 0
})
const byteLabel = computed(() => `${formatBytes(status.value?.downloadedBytes)} / ${formatBytes(status.value?.totalBytes)}`)
const progressLabel = computed(() => {
  const state = status.value?.state
  if (state === 'verifying') return '正在校验运行包'
  if (state === 'installing') return '正在安装运行包'
  if (state === 'starting') return '正在启动引擎'
  if (state === 'ready') return '引擎已就绪'
  if (state === 'paused') return '下载已暂停'
  if (state === 'installed') return '运行包已安装'
  return '下载进度'
})
const availabilityMessage = computed(() => {
  if (status.value?.available) return '运行包尚未安装'
  if (status.value?.message?.includes('运行包下载地址尚未配置')) return '运行包下载地址尚未配置'
  return status.value?.message || '运行包暂不可用，请稍后检查。'
})
const installLabel = computed(() => {
  if (busyAction.value === 'installing') return '正在安装…'
  if (status.value?.state === 'paused') return '继续下载 / 安装'
  if (status.value?.installed && status.value?.available) return '下载并更新'
  return status.value?.downloadedBytes > 0 ? '继续下载 / 安装' : '下载并安装'
})
const stateLabels = {
  not_installed: '未安装', checking: '检查中', downloading: '下载中', paused: '已暂停',
  verifying: '校验中', installing: '安装中', installed: '已安装', starting: '启动中',
  ready: '已就绪', error: '出错了'
}
const stateLabel = computed(() => stateLabels[status.value?.state] || (bridgeUnavailable.value ? '不可用' : '读取状态'))

function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = bytes / 1024
  let index = 0
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1 }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`
}

async function refresh() {
  await runtime.refresh()
  emit('status', status.value)
}

async function operate(action, method) {
  await runtime.run(action, method)
  emit('status', status.value)
}

function checkRuntime() { return operate('checking', 'runtimeCheck') }
function installRuntime() { return operate('installing', 'runtimeInstall') }
async function pauseRuntime() {
  await runtime.pause()
  emit('status', status.value)
}
function chooseDirectory() { return operate('choosing-directory', 'chooseRuntimeDirectory') }
function startEngine() { return operate('starting', 'startEngine') }

watch(() => props.open, (open) => {
  if (open) {
    runtime.startPolling()
    void refresh()
  } else runtime.stopPolling()
}, { immediate: true })

onMounted(async () => {
  await refresh()
  if (status.value && !status.value.installed) emit('status', status.value)
})
</script>

<style scoped>
.runtime-backdrop{position:fixed;inset:0;z-index:1100;pointer-events:none}
.runtime-panel{position:absolute;top:var(--desktop-utility-top,72px);right:var(--space-4);width:min(560px,calc(100vw - 32px));max-height:calc(100dvh - var(--desktop-utility-top,72px) - 24px);overflow:auto;pointer-events:auto;box-shadow:var(--shadow-lg)}
.panel-header{display:flex;align-items:center;justify-content:space-between;padding:var(--space-5) var(--space-6);border-bottom:1px solid var(--border-color)}.panel-header h2{margin:0;font-size:16px;line-height:24px;font-weight:600}
.panel-body{padding:var(--space-6)}.runtime-intro{display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-5)}.runtime-mark{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:var(--border-radius-base);background:var(--workspace-card-bg);color:var(--brand-primary)}.runtime-intro h2{margin:0 0 var(--space-1);font-size:14px;line-height:20px}.runtime-intro p{margin:0;color:var(--text-secondary);font-size:12px;line-height:16px}.state-pill{margin-left:auto;padding:var(--space-1) var(--space-2);border:1px solid var(--border-color);border-radius:var(--border-radius-pill);color:var(--text-secondary);font-size:11px;white-space:nowrap}.state-ready,.state-installed{color:var(--ui-green-color)}.state-error{color:var(--color-red-500)}.state-downloading,.state-verifying,.state-installing,.state-starting,.state-checking{color:var(--brand-primary)}
.notice{display:grid;gap:var(--space-1);margin-bottom:var(--space-4);padding:var(--space-3);border:1px solid var(--border-color);border-radius:var(--border-radius-base);background:var(--workspace-card-bg);color:var(--text-secondary);font-size:12px;line-height:20px}.notice strong{color:var(--text-primary);font-weight:500}.notice-error strong{color:var(--color-red-500)}
.runtime-details{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin:0 0 var(--space-6)}.runtime-details>div{min-width:0}.runtime-details dt{margin-bottom:var(--space-1);color:var(--text-secondary);font-size:12px}.runtime-details dd{margin:0;color:var(--text-primary);font-size:12px;overflow-wrap:anywhere}.directory-row{grid-column:1/-1;display:grid;grid-template-columns:1fr auto;align-items:center;gap:var(--space-1) var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-color)}.directory-row dt{grid-column:1/-1}
.download-block{margin-bottom:var(--space-4)}.download-labels{display:flex;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-2);color:var(--text-secondary);font-size:12px}.progress-track{height:8px;overflow:hidden;border-radius:var(--border-radius-pill);background:var(--workspace-input-bg)}.progress-fill{height:100%;border-radius:inherit;background:var(--brand-primary);transition:width var(--transition-speed-normal)}.status-message{margin:0 0 var(--space-4);color:var(--text-secondary);font-size:12px;line-height:20px}.actions{display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-4)}.panel-footer{display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-4);margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--border-color);color:var(--text-secondary);font-size:11px;line-height:16px}
@media(max-width:640px){.panel-header,.panel-body{padding:var(--space-4)}.runtime-intro{flex-wrap:wrap}}
</style>
