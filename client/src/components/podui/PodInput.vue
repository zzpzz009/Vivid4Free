<script setup lang="ts">
import { computed, useAttrs } from 'vue';

type PodInputSize = 'sm' | 'md';

interface Props {
  size?: PodInputSize;
  hasError?: boolean;
  modelValue?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  hasError: false,
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
  switch (props.size) {
    case 'sm': return 'pod-input-sm';
    case 'md': return 'pod-input-md';
    default: return 'pod-input-md';
  }
});
</script>

<template>
  <div class="relative w-full">
    <div v-if="$slots.leftIcon" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
      <slot name="leftIcon" />
    </div>
    
    <input
      v-bind="attrs"
      :class="[
        'pod-input',
        sizeClass,
        'w-full',
        hasError ? 'border-red-500 focus:border-red-500' : '',
        $slots.leftIcon ? 'pl-9' : '',
        $slots.rightIcon ? 'pr-9' : '',
        attrs.class as string
      ]"
      :value="modelValue"
      @input="(e) => emit('update:modelValue', (e.target as HTMLInputElement).value)"
    />

    <div v-if="$slots.rightIcon" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
      <slot name="rightIcon" />
    </div>
  </div>
</template>
