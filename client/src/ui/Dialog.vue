<script setup lang="ts">
interface Props {
  open: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <div v-if="open" class="pod-dialog-overlay" @click="emit('close')">
    <div 
      :class="['pod-panel', $attrs.class as string]" 
      @click.stop
    >
      <slot />
    </div>
  </div>
</template>
