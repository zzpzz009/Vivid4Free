<template>
  <section v-if="open" ref="surface" class="runtime-backdrop" role="presentation" @click.self="closePanel()">
    <article class="runtime-panel" role="dialog" aria-modal="true" aria-labelledby="runtime-title">
      <header class="panel-header">
        <h1 id="runtime-title">更新与安装</h1>
        <div class="panel-header-actions">
          <button class="version-action" type="button" :disabled="locked" @click="checkRuntime">{{ busyAction === 'checking' ? '检查中…' : '检查更新' }}</button>
          <button class="icon-button" type="button" aria-label="关闭更新与安装面板" data-runtime-close @click="closePanel()">×</button>
        </div>
      </header>
      <div class="panel-body">
        <div class="version-row">
          <div><span class="version-label">客户端</span><strong>{{ status?.clientVersion || '—' }}</strong></div>
          <div><span class="version-label">引擎</span><strong>{{ status?.version || '未安装' }}</strong></div>
        </div>
        <p class="compatibility-line">此客户端支持引擎 {{ supportedVersions }}</p>

        <section v-if="status?.clientUpdateAvailable" class="client-update-card" aria-label="客户端更新内容">
          <h2>客户端 {{ status.clientRelease.version }} 可更新</h2>
          <ul v-if="status.clientRelease.notes?.length" class="release-notes"><li v-for="note in status.clientRelease.notes" :key="note">{{ note }}</li></ul>
          <p v-else class="quiet-message">发布方暂未提供更新说明。</p>
          <p v-if="status.clientRelease.supportedRuntimeVersions?.length" class="release-compatibility">更新后支持引擎 {{ status.clientRelease.supportedRuntimeVersions.join('、') }}，不匹配时请同步更新引擎，否则不保证兼容性和出图可靠性。</p>
          <button type="button" class="button button-secondary client-download" :disabled="locked || !status.clientUpdateConfigured" @click="updateClient">下载客户端 ↗</button>
          <p class="helper-text">下载安装包后，关闭客户端并覆盖安装。</p>
        </section>
        <p v-else class="client-update-state quiet-message">{{ clientUpdateMessage }}</p>

        <div v-if="status?.compatibilityMessage" class="notice notice-warning" role="alert">
          <strong>{{ compatibilityPending ? '兼容性待验证' : '版本不兼容' }}</strong>
          <span>{{ status.compatibilityMessage }}</span>
          <span>{{ packageHint }}</span>
        </div>
        <p v-else-if="!status?.downloadConfigured" class="quiet-message" role="status">正式下载链接待配置，已有 ZIP 可直接导入。</p>
        <p v-if="bridgeUnavailable" class="quiet-message" role="status">请在桌面客户端安装运行包。</p>

        <section v-if="needsEnginePackage" class="engine-installation" aria-label="引擎下载与安装">
        <div class="engine-release">
          <h2>{{ status?.updateAvailable ? `引擎 ${status.availableVersion}${status.availableCompatible === false ? status.availableCompatibilityState === 'unverified' ? '（兼容性待验证）' : '（不兼容）' : ' 可更新'}` : status?.installed ? '引擎安装包' : '安装引擎' }}</h2>
          <ul v-if="status?.updateAvailable && status?.releaseNotes?.length" class="release-notes"><li v-for="note in status.releaseNotes" :key="note">{{ note }}</li></ul>
          <p v-else-if="status?.updateAvailable" class="quiet-message">{{ status?.compatibilityNote || '发布方暂未提供更新说明。' }}</p>
          <p v-if="status?.available && status.availableCompatible" class="release-compatibility">当前客户端支持引擎 {{ status.availableVersion }}，安装后会检查运行所需组件。</p>
        </div>

        <div class="download-sources">
          <div v-for="source in sources" :key="source.provider">
            <button type="button" class="button button-secondary" :aria-label="`打开${source.label}`" :title="source.provider === 'baidu' ? '暂未开放' : source.configured ? '打开夸克网盘下载页' : '下载链接待配置'" :disabled="locked || !source.configured" @click="openDownload(source.provider)">{{ source.label }}{{ source.provider === 'baidu' ? '（暂未开放）' : ' ↗' }}</button>
            <span v-if="source.configured && source.extractionCode">提取码：{{ source.extractionCode }}</span>
          </div>
        </div>
        <button type="button" class="button import-button" :disabled="locked || status?.availableCompatible === false" @click="importArchive">{{ busyAction === 'importing' ? '正在校验 / 安装…' : '导入 ZIP 并安装' }}</button>
        <p class="helper-text">用网盘官方客户端下载后导入，无需解压。</p>
        <p v-if="status?.compatibilityNote" class="helper-text">{{ status.compatibilityNote }}</p>
        <p v-if="status?.available" class="helper-text">{{ packageHint }}</p>
        </section>

        <div v-if="showProgress" class="download-block">
          <div class="download-labels"><span>{{ progressLabel }}</span><span>{{ progress }}%</span></div>
          <div v-if="uiStore.skin === 'animal-island'" role="progressbar" :aria-label="progressLabel" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><IslandProgress :percent="progress" variant="forest-grove" size="small" :show-info="false" aria-hidden="true" /></div>
          <div v-else class="progress-track" role="progressbar" :aria-label="progressLabel" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" :style="{ width: `${progress}%` }" /></div>
        </div>
        <p v-if="actionMessage" class="action-message" role="status">{{ actionMessage }}</p>
        <div v-if="error" class="notice notice-error" role="alert">{{ error }}</div>

        <details class="advanced-options">
          <summary>高级选项</summary>
          <dl class="runtime-details">
            <div class="directory-row"><dt>引擎安装位置</dt><dd>{{ status?.storageDir || '导入时选择' }}</dd><button type="button" class="text-button" :disabled="locked" @click="chooseDirectory">选择</button></div>
            <div v-if="status?.activePath"><dt>当前运行目录</dt><dd>{{ status.activePath }}</dd></div>
          </dl>
          <p v-if="status?.available" class="quiet-message">导入后校验并切换，失败保留旧环境。</p>
          <p v-else class="quiet-message">未获取发布信息时，仅校验 ZIP 内部清单与文件。</p>
          <div class="secondary-actions">
            <button v-if="!needsEnginePackage" type="button" class="text-button" :disabled="locked" @click="importArchive">导入引擎 ZIP</button>
            <button type="button" class="text-button" :disabled="locked" @click="connectDirectory">接入已有环境</button>
            <button v-if="status?.installed" type="button" class="text-button" :disabled="locked || status?.runtimeCompatible === false" @click="startEngine">启动 / 重试引擎</button>
          </div>
        </details>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Progress as IslandProgress } from 'animal-island-vue'
