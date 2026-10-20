<template>
  <div class="sidebar-upload-card" :class="{ 'is-dragging': dragging }" @click="$emit('activate')">
    <button type="button" class="upload-trigger" :aria-label="label" @click.stop="$emit('activate')" />
    <div class="upload-content"><slot /></div>
  </div>
</template>
<script setup>
defineProps({ label: { type: String, required: true }, dragging: Boolean })
defineEmits(['activate'])
</script>
<style scoped>
.sidebar-upload-card{position:relative;display:flex;align-items:center;justify-content:center;width:265px;overflow:hidden;border:1px solid transparent;border-radius:var(--border-radius-xs);background:var(--schemes-surface-container);transition:background var(--transition-speed-fast),border-color var(--transition-speed-fast)}
.sidebar-upload-card:hover,.is-dragging{border-color:var(--brand-primary);background:var(--schemes-surface-container-high)}
.upload-trigger{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;cursor:pointer}.upload-trigger:focus-visible{box-shadow:inset var(--pod-ring)}
.upload-content{display:contents}.upload-content :deep(input[type=file]){display:none}.upload-content :deep(button){z-index:1}
</style>
