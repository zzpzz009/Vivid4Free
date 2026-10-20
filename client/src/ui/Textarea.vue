<script setup lang="ts">
interface Props {
  modelValue?: string;
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
</script>

<template>
  <textarea
    :class="['pod-textarea', $attrs.class as string]"
    :value="modelValue"
    @input="(e) => emit('update:modelValue', (e.target as HTMLTextAreaElement).value)"
  ></textarea>
</template>
