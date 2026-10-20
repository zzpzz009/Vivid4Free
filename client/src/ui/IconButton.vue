<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  active?: boolean;
  noHoverHighlight?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  noHoverHighlight: false,
  size: 'md',
  disabled: false,
});

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'pod-icon-sm';
    case 'lg': return 'pod-icon-lg';
    default: return 'pod-icon-md';
  }
});
</script>

<template>
  <button
    :class="[
      'pod-icon-button',
      active ? 'active' : '',
      noHoverHighlight ? 'no-hover-highlight' : '',
      sizeClass,
      $attrs.class as string
    ]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