import { useUIStore } from '@/stores/useUIStore.js'
import { useRuntimeEnvironment } from '@/composables/useRuntimeEnvironment.js'
import { runtimePackageHint } from '@/utils/runtimeGuidance.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'status'])
const uiStore = useUIStore()
const surface = ref(null)
let opener
function closePanel(restore = true) { emit('close'); if (restore && opener?.isConnected) opener.focus() }
function onEscape(event) { if (props.open && event.key === 'Escape') { event.preventDefault(); closePanel() } }
function onOutside(event) { if (props.open && !surface.value?.querySelector('.runtime-panel')?.contains(event.target) && !event.target.closest?.('.update-entry')) closePanel(false) }
watch(() => props.open, async open => { if (open) { opener = document.activeElement; await nextTick(); surface.value?.querySelector('[data-runtime-close]')?.focus() } })
onMounted(() => { document.addEventListener('keydown', onEscape); document.addEventListener('pointerdown', onOutside, true) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onEscape); document.removeEventListener('pointerdown', onOutside, true) })
const runtime = useRuntimeEnvironment()
const { status, busyAction, error, actionMessage, bridgeUnavailable } = runtime
const isBusy = computed(() => Boolean(busyAction.value))
const isTransitioning = computed(() => ['checking', 'downloading', 'verifying', 'installing', 'starting'].includes(status.value?.state))
const locked = computed(() => isBusy.value || isTransitioning.value || bridgeUnavailable.value)
const supportedVersions = computed(() => status.value?.supportedRuntimeVersions?.join('、') || '待确认')
const compatibilityPending = computed(() => (status.value?.failedCompatibilityState || (status.value?.runtimeCompatible === false ? status.value?.runtimeCompatibilityState : status.value?.availableCompatibilityState)) === 'unverified')
const needsEnginePackage = computed(() => !status.value?.installed || status.value?.updateAvailable || status.value?.runtimeCompatible === false || !status.value?.available)
const clientUpdateMessage = computed(() => {
  if (status.value?.updateCheckState === 'checking') return '正在检查客户端和引擎更新…'
  if (status.value?.updateCheckState === 'failed') return '暂时无法检查新版，可重试检查或导入已有引擎 ZIP。'
  return status.value?.clientRelease ? '当前客户端无需更新。' : '尚未获取客户端发布信息。'
})
const packageHint = computed(() => runtimePackageHint(status.value))
const sources = computed(() => ['quark', 'baidu'].map(provider => {
  const source = status.value?.downloadSources?.find(item => item.provider === provider)
  return { provider, label: provider === 'quark' ? '夸克网盘' : '百度网盘', ...source, configured: provider === 'quark' && Boolean(source) && source.enabled !== false }
}))
const showProgress = computed(() => ['downloading', 'verifying', 'installing', 'starting'].includes(status.value?.state))
const progress = computed(() => Math.min(100, Math.max(0, Math.round(Number(status.value?.progress) || 0))))
const progressLabel = computed(() => ({ downloading: '正在下载', verifying: '正在校验', installing: '正在安装', starting: '正在启动' }[status.value?.state] || '正在处理'))

