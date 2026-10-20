<script setup lang="ts">
import { computed, useAttrs } from 'vue';

interface Props {
  variant?: 'default' | 'filled' | 'outline';
  inputSize?: 'sm' | 'md' | 'lg';
  modelValue?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  inputSize: 'md',
  modelValue: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

defineOptions({
  inheritAttrs: false
});

const attrs = useAttrs();

const sizeClass = computed(() => {
  switch (props.inputSize) {
    case 'sm': return 'pod-input-sm';
    case 'lg': return 'h-12 text-lg';
    default: return 'pod-input-md';
  }
});
</script>

<template>
  <input
    v-bind="attrs"
    :class="[
      'pod-input',
      sizeClass,
      variant === 'filled' ? 'bg-[#1f2937] border-[#374151]' : '',
      attrs.class as string
    ]"
    :value="modelValue"
    @input="(e) => emit('update:modelValue', (e.target as HTMLInputElement).value)"
  />
</template>
