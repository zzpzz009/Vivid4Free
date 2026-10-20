<script setup lang="ts">
interface Props {
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ = props;
</script>

<template>
  <button
    :class="[
      'pod-chip',
      active ? 'active' : '',
      $attrs.class as string
    ]"
  >
    <slot />
  </button>
</template>
