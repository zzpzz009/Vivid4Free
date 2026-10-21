<template>
  <div class="toast-stack fixed top-4 right-4 z-50 space-y-2" aria-label="操作反馈">
    <Toast v-for="toast in toasts" :key="toast.id" v-bind="toast" @close="removeToast(toast.id)" />
  </div>
</template>
<script setup>
import Toast from './Toast.vue'
import { useToast } from '@/utils/toast.js'
const { toasts, removeToast } = useToast()
</script>
