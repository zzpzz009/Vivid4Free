<script setup lang="ts">
type PodToolbarVariant = 'default' | 'elevated';

interface Props {
  variant?: PodToolbarVariant;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
});
</script>

<template>
  <div
    :class="[
      props.variant === 'elevated' ? 'pod-toolbar-elevated' : 'pod-toolbar'
    ]"
  >
    <slot />
  </div>
</template>
