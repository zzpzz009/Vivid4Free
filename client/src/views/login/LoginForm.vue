<template>
  <form class="login-form" @submit.prevent="handleSubmit">
    <div class="form-group">
      <label for="username" class="sr-only">用户名</label>
      <div class="input-wrapper">
        <input
          id="username"
          v-model="form.username"
          type="text"
          class="login-input hover-trigger"
          :class="{ 'error': errors.username }"
          placeholder="USERNAME"
          required
          autocomplete="username"
        >
        <div class="input-line"></div>
      </div>
      <span v-if="errors.username" class="error-text">{{ errors.username }}</span>
    </div>

    <div class="form-group">
      <label for="password" class="sr-only">密码</label>
      <div class="input-wrapper">
        <input
          id="password"
          v-model="form.password"
          type="password"
          class="login-input hover-trigger"
          :class="{ 'error': errors.password }"
          placeholder="PASSWORD"
          required
          autocomplete="current-password"
        >
        <div class="input-line"></div>
      </div>
      <span v-if="errors.password" class="error-text">{{ errors.password }}</span>
    </div>

    <button 
      type="submit" 
      class="login-btn hover-trigger"
      :disabled="isLoading"
    >
      <span class="btn-text">{{ isLoading ? 'LOGGING IN...' : 'LOGIN' }}</span>
      <span class="btn-icon" v-if="!isLoading">→</span>
      <div class="btn-bg"></div>
    </button>

    <div v-if="loginError" class="global-error">
      {{ loginError }}
    </div>
  </form>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore.js'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: ''
})

const errors = reactive({
  username: '',
  password: ''
})

const isLoading = ref(false)
const loginError = ref('')

const validate = () => {
  errors.username = ''
  errors.password = ''
  let isValid = true

  if (!form.username.trim()) {
    errors.username = 'Username is required'
    isValid = false
  }
  if (!form.password.trim()) {
    errors.password = 'Password is required'
    isValid = false
  }
  return isValid
}

const handleSubmit = async () => {
  if (!validate()) return

  isLoading.value = true
  loginError.value = ''

  try {
    const result = await authStore.login(form.username, form.password)
    if (result.success) {
      router.push('/')
    } else {
      loginError.value = result.message || 'Login failed'
    }
  } catch (err) {
    loginError.value = 'An error occurred. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  width: 100%;
  max-width: 320px;
}

.form-group {
  position: relative;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.input-wrapper {
  position: relative;
}

.login-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem 0.5rem;
  font-family: var(--font-body, sans-serif);
  font-size: 1rem;
  color: var(--text-main, #EDEDED);
  letter-spacing: 0.1em;
  transition: border-color 0.3s ease, background-color 9999s ease-in-out 0s;
  border-radius: 0;
}

.login-input:focus {
  outline: none;
  box-shadow: none;
  border-bottom-color: var(--brand-primary, #C5AEF6);
}

.login-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  font-size: 0.875rem;
}

/* Fix for Edge/Chrome autofill background */
.login-input:-webkit-autofill,
.login-input:-webkit-autofill:hover,
.login-input:-webkit-autofill:focus,
.login-input:-webkit-autofill:active {
  -webkit-text-fill-color: #EDEDED !important;
  transition: background-color 5000s ease-in-out 0s;
}

.input-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 1px;
  background-color: var(--brand-primary, #C5AEF6);
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.login-input:focus + .input-line {
  width: 100%;
}

.error-text {
  position: absolute;
  bottom: -1.5rem;
  left: 0;
  font-size: 0.75rem;
  color: #ff6b6b;
}

.login-btn {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem 1.5rem;
  color: var(--text-main, #EDEDED);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.3s ease;
  margin-top: 1rem;
}

.login-btn:hover {
  border-color: var(--brand-primary, #C5AEF6);
}

.btn-text {
  position: relative;
  z-index: 10;
  font-family: var(--font-display, sans-serif);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.875rem;
  font-weight: 600;
  transition: color 0.3s ease;
}

.btn-icon {
  position: relative;
  z-index: 10;
  transition: transform 0.3s ease;
}

.login-btn:hover .btn-icon {
  transform: translateX(4px);
}

.btn-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--brand-primary, #C5AEF6);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 0;
}

.login-btn:hover .btn-bg {
  transform: scaleX(1);
  transform-origin: left;
}

.login-btn:hover .btn-text,
.login-btn:hover .btn-icon {
  color: #000;
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.global-error {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ff6b6b;
  font-size: 0.875rem;
  text-align: center;
}
</style>