async function refresh() { await runtime.refresh(); emit('status', status.value) }
async function operate(action, method, ...args) {
  const result = await runtime.run(action, method, ...args)
  emit('status', status.value)
  if (status.value?.compatibilityMessage) {
    await nextTick()
    const panel = surface.value?.querySelector('.runtime-panel')
    if (panel) panel.scrollTop = 0
  }
  return result
}
function checkRuntime() { return operate('checking', 'runtimeCheck') }
function openDownload(provider) { return operate(`opening-${provider}`, 'runtimeOpenDownload', provider) }
function updateClient() { return operate('opening-client-update', 'clientOpenUpdate') }
function chooseDirectory() { return operate('choosing-directory', 'chooseRuntimeDirectory') }
async function importArchive() {
  if (!status.value?.storageDir) {
    await chooseDirectory()
    if (!status.value?.storageDir) return
  }
  return operate('importing', 'runtimeImportArchive')
}
function connectDirectory() { return operate('connecting', 'runtimeConnectDirectory') }
function startEngine() { return operate('starting', 'startEngine') }
watch(() => props.open, open => { if (open) { runtime.startPolling(); void refresh() } else runtime.stopPolling() }, { immediate: true })
onMounted(async () => { await refresh(); if (status.value?.downloadConfigured) await checkRuntime() })
</script>

