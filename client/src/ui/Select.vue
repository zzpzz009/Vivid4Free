<script setup lang="ts">
interface Props {
  modelValue?: string | number;
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();
</script>

<template>
  <select
    :class="['pod-select', $attrs.class as string]"
    :value="modelValue"
    @change="(e) => emit('update:modelValue', (e.target as HTMLSelectElement).value)"
  >
    <slot />
  </select>
</template>
