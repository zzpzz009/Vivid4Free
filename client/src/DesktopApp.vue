<template>
  <LoginScreen v-if="!auth.isAuthenticated" :checking="checking" />
  <DesktopWorkspace v-else-if="entered" />
  <div v-else class="entry-wait" :class="{ island: ui.skin === 'animal-island' }" role="status" aria-live="polite">
    <p>{{ entryError || '正在为你打开工作区…' }}</p>
    <button v-if="entryError" type="button" @click="beginEntry">重新进入</button>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import LoginScreen from '@/components/LoginScreen.vue'
import DesktopWorkspace from './DesktopWorkspace.vue'
import { useAuthStore, useUIStore } from '@/stores'
import { mountStartupIntro } from '@/utils/startupOverlay'
import { host } from '@/platform/host.js'

const auth = useAuthStore()
const ui = useUIStore()
const checking = ref(true)
const entered = ref(false)
const entryError = ref('')
let cancelIntro, generation = 0
watchEffect(() => { document.documentElement.dataset.vividSkin = ui.skin })
async function beginEntry() {
  const attempt = ++generation
  entered.value = false
  entryError.value = ''
  await nextTick()
  if (!auth.isAuthenticated || attempt !== generation) return
  cancelIntro = mountStartupIntro(document.getElementById('app'), { force: true, onComplete: async reason => {
    cancelIntro = null
    if (reason === 'cancelled' || attempt !== generation || !auth.isAuthenticated) return
    try {
      const result = await host.enterWorkspace()
      if (result?.entered !== true) throw new Error('Entry not confirmed')
      if (attempt === generation && auth.isAuthenticated) entered.value = true
    } catch {
      entryError.value = '暂时无法进入工作区，请重新检查登录状态。'
      await auth.initAuth()
    }
  } })
}
watch(() => auth.isAuthenticated, signedIn => {
  if (signedIn) void beginEntry()
  else { generation++; entered.value = false; cancelIntro?.(); cancelIntro = null }
})
onMounted(async () => { try { await auth.initAuth() } finally { checking.value = false } })
onBeforeUnmount(() => { generation++; cancelIntro?.() })
</script>

<style scoped>
.entry-wait{min-height:100vh;display:grid;align-content:center;justify-items:center;gap:16px;background:#100e16;color:#cfc3e5;font:14px system-ui}.entry-wait.island{background:#f7f3df;color:#765532}.entry-wait button{padding:10px 24px;border:1px solid currentColor;border-radius:24px;background:transparent;color:inherit;cursor:pointer}
</style>
