<script setup lang="ts">
interface Props {
  elevated?: boolean;
  softGradient?: boolean;
}

withDefaults(defineProps<Props>(), {
  elevated: false,
  softGradient: false,
});
</script>

<template>
  <div
    :class="[
      'pod-toolbar',
      elevated ? 'pod-toolbar-elevated' : '',
      softGradient ? 'pod-bar-soft-gradient' : '',
      $attrs.class as string
    ]"
  >
    <slot />
  </div>
</template>
