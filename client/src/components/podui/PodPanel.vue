<script setup lang="ts">
import { computed } from 'vue';

type PodPanelVariant = 'default' | 'brand-gradient' | 'transparent' | 'black' | 'pill';

interface Props {
  variant?: PodPanelVariant;
  rounded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  rounded: false,
});

const variantClass = computed(() => {
  switch (props.variant) {
    case 'default': return 'pod-panel';
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
      rounded ? 'pod-panel-rounded-xl' : ''
    ]"
  >
    <slot />
  </div>
</template>
