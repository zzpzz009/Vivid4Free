<template>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-x-full opacity-0 scale-95"
    enter-to-class="transform translate-x-0 opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-x-0 opacity-100 scale-100"
    leave-to-class="transform translate-x-full opacity-0 scale-95"
  >
    <div
      v-if="visible"
      class="toast-outer fixed top-4 right-4 z-50 max-w-sm w-full rounded-xl overflow-hidden p-[2px]"
      :class="{ 'animate-spin-slow': isSpinning, 'island-toast': isIsland }"
      :style="outerStyles"
    >
      <div class="toast-inner relative bg-schemes-surface-container-high rounded-lg p-4 flex items-start h-full w-full">
        <!-- Icon -->
        <div class="flex-shrink-0 mr-3 z-10">
          <div
            :class="iconClasses"
            class="w-6 h-6 flex items-center justify-center"
          >
            <IslandIcon v-if="isIsland" :name="islandIcon" :size="24" />
            <svg
              v-else-if="type === 'success'"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M9 12.75 11.25 15 15 9.75"
              />
              <path
                d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <svg
              v-else-if="type === 'error'"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <svg
              v-else-if="type === 'warning'"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 9v4"
              />
              <path
                d="M12 17h.01"
              />
              <path
                d="M10.29 3.86 2.34 17.26A1.5 1.5 0 0 0 3.63 19.5h16.74a1.5 1.5 0 0 0 1.29-2.24L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
              />
            </svg>
            <svg
              v-else
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0 z-10">
          <div
            v-if="title"
            class="font-m3-label-large-emphasized-font-family text-m3-label-large-emphasized-font-size font-m3-label-large-emphasized-font-weight text-schemes-on-surface-variant"
          >
            {{ title }}
          </div>
          <div class="font-m3-body-medium-font-family text-m3-body-medium-font-size mt-1 text-schemes-on-surface-variant break-words">
            {{ message }}
          </div>
          <div v-if="isIsland && progress !== undefined" class="mt-3" role="progressbar" aria-label="操作进度" :aria-valuenow="Math.min(100, Math.max(0, progress))" aria-valuemin="0" aria-valuemax="100">
            <IslandProgress :percent="progress" variant="forest-grove" size="small" aria-hidden="true" />
          </div>
        </div>

        <!-- Close Button -->
        <div class="ml-4 flex-shrink-0 z-10">
          <button
            class="rounded-md p-1.5 hover:opacity-75 transition-opacity focus:outline-none text-schemes-on-surface-variant"
            aria-label="关闭提示"
            @click="close"
          >
            <svg
              class="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Icon as IslandIcon, Progress as IslandProgress } from 'animal-island-vue'
import { useUIStore } from '@/stores/useUIStore.js'

export default {
  name: 'Toast',
  components: { IslandIcon, IslandProgress },
  props: {
    type: {
      type: String,
      default: 'info',
      validator: (value) => ['success', 'error', 'warning', 'info'].includes(value)
    },
    title: {
      type: String,
      default: ''
    },
    message: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      default: 4000 // 4 seconds
    },
    showProgress: {
      type: Boolean,
      default: false
    },
    persistent: {
      type: Boolean,
      default: false
    },
    progress: {
      type: Number,
      default: undefined
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const uiStore = useUIStore()
    const isIsland = computed(() => uiStore.skin === 'animal-island')
    const islandIcon = computed(() => ({ success: 'Check', error: 'Close', warning: 'Bell', info: 'Chat' })[props.type])
    const visible = ref(true)
    let timer = null

    const colors = {
      success: '#22c55e', // green-500
      error: '#ef4444',   // red-500
      warning: '#eab308', // yellow-500
      info: '#3b82f6'     // blue-500
    }

    const accentColor = computed(() => {
      if (!isIsland.value) return colors[props.type] || colors.info
      const tokens = { success: 'success', error: 'error', warning: 'warning', info: 'primary' }
      return `var(--animal-${tokens[props.type]}-color)`
    })

    const isSpinning = computed(() => !isIsland.value && props.progress === undefined)

    const outerStyles = computed(() => {
      if (isIsland.value) return { '--toast-accent': accentColor.value }
      if (props.progress !== undefined) {
        const p = Math.min(Math.max(props.progress, 0), 100)
        return {
          background: `conic-gradient(from 0deg, ${accentColor.value} 0%, ${accentColor.value} ${p}%, transparent ${p}%, transparent 100%)`
        }
      } else {
        return {
          '--accent': accentColor.value
        }
      }
    })

    const iconClasses = computed(() => {
      if (isIsland.value) return ''
      const typeClasses = {
        success: 'text-green-500',
        error: 'text-red-500',
        warning: 'text-yellow-500',
        info: 'text-blue-500'
      }
      return typeClasses[props.type]
    })

    const close = () => {
      visible.value = false
      if (timer) clearTimeout(timer)
      setTimeout(() => {
        emit('close')
      }, 200)
    }

    onMounted(() => {
      if (!props.persistent && props.duration > 0) {
        timer = setTimeout(() => {
          close()
        }, props.duration)
      }
    })

    onUnmounted(() => {
      if (timer) clearTimeout(timer)
    })

    return {
      visible,
      isIsland,
      islandIcon,
      accentColor,
      isSpinning,
      outerStyles,
      iconClasses,
      close
    }
  }
}
</script>

<style scoped>
.toast-outer {
  position: relative;
  /* Fallback border color */
  background-color: rgba(255, 255, 255, 0.1);
}

.toast-outer::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(transparent, transparent 25%, var(--accent) 50%, transparent 75%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 0;
  pointer-events: none;
}

.toast-outer.animate-spin-slow::before {
  opacity: 1;
  animation: rotate 4s linear infinite;
}

.toast-inner {
  z-index: 1;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}
</style>
