<template>
  <main class="login-screen" :class="{ 'login-island': island }" aria-labelledby="login-title">
    <header class="login-topbar">
      <div class="login-brand"><img :src="islandLogo" alt="" /><strong>VividDesktop</strong></div>
      <div class="login-top-actions">
        <button type="button" class="skin-toggle" :aria-pressed="island" @click="ui.setSkin(island ? 'original' : 'animal-island')">{{ island ? '☀ 海岛皮肤' : '◐ 经典深色' }}<span aria-hidden="true"> ⇄</span></button>
        <template v-if="desktopWindow"><button class="window-button" type="button" aria-label="最小化" @click="controlWindow('minimize')">−</button><button class="window-button close-window" type="button" aria-label="关闭窗口" @click="controlWindow('close')">×</button></template>
      </div>
    </header>
    <div class="login-layout">
      <section class="login-story" aria-label="欢迎使用 VividDesktop">
        <p class="story-eyebrow">{{ island ? 'WELCOME TO YOUR CREATIVE ISLAND' : 'A NEW PERSPECTIVE ON YOUR IDEAS' }}</p>
        <h1>让灵感，<br />有迹可循。</h1>
        <p class="story-copy">从一张图开始，探索空间的更多可能。<br />你的下一幅作品，从这里出发。</p>
        <svg class="login-scene" viewBox="0 0 680 370" fill="none" aria-hidden="true">
          <ellipse class="scene-glow" cx="354" cy="284" rx="274" ry="58" />
          <circle class="scene-sun" cx="505" cy="79" r="39" />
          <path class="scene-cloud" d="M86 91c0-12 10-22 23-22 7-18 34-21 45-4 19-5 32 8 32 26Z" />
          <path class="scene-cloud cloud-two" d="M477 164c0-10 9-18 19-18 6-15 28-17 37-3 16-4 27 7 27 21Z" />
          <path class="scene-ground" d="m73 278 258-121 282 130-255 64Z" />
          <path class="scene-side" d="m349 137 173 70v81l-173 49Z" /><path class="scene-front" d="m154 218 195-81v200l-195-48Z" />
          <path class="scene-roof" d="m137 207 211-92 193 80-20 13-172-68-195 80Z" />
          <path class="scene-window" d="m177 228 147-59v125l-147-29Z" /><path class="scene-window side-window" d="m372 165 125 51v49l-125 35Z" />
          <path class="scene-line" d="m218 211 0 63m46-81v91m-87-41 147 3m48-53 125 42m-84-53v105m42-89v77M349 140v197" />
          <path class="scene-path" d="m218 316 37 28 26-7-30-24" />
          <path class="scene-tree" d="M115 246v41m-11-30c-20-27 9-49 23-24 22 14 7 42-12 29M558 251v45m-12-29c-22-31 10-55 26-27 24 15 8 46-14 33" />
          <path class="scene-wave" d="M111 344c48-14 69 16 119 2m193-7c40-19 64 7 106-10" />
        </svg>
        <p class="story-caption">{{ island ? '留一点想象，让创作自由生长。' : 'LIGHT · MATERIAL · SPACE' }}</p>
      </section>
      <section class="login-card" :aria-busy="locked">
        <div class="form-heading"><span class="welcome-dot" aria-hidden="true" /><span>你的创作空间</span></div>
        <h2 id="login-title">登录，开始创作</h2>
        <p class="form-subtitle">使用 VividAI 账号进入客户端</p>
        <p v-if="checking || store.accountStatus === 'checking'" class="login-feedback" role="status">正在验证登录状态，请稍候…</p>
        <form @submit.prevent="submitLogin">
          <label for="login-username">账号</label>
          <input id="login-username" v-model="username" name="username" autocomplete="username" placeholder="手机号 / 邮箱 / 用户名" maxlength="200" required :disabled="locked" />
          <div class="password-label"><label for="login-password">密码</label><button type="button" :disabled="locked" @click="openReset">忘记密码？</button></div>
          <input id="login-password" v-model="password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" maxlength="200" required :disabled="locked" />
          <p v-if="message" class="login-feedback" role="status">{{ message }}</p>
          <button class="login-submit" type="submit" :disabled="locked || retrySeconds > 0">{{ store.busy ? '正在验证…' : retrySeconds ? `请等待 ${retrySeconds} 秒` : '登录' }}<span v-if="!locked && !retrySeconds" aria-hidden="true">→</span></button>
        </form>
        <button v-if="store.accountStatus === 'unavailable'" type="button" class="retry-login" :disabled="locked || retrySeconds > 0" @click="store.refreshSession()">重新检查登录状态</button>
        <div class="signup-row"><span>还没有账号？</span><button type="button" :disabled="locked || registrationBusy" @click="openRegistration">{{ registrationBusy ? '正在打开…' : '立即注册 ↗' }}</button></div>
        <p class="signup-note">注册完成后，回到这里登录即可。</p>
      </section>
    </div>
    <footer class="login-footer"><span>VividDesktop</span><span>让每一次想象，都看得见。</span></footer>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore, useUIStore } from '@/stores'
