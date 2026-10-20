<script setup lang="ts">
import { computed } from 'vue';

type PodButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'generate';
type PodButtonSize = 'xs' | 'sm' | 'md';

interface Props {
  variant?: PodButtonVariant;
  size?: PodButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  isLoading: false,
  disabled: false,
});

const variantClass = computed(() => {
  switch (props.variant) {
    case 'primary': return 'pod-primary-button';
    case 'secondary': return 'pod-btn-secondary';
    case 'ghost': return 'pod-btn-ghost';
    case 'outline': return 'pod-btn-outline';
    case 'danger': return 'pod-btn-danger';
    case 'generate': return 'pod-generate-button';
    default: return 'pod-primary-button';
  }
});

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs': return 'pod-btn-xs';
    case 'sm': return 'pod-btn-sm';
    case 'md': return 'pod-btn-md';
    default: return 'pod-btn-md';
  }
});
</script>

<template>
  <button
    :class="[
      variantClass,
      sizeClass,
      isLoading ? 'opacity-80 cursor-wait' : '',
      'flex items-center justify-center gap-2'
    ]"
    :disabled="disabled || isLoading"
  >
    <svg v-if="isLoading" class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <template v-if="!isLoading">
      <slot name="leftIcon" />
      <slot />
      <slot name="rightIcon" />
    </template>
  </button>
</template>
