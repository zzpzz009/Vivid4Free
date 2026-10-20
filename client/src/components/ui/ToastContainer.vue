<template>
  <div class="toast-stack" aria-label="操作反馈">
    <Toast v-for="toast in toasts" :key="toast.id" v-bind="toast" @close="removeToast(toast.id)" />
  </div>
</template>
<script setup>
import Toast from './Toast.vue'
import { useToast } from '@/utils/toast.js'
const { toasts, removeToast } = useToast()
</script>
<style scoped>
.toast-stack{position:fixed;right:var(--space-4);bottom:var(--space-12);z-index:1200;display:grid;gap:var(--space-2);width:min(360px,calc(100vw - 32px));pointer-events:none}
</style>