import islandLogo from '@/assets/brand/island-logo.svg'

const props = defineProps({ checking: Boolean })
const store = useAuthStore()
const ui = useUIStore()
const island = computed(() => ui.skin === 'animal-island')
const desktopWindow = Boolean(window.vividDesktop?.windowAction)
const username = ref(''), password = ref(''), localMessage = ref('')
const registrationBusy = ref(false), retrySeconds = ref(0)
const locked = computed(() => props.checking || store.busy)
const message = computed(() => localMessage.value || (store.accountStatus !== 'checking' ? store.snapshot.message : ''))
let retryTimer
watch(() => store.snapshot.retryAfterSeconds, seconds => {
  clearInterval(retryTimer)
  retrySeconds.value = seconds || 0
  if (seconds) retryTimer = setInterval(() => { retrySeconds.value = Math.max(0, retrySeconds.value - 1); if (!retrySeconds.value) clearInterval(retryTimer) }, 1000)
}, { immediate: true })
onBeforeUnmount(() => { clearInterval(retryTimer); password.value = '' })
async function submitLogin() {
  localMessage.value = ''
  try { await store.login(username.value.trim(), password.value) } finally { password.value = '' }
}
async function openRegistration() {
  registrationBusy.value = true
  try { const result = await store.openRegistration(); localMessage.value = result?.message || (result?.opened ? '注册页已打开，完成注册后请返回登录。' : '暂时无法打开注册页，请稍后重试。') } finally { registrationBusy.value = false }
}
async function openReset() { const result = await store.resetPassword(); localMessage.value = result?.opened ? '找回密码页面已打开，完成后请返回登录。' : result?.message || '暂时无法打开找回密码页面。' }
function controlWindow(action) { void window.vividDesktop?.windowAction(action) }
</script>

