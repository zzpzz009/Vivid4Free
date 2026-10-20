<template>
  <Transition name="toast">
    <div v-if="visible" class="toast-panel pod-panel" :class="`toast-${type}`" :role="type === 'error' ? 'alert' : 'status'">
      <span class="toast-symbol" aria-hidden="true">{{ type === 'success' ? '✓' : type === 'error' ? '!' : 'i' }}</span>
      <div class="toast-copy"><strong v-if="title">{{ title }}</strong><p>{{ message }}</p><progress v-if="showProgress && progress !== undefined" :value="progress" max="100" aria-label="任务进度" /></div>
      <IconButton size="sm" aria-label="关闭提示" @click="close">×</IconButton>
    </div>
  </Transition>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import IconButton from '@/ui/IconButton.vue'
const props = defineProps({ type: { type: String, default: 'info' }, title: { type: String, default: '' }, message: { type: String, required: true }, duration: { type: Number, default: 4000 }, showProgress: Boolean, persistent: Boolean, progress: Number })
const emit = defineEmits(['close'])
const visible = ref(true)
let timer
let closeTimer
function close() { visible.value = false; clearTimeout(timer); closeTimer = setTimeout(() => emit('close'), 150) }
onMounted(() => { if (!props.persistent && props.duration > 0) timer = setTimeout(close, props.duration) })
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(closeTimer) })
</script>
<style scoped>
.toast-panel{display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-4);border-radius:var(--border-radius-base);pointer-events:auto;color:var(--text-primary)}
.toast-symbol{display:grid;place-items:center;width:24px;height:24px;flex:none;color:var(--brand-primary);font-size:16px}.toast-success .toast-symbol{color:var(--ui-green-color)}.toast-error .toast-symbol{color:var(--color-red-500)}
.toast-copy{flex:1;min-width:0;font-size:14px;line-height:20px}.toast-copy strong{font-size:12px}.toast-copy p{margin:0;overflow-wrap:anywhere}.toast-copy progress{width:100%;accent-color:var(--brand-primary)}
.toast-enter-active,.toast-leave-active{transition:opacity var(--transition-speed-fast),transform var(--transition-speed-fast)}.toast-enter-from,.toast-leave-to{opacity:0;transform:translateY(4px)}
</style>
