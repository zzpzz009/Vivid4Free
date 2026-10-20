<template>
  <div v-if="visible" class="fixed inset-0 z-[210] pointer-events-none">
    <div ref="menuEl" class="pod-context-menu pointer-events-auto" role="menu" aria-label="图片操作" :style="position" @keydown="onMenuKeydown">
      <button v-if="actions.includes('primary')" type="button" role="menuitem" class="pod-context-menu-item" @click="$emit('primary')">设为主图</button>
      <button v-if="actions.includes('secondary')" type="button" role="menuitem" class="pod-context-menu-item" @click="$emit('secondary')">设为参考图</button>
      <button v-if="actions.includes('preview')" type="button" role="menuitem" class="pod-context-menu-item" @click="$emit('preview')">预览</button>
      <button v-if="actions.includes('open-original')" type="button" role="menuitem" class="pod-context-menu-item" @click="$emit('open-original')">查看原图</button>
      <button v-if="actions.includes('copy')" type="button" role="menuitem" class="pod-context-menu-item" @click="$emit('copy')">复制链接</button>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  position: { type: Object, default: () => ({}) },
  actions: { type: Array, default: () => ['primary', 'secondary', 'preview', 'open-original', 'copy'] }
})
const emit = defineEmits(['close', 'primary', 'secondary', 'preview', 'open-original', 'copy'])
const menuEl = ref(null)

const focusFirstItem = () => menuEl.value?.querySelector('[role="menuitem"]')?.focus()
const onOutsidePointer = (event) => {
  if (props.visible && !menuEl.value?.contains(event.target)) emit('close', 'outside')
}
const onWindowKeydown = (event) => {
  if (!props.visible || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  emit('close', 'escape')
}
const onMenuKeydown = (event) => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = [...(menuEl.value?.querySelectorAll('[role="menuitem"]') || [])]
  if (!items.length) return
  event.preventDefault()
  const current = items.indexOf(document.activeElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}

watch(() => props.visible, (visible) => {
  if (visible) {
    document.addEventListener('pointerdown', onOutsidePointer, true)
    window.addEventListener('keydown', onWindowKeydown, true)
    nextTick(focusFirstItem)
  } else {
    document.removeEventListener('pointerdown', onOutsidePointer, true)
    window.removeEventListener('keydown', onWindowKeydown, true)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  window.removeEventListener('keydown', onWindowKeydown, true)
})
</script>
