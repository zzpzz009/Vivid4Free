<template>
  <div v-if="open" ref="surface" class="account-backdrop podui-theme">
    <Panel id="desktop-account-panel" class="account-panel" role="region" aria-labelledby="account-title" aria-describedby="account-description">
      <header class="account-header">
        <div class="account-heading">
          <span class="account-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg>
          </span>
          <div>
            <h2 id="account-title" class="account-title">{{ settingsOpen ? '设置' : store.isAuthenticated ? '我的账号' : '登录账号' }}</h2>
            <p id="account-description" class="account-subtitle">{{ settingsOpen ? 'VividDesktop' : store.isAuthenticated ? 'VividAI 统一账号' : '使用 VividAI 账号登录客户端' }}</p>
          </div>
        </div>
        <div class="account-header-actions">
        <button type="button" class="settings-entry" :aria-expanded="settingsOpen" aria-controls="desktop-account-settings" @click="settingsOpen = !settingsOpen">
          <svg v-if="!settingsOpen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m9.5 3-.6 2.2-2 1.2-2.2-.6-2.5 4.4L4 12l-1.8 1.8 2.5 4.4 2.2-.6 2 1.2.6 2.2h5l.6-2.2 2-1.2 2.2.6 2.5-4.4L20 12l1.8-1.8-2.5-4.4-2.2.6-2-1.2L14.5 3Z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>
          {{ settingsOpen ? '返回账号' : '设置' }}
        </button>
        <IconButton type="button" size="sm" aria-label="关闭" data-account-close @click="closePanel()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </IconButton>
        </div>
      </header>
      <section v-if="settingsOpen" id="desktop-account-settings" class="account-settings" aria-label="客户端设置">
        <button type="button" @click="$emit('import')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6M15 7h3m-1.5-1.5v3"/></svg><span>导入图库</span><span class="settings-arrow" aria-hidden="true">›</span></button>
        <button type="button" @click="$emit('output')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg><span>输出目录</span><span class="settings-arrow" aria-hidden="true">›</span></button>
        <button type="button" @click="$emit('agent')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/></svg><span>Agent 接口</span><span class="settings-arrow" aria-hidden="true">›</span></button>
      </section>
      <div v-else>
      <p v-if="store.accountStatus === 'checking' || store.accountStatus === 'unavailable'" class="account-status" role="status">{{ statusText }}</p>
      <p v-if="store.snapshot.message" class="account-message" role="status">{{ store.snapshot.message }}</p>

      <form v-if="store.accountStatus !== 'signed_in'" class="account-form" @submit.prevent="submitLogin">
        <label class="account-field">账号<Input v-model="username" class="account-input" autocomplete="username" placeholder="手机号 / 邮箱 / 用户名" required :disabled="store.busy" /></label>
        <div class="account-field">
          <div class="account-field-header"><label for="desktop-account-password">密码</label><Button type="button" variant="ghost" size="xs" class="account-link" :disabled="store.busy" @click="openReset">找回密码</Button></div>
          <Input id="desktop-account-password" v-model="password" class="account-input" type="password" autocomplete="off" placeholder="请输入密码" required :disabled="store.busy" />
        </div>
        <Button type="submit" variant="generate" class="account-action" :disabled="store.busy || retrySeconds > 0">{{ store.busy ? activeAction === 'login' ? '正在登录…' : '正在验证账号…' : retrySeconds ? `请等待 ${retrySeconds} 秒` : '登录' }}</Button>
      </form>

      <div v-else class="account-profile">
        <div class="profile-summary"><span class="profile-avatar" aria-hidden="true">{{ profileName.slice(0, 1) }}</span><div class="profile-details"><p class="profile-name">{{ profileName }}</p><p class="profile-status"><span aria-hidden="true" />已登录</p></div></div>
        <p class="session-note">{{ store.snapshot.persistent ? '已保存此设备的登录状态，下次打开可自动恢复。' : '当前仅为临时会话，关闭客户端后需重新登录。' }}</p>
        <div class="profile-actions"><Button type="button" variant="secondary" :disabled="store.busy || retrySeconds > 0" @click="refresh">{{ store.busy && activeAction === 'refresh' ? '正在刷新…' : '刷新账号资料' }}</Button><Button type="button" variant="outline" :disabled="store.busy" @click="logout">{{ store.busy && activeAction === 'logout' ? '正在退出…' : '退出登录' }}</Button></div>
      </div>
      <div v-if="store.accountStatus === 'unavailable' || store.accountStatus === 'checking'" class="recovery-actions">
        <Button type="button" variant="secondary" :disabled="store.busy || retrySeconds > 0" @click="refresh">{{ store.busy && activeAction === 'refresh' ? '正在检查…' : retrySeconds ? `请等待 ${retrySeconds} 秒` : '重试检查' }}</Button>
        <Button type="button" variant="ghost" :disabled="store.busy" @click="logout">退出本机登录</Button>
      </div>
      <div class="registration-entry">
        <p class="registration-label">{{ store.isAuthenticated ? '需要创建新账号？' : '还没有账号？' }}</p>
        <Button type="button" variant="outline" class="account-action" :disabled="store.busy || registrationBusy" @click="openRegistration">{{ registrationBusy ? '正在打开注册…' : '注册账号' }}<svg v-if="!registrationBusy" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></Button>
        <p class="browser-note">在官方账号中心完成注册后，返回客户端登录。</p>
        <p v-if="registrationMessage" class="account-message" role="status">{{ registrationMessage }}</p>
      </div>
      <p class="local-note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>本地渲染与放大不扣额度</p>
      </div>
    </Panel>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore.js'
