import { defineStore } from 'pinia'

// Account access is intentionally deferred for the local desktop client.
export const useAuthStore = defineStore('auth', {
  state: () => ({ isLoggedIn: false, user: null, loginTime: null, creativeUsageCount: 0, accountStatus: 'deferred' }),
  getters: {
    isAuthenticated: () => false,
    remainingSessionTime: () => 0
  },
  actions: {
    async login() {
      return { success: false, message: '账号接入待配置' }
    },
    logout() {
      this.isLoggedIn = false
      this.user = null
      this.loginTime = null
    },
    checkAuthStatus() { return false },
    initAuth() { return false },
    refreshSession() {},
    loadCreativeUsage() {},
    incrementCreativeUsage() {}
  }
})