<style scoped>
.runtime-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:24px;background:#100e14aa;backdrop-filter:blur(5px)}
.runtime-panel{width:min(460px,100%);max-height:calc(100vh - 48px);overflow:auto;border:1px solid var(--schemes-outline-variant,#48434f);border-radius:18px;background:var(--schemes-surface-container,#211f27);color:var(--schemes-on-surface,#f5f1f8);box-shadow:0 24px 80px #0005}
.panel-header-actions{display:flex;align-items:center;gap:16px}.panel-header-actions .version-action{font-size:12px}.client-update-card{padding:0 0 20px;margin-bottom:20px;border-bottom:1px solid var(--schemes-outline-variant,#393640)}.client-update-card h2,.engine-release h2{margin:0 0 10px;font-size:14px;font-weight:650;line-height:1.5}.release-notes{margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.7;color:var(--schemes-on-surface-variant,#aaa5b1)}.release-notes li+li{margin-top:4px}.release-compatibility{margin:0 0 14px;font-size:12px;line-height:1.7;color:var(--schemes-on-surface-variant,#aaa5b1)}.client-download{width:100%}.client-update-state{padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid var(--schemes-outline-variant,#393640)}
.panel-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0}.panel-header h1{margin:0;font-size:20px;font-weight:650}.icon-button{width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:inherit;font-size:24px;cursor:pointer}
.panel-body{padding:20px 24px 22px}.version-row{display:grid;grid-template-columns:1fr 1fr;gap:24px}.version-row>div{display:flex;align-items:center;gap:8px;min-width:0}.version-label{font-size:12px;color:var(--schemes-on-surface-variant,#aaa5b1)}.version-row strong{font-size:17px;font-weight:600}.version-action{padding:2px 0;margin-left:auto;border:0;background:transparent;color:var(--schemes-primary,#b7a5ff);font-size:11px;cursor:pointer}.version-action:disabled{opacity:.4;cursor:not-allowed}
.compatibility-line{margin:10px 0 22px;color:var(--schemes-on-surface-variant,#aaa5b1);font-size:12px}.update-line{margin:0 0 12px;font-size:13px;font-weight:600;color:var(--schemes-primary,#b7a5ff)}.quiet-message{margin:0 0 12px;color:var(--schemes-on-surface-variant,#aaa5b1);font-size:11px;line-height:1.6}
.download-sources{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}.download-sources>div{display:flex;flex-direction:column;gap:5px;min-width:0}.download-sources span{font-size:10px;color:var(--schemes-on-surface-variant,#aaa5b1);text-align:center}.button{min-height:39px;padding:0 12px;border:1px solid var(--schemes-outline-variant,#514c59);border-radius:9px;font-size:12px;font-weight:600;cursor:pointer}.button-secondary{background:transparent;color:inherit}.button:disabled,.text-button:disabled{opacity:.4;cursor:not-allowed}.runtime-panel .import-button{width:100%;background:var(--schemes-primary,#8068e2);border-color:transparent;color:var(--schemes-on-primary,#fff);box-shadow:none}.helper-text{margin:10px 0 0;text-align:center;color:var(--schemes-on-surface-variant,#aaa5b1);font-size:11px}
.notice{display:flex;flex-direction:column;gap:4px;padding:11px 12px;margin:0 0 16px;border:1px solid var(--schemes-outline-variant,#655338);border-radius:9px;font-size:12px;line-height:1.6}.notice-warning{background:#e6bc6610;border-color:#c59c58}.notice-error{color:var(--schemes-error,#ffaaa5);border-color:currentColor}.action-message{font-size:12px;line-height:1.6;margin:14px 0 0}
.download-block{margin-top:18px}.download-labels{display:flex;justify-content:space-between;font-size:11px;margin-bottom:7px}.progress-track{height:7px;border-radius:10px;background:#8883;overflow:hidden}.progress-fill{height:100%;background:var(--schemes-primary,#9c7dff)}
.runtime-panel .import-button:hover:enabled{filter:brightness(.94);box-shadow:none}.runtime-panel .import-button:active:enabled{transform:translateY(1px);box-shadow:none}.runtime-panel .import-button:focus-visible{outline:2px solid var(--schemes-primary,#8068e2);outline-offset:3px}
.advanced-options{margin-top:22px;padding-top:14px;border-top:1px solid var(--schemes-outline-variant,#393640);font-size:11px}.advanced-options summary{cursor:pointer;color:var(--schemes-on-surface-variant,#aaa5b1)}.runtime-details{margin:16px 0}.runtime-details dt{color:var(--schemes-on-surface-variant,#aaa5b1);margin-bottom:5px;font-size:11px}.runtime-details dd{margin:0;font-size:11px;overflow-wrap:anywhere}.runtime-details>div{margin-bottom:12px}.directory-row{display:grid;grid-template-columns:1fr auto;gap:5px 10px;align-items:center}.directory-row dt{grid-column:1/-1}.text-button{border:1px solid var(--schemes-outline-variant,#514c59);padding:5px 9px;border-radius:6px;background:transparent;color:inherit;font-size:11px;cursor:pointer}.secondary-actions{display:flex;gap:8px;flex-wrap:wrap}
.advanced-options{font-size:13px;line-height:1.7}.advanced-options summary{font-size:14px}.advanced-options :is(.runtime-details dt,.runtime-details dd,.quiet-message,.text-button){font-size:13px;line-height:1.7}
@media(max-width:560px){.runtime-backdrop{padding:12px}.runtime-panel{max-height:calc(100vh - 24px)}.panel-header{padding:18px 18px 0}.panel-body{padding:18px}.version-row{gap:16px}}
</style>