<style scoped>
.login-screen{--login-bg:#100f17;--login-text:#f0ecf8;--login-muted:#9c94af;--login-accent:#c5aff8;--login-border:#ffffff19;--login-input:#ffffff04;min-height:100dvh;box-sizing:border-box;display:flex;flex-direction:column;color:var(--login-text);background:radial-gradient(ellipse at 13% 48%,#52416f33,transparent 54%),var(--login-bg);font-family:Nunito,'Noto Sans SC',sans-serif;overflow:auto}.login-topbar{height:76px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 42px;-webkit-app-region:drag}.login-brand{display:flex;align-items:center;gap:12px;font-size:18px;letter-spacing:.1px}.login-brand img{width:31px;height:31px}.login-top-actions{display:flex;align-items:center;gap:8px;-webkit-app-region:no-drag}.skin-toggle{padding:9px 14px;border:1px solid var(--login-border);border-radius:24px;background:transparent;font-size:12px;color:var(--login-muted);cursor:pointer}.window-button{width:32px;height:32px;border:0;background:transparent;color:var(--login-muted);font-size:22px;cursor:pointer}.window-button:hover{background:#8882;border-radius:8px}.close-window:hover{background:#c34848;color:#fff}.login-layout{width:min(1110px,calc(100% - 100px));flex:1;min-height:580px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) 370px;align-items:center;gap:100px}.login-story{position:relative;padding-top:18px}.story-eyebrow{color:var(--login-accent);font-size:10px;font-weight:700;letter-spacing:2px;margin:0 0 28px}.login-story h1{font-size:clamp(38px,4.2vw,62px);font-weight:600;line-height:1.32;letter-spacing:3px;margin:0 0 22px}.story-copy{font-size:14px;line-height:1.9;color:var(--login-muted);margin:0}.login-scene{display:block;width:115%;max-width:640px;margin:-8px 0 -28px -30px}.scene-glow{fill:#ae8ce214}.scene-sun{fill:#c5aff821;stroke:#c5aff844}.scene-cloud{fill:#b29bdf0c;stroke:#b29bdf30}.scene-ground{fill:#44354e22;stroke:#bb9bf833}.scene-front{fill:#372c49;stroke:#ac8bda66}.scene-side{fill:#231d33;stroke:#ac8bda66}.scene-roof{fill:#574366;stroke:#d8b6ff88}.scene-window{fill:#b694e511;stroke:#c8a3fc66}.scene-line{stroke:#c8a3fc77;stroke-width:1.5}.scene-tree{stroke:#a3bbb777;stroke-width:3;stroke-linecap:round}.scene-path,.scene-wave{stroke:#c5aff844;stroke-width:2}.story-caption{color:var(--login-muted);font-size:10px;letter-spacing:3px;margin:0 0 12px 2px}.login-card{padding:40px 0 36px;align-self:center}.form-heading{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--login-accent);margin-bottom:16px}.welcome-dot{width:6px;height:6px;border-radius:50%;background:var(--login-accent)}.login-card h2{margin:0 0 12px;font-size:29px;font-weight:600;letter-spacing:1px}.form-subtitle{font-size:13px;color:var(--login-muted);margin:0 0 38px}.login-card form{display:flex;flex-direction:column}.login-card label{font-size:13px;font-weight:500;line-height:20px}.login-card input{box-sizing:border-box;width:100%;height:50px;margin:10px 0 25px;padding:0 16px;background:var(--login-input);border:1px solid var(--login-border);border-radius:11px;color:var(--login-text);font-family:inherit;font-size:14px;outline:none}.login-card input::placeholder{color:var(--login-muted);opacity:.65}.login-card input:focus{border-color:var(--login-accent);box-shadow:0 0 0 3px #b39bde12}.password-label{display:flex;align-items:center;justify-content:space-between}.password-label button,.signup-row button,.retry-login{border:0;background:transparent;padding:0;color:var(--login-accent);font-family:inherit;font-size:12px;cursor:pointer}.login-submit{height:49px;display:flex;justify-content:center;align-items:center;gap:16px;margin-top:3px;border:0;border-radius:11px;background:var(--login-accent);color:#281b41;font-size:14px;font-weight:650;cursor:pointer}.login-submit:hover:enabled{filter:brightness(1.05)}.login-card button:disabled{opacity:.5;cursor:wait}.login-card :is(input,button):focus-visible{outline:2px solid var(--login-accent);outline-offset:4px}.login-feedback{font-size:12px;line-height:1.8;color:var(--login-accent);margin:0 0 18px;overflow-wrap:anywhere}.signup-row{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:30px;font-size:12px;color:var(--login-muted)}.signup-row button{font-weight:600}.signup-note{margin:12px 0 0;text-align:center;font-size:11px;color:var(--login-muted);opacity:.75}.retry-login{display:block;margin:16px auto}.login-footer{display:flex;align-items:center;justify-content:space-between;padding:25px 42px;color:var(--login-muted);font-size:10px;letter-spacing:1px;opacity:.65}.login-island{--login-bg:#f7f3e7;--login-text:#775130;--login-muted:#a18c72;--login-accent:#16b9aa;--login-border:#9e896633;--login-input:#fffdf499;background:radial-gradient(ellipse at 16% 48%,#dff2e4aa,transparent 56%),var(--login-bg)}.login-island .login-submit{color:#fff;box-shadow:0 5px 0 #129e9230;border-radius:24px}.login-island .login-card input{border-radius:15px}.login-island .scene-glow{fill:#63c9b51c}.login-island .scene-sun{fill:#f4d77f;stroke:none}.login-island .scene-cloud{fill:#fffdf3;stroke:#dfd8c34d}.login-island .scene-ground{fill:#b8d9ac;stroke:#80b9a155}.login-island .scene-front{fill:#fffbeb;stroke:#a3b6a288}.login-island .scene-side{fill:#e7e9cf;stroke:#a3b6a288}.login-island .scene-roof{fill:#559d8e;stroke:#448a7d}.login-island .scene-window{fill:#8bbeb366;stroke:#6faaa0}.login-island .scene-line{stroke:#fffcda;stroke-width:3}.login-island .scene-tree{stroke:#7eab77;stroke-width:7}.login-island .scene-path{stroke:#f9f0cb;stroke-width:9}.login-island .scene-wave{stroke:#73c6b9}.login-island .story-caption{letter-spacing:1px}.login-island .story-eyebrow{letter-spacing:1.3px}
@media(min-width:1500px){.login-layout{gap:150px;grid-template-columns:minmax(0,1fr) 370px}}@media(max-width:900px){.login-layout{gap:36px;width:calc(100% - 64px);grid-template-columns:minmax(0,1fr) 340px}.story-eyebrow{font-size:9px;letter-spacing:1px}.login-story h1{font-size:39px}.story-copy{font-size:12px}}@media(max-width:700px){.login-topbar{height:66px;padding:0 22px}.login-brand{font-size:15px}.login-brand img{width:26px;height:26px}.skin-toggle{padding:7px 10px;font-size:11px}.login-layout{display:block;width:min(370px,calc(100% - 48px));min-height:auto;padding:26px 0}.login-story{display:none}.login-card{padding:24px 0 45px}.login-card h2{font-size:28px}.login-footer{padding:20px 22px;gap:16px;font-size:9px}.form-subtitle{margin-bottom:32px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
