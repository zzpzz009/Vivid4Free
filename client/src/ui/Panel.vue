<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  elevated?: boolean;
  variant?: 'default' | 'brand-gradient' | 'transparent' | 'black' | 'pill';
  rounded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  elevated: false,
  variant: 'default',
  rounded: false,
});

const variantClass = computed(() => {
  switch (props.variant) {
    case 'brand-gradient': return 'pod-panel pod-panel-brand-gradient';
    case 'transparent': return 'pod-panel pod-panel-transparent';
    case 'black': return 'pod-panel pod-panel-black';
    case 'pill': return 'pod-panel pod-panel-pill';
    default: return 'pod-panel';
  }
});
</script>

<template>
  <div
    :class="[
      variantClass,
      elevated ? 'pod-toolbar-elevated' : '',
      rounded ? 'pod-panel-rounded-xl' : '',
      $attrs.class as string
    ]"
  >
    <slot />
  </div>
</template>
