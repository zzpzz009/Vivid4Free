<template>
  <section v-if="open" ref="surface" class="runtime-backdrop" role="presentation" @click.self="$emit('close')">
    <article class="runtime-panel" role="dialog" aria-modal="true" aria-labelledby="runtime-title">
      <header class="panel-header">
        <div>
          <p class="eyebrow">VIVID DESKTOP</p>
          <h1 id="runtime-title">运行环境</h1>
        </div>
        <button class="icon-button" type="button" aria-label="关闭运行环境面板" data-runtime-close @click="$emit('close')">×</button>
      </header>

      <div class="panel-body">
        <div class="runtime-intro">
          <span class="runtime-mark" aria-hidden="true">V</span>
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
            <button type="button" class="text-button" :disabled="isBusy || isTransitioning || bridgeUnavailable" @click="chooseDirectory">选择</button>
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
          <button type="button" class="button button-secondary" :disabled="isBusy || isTransitioning || bridgeUnavailable" @click="checkRuntime">
            {{ busyAction === 'checking' ? '正在检查…' : '检查运行包' }}
          </button>
          <button
            type="button"
            class="button button-primary"
            :disabled="isBusy || isTransitioning || bridgeUnavailable || !status?.available"
            @click="installRuntime"
          >
            {{ installLabel }}
          </button>
          <button
            v-if="status?.state === 'downloading'"
            type="button"
            class="button button-secondary"
            :disabled="pausePending || !canPause || bridgeUnavailable"
            @click="pauseRuntime"
          >暂停下载</button>
          <button
            v-if="status?.installed"
            type="button"
            class="button button-secondary"
            :disabled="isBusy || isTransitioning || bridgeUnavailable"
            @click="startEngine"
          >{{ busyAction === 'starting' ? '正在启动…' : '启动 / 重试引擎' }}</button>
        </div>

        <footer class="panel-footer">
          <span>VividAI 统一账号</span>
          <span>本地渲染与放大不扣额度</span>
          <span>创意工坊尚未开放</span>
        </footer>
      </div>
    </article>
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
.runtime-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:24px;background:#100e14aa;backdrop-filter:blur(5px)}
.runtime-panel{width:min(620px,100%);max-height:min(760px,calc(100vh - 48px));overflow:auto;border:1px solid #48434f;border-radius:18px;background:#211f27;color:#f5f1f8;box-shadow:0 24px 80px #0008}
.panel-header{display:flex;align-items:center;justify-content:space-between;padding:22px 26px 18px;border-bottom:1px solid #393640}.eyebrow{margin:0 0 5px;color:#aaa4b0;font-size:10px;letter-spacing:.16em}.panel-header h1{margin:0;font-size:22px;font-weight:650}.icon-button{width:34px;height:34px;border:1px solid #514c59;border-radius:50%;background:transparent;color:#ddd7e2;font-size:23px;line-height:1;cursor:pointer}
.panel-body{padding:22px 26px 18px}.runtime-intro{display:flex;align-items:center;gap:14px;margin-bottom:20px}.runtime-mark{display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:linear-gradient(145deg,#9c7dff,#6f54d8);font-size:22px;font-weight:750}.runtime-intro h2{margin:0 0 5px;font-size:15px}.runtime-intro p{margin:0;color:#aaa5b1;font-size:12px}.state-pill{margin-left:auto;padding:6px 10px;border:1px solid #4c4853;border-radius:99px;color:#c8c2cd;font-size:11px;white-space:nowrap}.state-ready,.state-installed{border-color:#387954;color:#84e3a7}.state-error{border-color:#8d4e4e;color:#ffaaa5}.state-downloading,.state-verifying,.state-installing,.state-starting,.state-checking{border-color:#7762ba;color:#c7b8ff}.state-paused{color:#f0ce85}
.notice{display:flex;flex-direction:column;gap:5px;margin:0 0 16px;padding:12px 14px;border:1px solid #4a4651;border-radius:10px;color:#c7c1cd;font-size:12px;line-height:1.55}.notice strong{font-size:13px;color:#f0edf2}.notice-warning{border-color:#655338;background:#4a3b251c}.notice-warning strong{color:#f3d18b}.notice-error{border-color:#744747;background:#4a25251c}.notice-error strong{color:#ffaaa5}
.runtime-details{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:0 0 22px}.runtime-details>div{min-width:0}.runtime-details dt{margin-bottom:5px;color:#a9a4b0;font-size:11px}.runtime-details dd{margin:0;color:#eeeaf1;font-size:13px;overflow-wrap:anywhere}.directory-row{grid-column:1/-1;display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 12px;padding-top:12px;border-top:1px solid #393640}.directory-row dt{grid-column:1/-1}.directory-row dd{font-size:12px;color:#c9c4ce}.text-button{padding:5px 10px;border:1px solid #56515d;border-radius:7px;background:#2e2b34;color:#ded9e3;font-size:11px;cursor:pointer}.text-button:disabled,.button:disabled{opacity:.45;cursor:not-allowed}
.download-block{margin-bottom:14px}.download-labels{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;color:#c8c3cd;font-size:11px}.progress-track{height:8px;overflow:hidden;border-radius:99px;background:#403c47}.progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#9c7dff,#70d3a1);transition:width .25s ease}.status-message{margin:0 0 14px;color:#aaa5b1;font-size:12px;line-height:1.5}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.button{min-height:37px;padding:0 13px;border:1px solid #514c59;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}.button-primary{border-color:#8a72ee;background:#8068e2;color:#fff}.button-primary:hover:not(:disabled){background:#907af0}.button-secondary{background:#302d36;color:#e7e2eb}.button-secondary:hover:not(:disabled){background:#3a3741}.panel-footer{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:22px;padding-top:14px;border-top:1px solid #393640;color:#96919d;font-size:10px}
@media(max-width:560px){.runtime-backdrop{padding:12px}.runtime-panel{max-height:calc(100vh - 24px);border-radius:14px}.panel-header,.panel-body{padding-left:18px;padding-right:18px}.runtime-intro{align-items:flex-start}.state-pill{font-size:10px}.runtime-details{gap:12px}}
</style>
