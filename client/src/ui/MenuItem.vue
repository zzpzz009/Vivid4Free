<script setup lang="ts">
</script>

<template>
  <button
    :class="[
      'pod-menu-item',
      $attrs.class as string
    ]"
  >
    <slot />
  </button>
</template>