import Button from '@/ui/Button.vue'
import Input from '@/ui/Input.vue'
import IconButton from '@/ui/IconButton.vue'
import Panel from '@/ui/Panel.vue'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'import', 'output', 'agent'])
const store = useAuthStore()
const username = ref('')
const password = ref('')
const retrySeconds = ref(0)
const registrationBusy = ref(false)
const registrationMessage = ref('')
const surface = ref(null)
const activeAction = ref(null)
const settingsOpen = ref(false)
let opener
let retryTimer
const statusText = computed(() => ({
  checking: '正在检查账号状态…',
  signed_in: '账号已登录',
  signed_out: '尚未登录',
  unavailable: '账号状态待验证'
}[store.accountStatus] || '账号状态待验证'))
const profileName = computed(() => store.user?.displayName || store.user?.nickname || store.user?.username || store.user?.name || '账号资料已载入')

function startRetryCountdown() {
  retrySeconds.value = Math.max(0, store.snapshot.retryAfterSeconds || 0)
  clearInterval(retryTimer)
  if (retrySeconds.value) retryTimer = setInterval(() => {
    retrySeconds.value = Math.max(0, retrySeconds.value - 1)
    if (!retrySeconds.value) clearInterval(retryTimer)
  }, 1000)
}

watch(() => store.snapshot.retryAfterSeconds, startRetryCountdown)
watch(() => props.open, async open => {
  if (!open) { password.value = ''; return }
  settingsOpen.value = false
  opener = document.activeElement
  await nextTick()
  const target = surface.value?.querySelector('input[autocomplete="username"]:not(:disabled)') || surface.value?.querySelector('[data-account-close]')
  target?.focus()
})
function closePanel(restoreFocus = true) {
  emit('close')
  if (restoreFocus && opener?.isConnected) opener.focus()
}
function onOutsidePointer(event) {
  if (!props.open || surface.value?.querySelector('.account-panel')?.contains(event.target) || event.target.closest?.('.account-entry')) return
  closePanel(false)
}
function onEscape(event) {
  if (!props.open || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closePanel()
}
onMounted(() => {
  startRetryCountdown()
  document.addEventListener('pointerdown', onOutsidePointer, true)
  document.addEventListener('keydown', onEscape, true)
})
onBeforeUnmount(() => {
  clearInterval(retryTimer)
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  document.removeEventListener('keydown', onEscape, true)
})

async function submitLogin() {
  activeAction.value = 'login'
  const submittedUsername = username.value.trim()
  const submittedPassword = password.value
  try {
    const result = await store.login(submittedUsername, submittedPassword)
    if (result.success) username.value = ''
  } finally {
    activeAction.value = null
    password.value = ''
    startRetryCountdown()
  }
}

async function refresh() {
  activeAction.value = 'refresh'
  try { await store.refreshSession() } finally { activeAction.value = null; startRetryCountdown() }
}

async function logout() {
  activeAction.value = 'logout'
  try { await store.logout() } finally { activeAction.value = null; startRetryCountdown() }
}

async function openReset() {
  const result = await store.resetPassword()
  if (result?.opened === false) store.snapshot.message = result.message
}

async function openRegistration() {
  if (registrationBusy.value) return
  registrationBusy.value = true
  registrationMessage.value = ''
  try {
    const result = await store.openRegistration()
    registrationMessage.value = result?.message || (result?.opened ? '注册页面已打开，请在浏览器完成注册后返回客户端登录' : '注册入口暂时无法打开，请稍后重试')
  } finally {
    registrationBusy.value = false
  }
}
</script>

<style scoped src="../styles/podui.css"></style>
<style scoped>
.account-backdrop.podui-theme{position:fixed;inset:0;z-index:1100;pointer-events:none;background:transparent;font-family:Roboto,sans-serif}
.account-panel{position:absolute;top:64px;right:var(--space-6);width:min(400px,calc(100vw - 32px));max-height:calc(100dvh - 88px);overflow-y:auto;padding:var(--space-6);pointer-events:auto;box-shadow:var(--shadow-lg)}
.account-header{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-6)}
.account-header-actions{display:flex;align-items:center;gap:var(--space-2);flex:none}
.settings-entry{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 6px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer}
.settings-entry:hover,.settings-entry[aria-expanded=true]{background:var(--workspace-card-bg);color:var(--text-primary)}
.account-settings{display:grid;gap:4px}
.account-settings>button{display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--text-primary);font-size:12px;cursor:pointer;text-align:left}
.account-settings>button:hover{background:var(--workspace-card-bg)}
.account-settings svg{width:16px;height:16px;color:var(--text-secondary)}
.settings-arrow{margin-left:auto;color:var(--text-secondary);font-size:18px}
.account-heading{display:flex;align-items:center;gap:var(--space-3);min-width:0}
.account-mark,.profile-avatar{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:var(--border-radius-base);background:var(--workspace-card-bg);color:var(--brand-primary)}
.account-title{margin:0;font-size:16px;line-height:24px;font-weight:600}
.account-subtitle{margin:var(--space-1) 0 0;color:var(--text-secondary);font-size:12px;line-height:18px}
.account-form{display:grid;gap:var(--space-4)}
.account-field{display:grid;gap:var(--space-2);color:var(--text-secondary);font-size:12px;line-height:16px}
.account-field-header{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)}
.account-panel .account-field input.account-input{width:100%;background:var(--workspace-input-bg)!important;border:1px solid var(--border-color)}
.account-panel .account-field input.account-input:focus{background:var(--workspace-input-focus-bg)!important}
.account-panel .account-input::placeholder{color:var(--text-secondary)}
.account-link{padding:0;min-height:28px;color:var(--brand-primary)}
.account-action{display:flex;align-items:center;justify-content:center;gap:var(--space-2);width:100%;font-weight:500;cursor:pointer}
.account-panel button:focus-visible{outline:none;box-shadow:var(--pod-ring)}
.account-panel button:disabled{opacity:.55;cursor:not-allowed}
.account-status,.account-message{margin:0 0 var(--space-4);padding:var(--space-3);border:1px solid var(--border-color);border-radius:var(--border-radius-base);background:var(--workspace-card-bg);color:var(--text-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.account-status{color:var(--brand-primary)}
.recovery-actions,.profile-actions{display:flex;gap:var(--space-2)}
.recovery-actions{margin-top:var(--space-4);flex-wrap:wrap}
.profile-actions>button{flex:1;cursor:pointer}
.profile-summary{display:flex;align-items:center;gap:var(--space-3)}
.profile-avatar{width:48px;height:48px;font-size:20px;font-weight:500}
.profile-details{min-width:0}
.profile-name{margin:0;font-size:16px;font-weight:500;line-height:24px;overflow-wrap:anywhere}
.profile-status{display:flex;align-items:center;gap:var(--space-2);margin:var(--space-1) 0 0;font-size:12px;line-height:16px;color:var(--text-secondary)}
.profile-status>span{width:6px;height:6px;border-radius:var(--border-radius-circle);background:var(--ui-green-color)}
.session-note{margin:var(--space-4) 0;color:var(--text-secondary);font-size:12px;line-height:18px}
.registration-entry{display:grid;gap:var(--space-3);margin-top:var(--space-6);padding-top:var(--space-5);border-top:1px solid var(--border-color)}
.registration-label,.browser-note{margin:0;color:var(--text-secondary);font-size:12px;line-height:18px}
.registration-entry .account-message{margin:0}
.local-note{display:flex;align-items:center;gap:var(--space-2);margin:var(--space-6) 0 0;color:var(--text-secondary);font-size:11px;line-height:16px}
.account-panel svg{flex:none}
@media(max-width:640px){.account-panel{right:var(--space-4);padding:var(--space-5)}}
@media(prefers-reduced-motion:reduce){.account-panel :deep(*){transition:none!important;animation:none!important}}
</style>
