<template>
  <div class="space-y-2">
    <div class="flex justify-between items-center">
      <label 
        v-if="label"
        :for="inputId"
        class="text-schemes-on-surface-variant text-sm font-m3-label-medium-font-family font-m3-label-medium-font-weight letter-spacing-m3-label-medium"
      >
        {{ label }}
      </label>
      <span 
        v-if="showValue"
        class="text-schemes-on-surface text-sm font-m3-body-medium-font-family"
      >
        {{ displayValue }}
      </span>
    </div>
    <div
      class="relative"
      style="line-height: 0;"
    >
      <input
        :id="inputId"
        v-model="internalValue"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        class="slider w-full h-2 bg-schemes-secondary-container rounded-lg appearance-none cursor-pointer"
        :class="{ 'opacity-50 cursor-not-allowed': disabled }"
        @input="handleInput"
        @change="handleChange"
      >
      
      <!-- 自定义轨道进度显示 -->
      <div
        v-if="showProgress"
        class="absolute top-1/2 -translate-y-1/2 left-0 h-[4px] bg-schemes-primary-container rounded-lg pointer-events-none opacity-60"
        :style="{ width: progressWidth + '%' }"
      />
    </div>
    
    <!-- 可选的刻度标记 -->
    <div 
      v-if="showTicks && ticks.length > 0"
      class="flex justify-between text-xs text-schemes-on-surface-variant font-m3-body-small-font-family"
    >
      <span 
        v-for="tick in ticks"
        :key="tick"
        class="text-center"
      >
        {{ formatTick(tick) }}
      </span>
    </div>
    
    <!-- 帮助文本 -->
    <div 
      v-if="helpText"
      class="text-xs text-schemes-on-surface-variant font-m3-body-small-font-family"
    >
      {{ helpText }}
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'

export default {
  name: 'Slider',
  props: {
    modelValue: {
      type: [Number, String],
      default: 0
    },
    min: {
      type: [Number, String],
      default: 0
    },
    max: {
      type: [Number, String],
      default: 100
    },
    step: {
      type: [Number, String],
      default: 1
    },
    label: {
      type: String,
      default: ''
    },
    helpText: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    },
    showValue: {
      type: Boolean,
      default: true
    },
    showProgress: {
      type: Boolean,
      default: true
    },
    showTicks: {
      type: Boolean,
      default: false
    },
    ticks: {
      type: Array,
      default: () => []
    },
    valueFormatter: {
      type: Function,
      default: null
    },
    tickFormatter: {
      type: Function,
      default: null
    },
    id: {
      type: String,
      default: null
    }
  },
  emits: ['update:modelValue', 'input', 'change'],
  setup(props, { emit }) {
    const internalValue = ref(props.modelValue)
    
    // 生成唯一的输入框 ID
    const inputId = computed(() => {
      return props.id || `slider-${Math.random().toString(36).substr(2, 9)}`
    })
    
    // 计算进度宽度百分比
    const progressWidth = computed(() => {
      const min = Number(props.min)
      const max = Number(props.max)
      const value = Number(internalValue.value)
      return ((value - min) / (max - min)) * 100
    })
    
    // 格式化显示值
    const displayValue = computed(() => {
      if (props.valueFormatter && typeof props.valueFormatter === 'function') {
        return props.valueFormatter(internalValue.value)
      }
      return internalValue.value
    })
    
    // 格式化刻度值
    const formatTick = (tick) => {
      if (props.tickFormatter && typeof props.tickFormatter === 'function') {
        return props.tickFormatter(tick)
      }
      return tick
    }
    
    // 监听外部值变化
    watch(() => props.modelValue, (newValue) => {
      internalValue.value = newValue
    })
    
    // 监听内部值变化
    watch(internalValue, (newValue) => {
      emit('update:modelValue', Number(newValue))
    })
    
    // 处理输入事件
    const handleInput = (event) => {
      const value = Number(event.target.value)
      internalValue.value = value
      emit('input', value)
    }
    
    // 处理变化事件
    const handleChange = (event) => {
      const value = Number(event.target.value)
      emit('change', value)
    }
    
    return {
      internalValue,
      inputId,
      progressWidth,
      displayValue,
      formatTick,
      handleInput,
      handleChange
    }
  }
}
</script>

<style scoped>
/* 自定义滑块样式 */
.slider {
  background: transparent;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-container);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 2;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  /* 确保垂直居中 */
  margin-top: -8px; /* (thumb_height - track_height) / 2 = (20 - 4) / 2 = 8px */
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

.slider::-webkit-slider-thumb:active {
  transform: scale(0.95);
}

.slider::-webkit-slider-track {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  cursor: pointer;
  background: color-mix(in srgb, var(--schemes-primary-container) 30%, transparent);
  border-radius: 2px;
  border: none;
}

.slider::-webkit-slider-runnable-track {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  cursor: pointer;
  background: color-mix(in srgb, var(--schemes-primary-container) 30%, transparent);
  border-radius: 2px;
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-container);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  /* Firefox 默认会自动居中，但确保没有额外的边框 */
  -moz-appearance: none;
}

.slider::-moz-range-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

.slider::-moz-range-track {
  width: 100%;
  height: 4px;
  cursor: pointer;
  background: var(--schemes-primary-container);
  border-radius: 2px;
  border: none;
  /* 确保轨道样式一致 */
  -moz-appearance: none;
}

.slider::-ms-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-container);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-top: -8px; /* 垂直居中：(thumb_height - track_height) / 2 = (20 - 4) / 2 = 8px */
}

.slider::-ms-track {
  width: 100%;
  height: 4px;
  cursor: pointer;
  background: transparent;
  border-color: transparent;
  color: transparent;
  border-width: 8px 0; /* 上下各8px的透明边框，确保点击区域足够 */
}

.slider::-ms-fill-lower {
  background: var(--schemes-primary-container);
  border-radius: 2px;
  height: 4px;
}

.slider::-ms-fill-upper {
  background: var(--schemes-primary-container);
  border-radius: 2px;
  height: 4px;
}

/* 禁用状态样式 */
.slider:disabled::-webkit-slider-thumb {
  background: var(--schemes-outline);
  cursor: not-allowed;
  transform: none;
  margin-top: -8px; /* 保持垂直居中 */
}

.slider:disabled::-moz-range-thumb {
  background: var(--schemes-outline);
  cursor: not-allowed;
  transform: none;
}

.slider:disabled::-ms-thumb {
  background: var(--schemes-outline);
  cursor: not-allowed;
  transform: none;
  margin-top: -8px; /* 保持垂直居中 */
}
</style>
