import { defineStore } from 'pinia'
import { desktopAccount, safeSnapshot } from '@/api/desktopAccount.js'

const initialSnapshot = () => safeSnapshot({ status: 'unavailable', message: '正在检查账号服务…' })

export const useAuthStore = defineStore('auth', {
  state: () => ({
    snapshot: initialSnapshot(),
    isLoggedIn: false,
    user: null,
    loginTime: null,
    creativeUsageCount: 0,
    busy: false,
    lastAttemptAt: 0
  }),
  getters: {
    isAuthenticated: (state) => state.snapshot.status === 'signed_in',
    accountStatus: (state) => state.snapshot.status,
    remainingSessionTime: () => 0
  },
  actions: {
    applySnapshot(value) {
      this.snapshot = safeSnapshot(value) || initialSnapshot()
      this.isLoggedIn = this.snapshot.status === 'signed_in'
      this.user = this.snapshot.profile
      if (this.isLoggedIn && !this.loginTime) this.loginTime = this.snapshot.lastCheckedAt || new Date().toISOString()
      if (!this.isLoggedIn) this.loginTime = null
      return this.snapshot
    },
    async initAuth() {
      const snapshot = this.applySnapshot(await desktopAccount.status())
      if (snapshot.status === 'checking') return this.refreshSession()
      return snapshot.status === 'signed_in'
    },
    async checkAuthStatus() {
      return this.snapshot.status === 'signed_in'
    },
    async refreshSession() {
      const now = Date.now()
      const waitMs = Math.max(0, (this.snapshot.retryAfterSeconds || 0) * 1000 - (now - this.lastAttemptAt))
      if (waitMs > 0) return { ...this.snapshot, message: `请等待 ${Math.ceil(waitMs / 1000)} 秒后重试。` }
      if (this.busy) return this.snapshot
      this.busy = true
      this.lastAttemptAt = now
      try {
        return this.applySnapshot(await desktopAccount.refresh())
      } finally {
        this.busy = false
      }
    },
    async login(username, password) {
      const now = Date.now()
      const waitMs = Math.max(0, (this.snapshot.retryAfterSeconds || 0) * 1000 - (now - this.lastAttemptAt))
      if (waitMs > 0) return { success: false, message: `请等待 ${Math.ceil(waitMs / 1000)} 秒后重试。` }
      if (this.busy) return { success: false, message: '账号请求处理中，请稍候。' }
      this.busy = true
      this.lastAttemptAt = now
      try {
        const result = this.applySnapshot(await desktopAccount.login({ username, password }))
        return { success: result.status === 'signed_in', message: result.message }
      } finally {
        this.busy = false
      }
    },
    async logout() {
      if (this.busy) return this.snapshot
      this.busy = true
      try {
        return this.applySnapshot(await desktopAccount.logout())
      } finally {
        this.busy = false
      }
    },
    async resetPassword() {
      return desktopAccount.resetPassword()
    },
    async openRegistration() {
      return desktopAccount.register()
    },
    loadCreativeUsage() {},
    incrementCreativeUsage() {}
  }
})
