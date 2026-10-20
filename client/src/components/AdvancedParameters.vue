<template>
  <div class="space-y-4">
    <!-- 线稿图和材质图上传区域 -->
    <div class="grid grid-cols-2 gap-3">
      <!-- 线稿图 -->
      <div
        class="upload-area h-[120px] cursor-pointer relative border-2 border-dashed border-schemes-outline-variant"
        :class="{ 'drag-over': isDragOverWireframe }"
        @drop="handleWireframeDrop"
        @dragover.prevent
        @dragenter="isDragOverWireframe = true"
        @dragleave="isDragOverWireframe = false"
        @click="triggerWireframeUpload"
      >
        <input
          ref="wireframeInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleWireframeFileSelect"
        >
        
        <div
          v-if="!uploadedWireframe"
          class="flex flex-col items-center gap-2"
        >
          <div class="w-8 h-8 rounded-full bg-schemes-surface-container-high flex items-center justify-center">
            <svg
              class="w-4 h-4 text-schemes-on-surface-variant"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="text-schemes-on-surface-variant text-xs text-center">
            <div class="font-m3-label-medium-font-family font-m3-label-medium-font-weight text-schemes-primary">
              线稿图
            </div>
            <div class=" mt-1 font-m3-body-small-font-family">
              将图像拖到这里上传<br>或 点我选择图片
            </div>
          </div>
        </div>
        
        <div
          v-else
          class="relative w-full h-full"
        >
          <img
            :src="uploadedWireframe.preview"
            :alt="uploadedWireframe.name"
            class="w-full h-full object-cover rounded-lg"
          >
          <button
            class="absolute top-1 right-1 w-5 h-5 bg-schemes-surface-container-high rounded-full flex items-center justify-center hover:bg-schemes-surface-container transition-colors"
            @click.stop="clearWireframe"
          >
            <svg
              class="w-3 h-3 text-schemes-on-surface-variant"
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

      <!-- 材质图 -->
      <div
        class="upload-area h-[120px] cursor-pointer relative border-2 border-dashed border-schemes-outline-variant"
        :class="{ 'drag-over': isDragOverMaterial }"
        @drop="handleMaterialDrop"
        @dragover.prevent
        @dragenter="isDragOverMaterial = true"
        @dragleave="isDragOverMaterial = false"
        @click="triggerMaterialUpload"
      >
        <input
          ref="materialInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleMaterialFileSelect"
        >
        
        <div
          v-if="!uploadedMaterial"
          class="flex flex-col items-center gap-2"
        >
          <div class="w-8 h-8 rounded-full bg-schemes-surface-container-high flex items-center justify-center">
            <svg
              class="w-4 h-4 text-schemes-on-surface-variant"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="text-schemes-on-surface-variant text-xs text-center">
            <div class="font-m3-label-medium-font-family font-m3-label-medium-font-weight text-schemes-primary">
              材质图
            </div>
            <div class="text-[10px] mt-1 font-m3-body-small-font-family">
              将图像拖到这里上传<br>或 点我选择图片
            </div>
          </div>
        </div>
        
        <div
          v-else
          class="relative w-full h-full"
        >
          <img
            :src="uploadedMaterial.preview"
            :alt="uploadedMaterial.name"
            class="w-full h-full object-cover rounded-lg"
          >
          <button
            class="absolute top-1 right-1 w-5 h-5 bg-schemes-surface-container-high rounded-full flex items-center justify-center hover:bg-schemes-surface-container transition-colors"
            @click.stop="clearMaterial"
          >
            <svg
              class="w-3 h-3 text-schemes-on-surface-variant"
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

    <!-- 输出图像尺寸 -->
    <!-- <div class="space-y-2">
      <label class="text-schemes-on-surface-variant text-sm font-m3-label-medium-font-family font-m3-label-medium-font-weight letter-spacing-m3-label-medium">
        输出图像尺寸（长边）
      </label>
      <div class="relative">
        <input
          v-model.number="outputSize"
          type="number"
          min="512"
          max="6000"
          step="64"
          class="input-field w-full text-schemes-on-surface text-sm font-m3-body-medium-font-family focus:outline-none focus:ring-2 focus:ring-schemes-primary transition-colors"
          placeholder="默认3200，最高6000"
          @blur="validateOutputSize"
        />
      </div>
    </div> -->

    <!-- 随机种子 -->
    <div class="space-y-2">
      <label class="text-schemes-on-surface-variant text-sm font-m3-label-medium-font-family font-m3-label-medium-font-weight letter-spacing-m3-label-medium">
        随机种子
      </label>
      <div class="flex gap-2">
        <input
          v-model="randomSeed"
          type="text"
          class="input-field flex-1 text-schemes-on-surface text-sm font-m3-body-medium-font-family focus:outline-none focus:ring-2 focus:ring-schemes-primary transition-colors"
          placeholder="123456789012345"
        >
        <button
          class="bg-schemes-primary-container text-white px-3  rounded-lg text-sm font-m3-label-large-font-family font-m3-label-large-font-weight letter-spacing-m3-label-large hover:bg-opacity-80 transition-colors"
          @click="generateRandomSeed"
        >
          更换
        </button>
      </div>
    </div>

    <!-- 参考模式 -->
    <div class="space-y-3">
      <RadioGroup v-model="referenceMode">
        <div class="grid grid-cols-2 gap-3">
          <RadioGroupOption
            v-for="option in referenceModeOptions"
            :key="option.value"
            v-slot="{ checked }"
            :value="option.value"
          >
            <div class="flex items-center cursor-pointer">
              <div
                class="w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 transition-colors"
                :class="checked ? 'border-schemes-primary' : 'border-schemes-outline'"
              >
                <div
                  v-if="checked"
                  class="w-2 h-2 rounded-full bg-schemes-primary"
                />
              </div>
              <span class="text-schemes-on-surface text-sm font-m3-body-medium-font-family">{{ option.label }}</span>
            </div>
          </RadioGroupOption>
        </div>
      </RadioGroup>

      <RadioGroup v-model="processingMode">
        <div class="grid grid-cols-2 gap-3">
          <RadioGroupOption
            v-for="option in processingModeOptions"
            :key="option.value"
            v-slot="{ checked }"
            :value="option.value"
          >
            <div class="flex items-center cursor-pointer">
              <div
                class="w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 transition-colors"
                :class="checked ? 'border-schemes-primary' : 'border-schemes-outline'"
              >
                <div
                  v-if="checked"
                  class="w-2 h-2 rounded-full bg-schemes-primary"
                />
              </div>
              <span class="text-schemes-on-surface text-sm font-m3-body-medium-font-family">{{ option.label }}</span>
            </div>
          </RadioGroupOption>
        </div>
      </RadioGroup>
    </div>

    <!-- 滑块控件 -->
    <div class="space-y-4">
      <!-- 形体还原 -->
      <Slider
        v-model="shapeRestoration"
        label="形体还原"
        :min="0"
        :max="1"
        :step="0.1"
        :value-formatter="formatSliderValue"
        show-progress
      />

      <!-- 材质还原 -->
      <Slider
        v-model="materialRestoration"
        label="材质还原"
        :min="0"
        :max="1"
        :step="0.1"
        :value-formatter="formatSliderValue"
        show-progress
      />
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import { RadioGroup, RadioGroupOption } from '@headlessui/vue'
import Slider from './ui/Slider.vue'

export default {
  name: 'AdvancedParameters',
  components: {
    RadioGroup,
    RadioGroupOption,
    Slider
  },
  emits: ['parameters-change'],
  setup(props, { emit }) {
    // 上传状态
    const isDragOverWireframe = ref(false)
    const isDragOverMaterial = ref(false)
    const uploadedWireframe = ref(null)
    const uploadedMaterial = ref(null)
    
    // 表单数据
    // const outputSize = ref(3200)
    const seed = ref('123456789012345')  // 直接使用工作流参数名
    const referenceMode = ref('mode1')
    const processingMode = ref('fast')
    const shapeRestoration = ref(0.6)
    const materialRestoration = ref(0.6)
    
    // 文件输入引用
    const wireframeInput = ref(null)
    const materialInput = ref(null)

    // 选项配置
    const referenceModeOptions = [
      { value: 'mode1', label: '参考模式一' },
      { value: 'mode2', label: '参考模式二' }
    ]

    const processingModeOptions = [
      { value: 'fast', label: '快速模式' },
      { value: 'highQuality', label: '高精度模式' }
    ]

    // 线稿图上传处理
    const triggerWireframeUpload = () => {
      wireframeInput.value?.click()
    }

    const handleWireframeFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        processImageFile(file, 'wireframe')
      }
    }

    const handleWireframeDrop = (event) => {
      event.preventDefault()
      isDragOverWireframe.value = false
      const file = event.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        processImageFile(file, 'wireframe')
      }
    }

    const clearWireframe = () => {
      uploadedWireframe.value = null
      if (wireframeInput.value) {
        wireframeInput.value.value = ''
      }
    }

    // 材质图上传处理
    const triggerMaterialUpload = () => {
      materialInput.value?.click()
    }

    const handleMaterialFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        processImageFile(file, 'material')
      }
    }

    const handleMaterialDrop = (event) => {
      event.preventDefault()
      isDragOverMaterial.value = false
      const file = event.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        processImageFile(file, 'material')
      }
    }

    const clearMaterial = () => {
      uploadedMaterial.value = null
      if (materialInput.value) {
        materialInput.value.value = ''
      }
    }

    // 处理上传的图片文件
    const processImageFile = (file, type) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageData = {
          file: file,
          name: file.name,
          size: file.size,
          preview: e.target.result
        }

        if (type === 'wireframe') {
          uploadedWireframe.value = imageData
        } else if (type === 'material') {
          uploadedMaterial.value = imageData
        }
      }
      reader.readAsDataURL(file)
    }

    // 验证输出尺寸
    // const validateOutputSize = () => {
    //   if (outputSize.value < 512) {
    //     outputSize.value = 512
    //   } else if (outputSize.value > 6000) {
    //     outputSize.value = 6000
    //   }
    //   // 确保是64的倍数
    //   outputSize.value = Math.round(outputSize.value / 64) * 64
    // }

    // 生成随机种子
    const generateRandomSeed = () => {
      randomSeed.value = Math.floor(Math.random() * 1000000000000000).toString()
    }

    // 格式化滑块值显示
    const formatSliderValue = (value) => {
      return Number(value).toFixed(1)
    }

    // 监听参数变化并向父组件发送事件
    const emitParametersChange = () => {
      const parameters = {
        // 不在JSON中传递图片文件，而是单独传递文件对象
        hasWireframeImage: !!uploadedWireframe.value,
        hasMaterialImage: !!uploadedMaterial.value,
        outputSize: outputSize.value,
        seed: seed.value,  // 直接使用工作流参数名
        referenceMode: referenceMode.value,
        processingMode: processingMode.value,
        shapeRestoration: shapeRestoration.value,
        materialRestoration: materialRestoration.value
      }

      // 单独传递文件对象
      const files = {
        wireframeImage: uploadedWireframe.value,
        materialImage: uploadedMaterial.value
      }

      emit('parameters-change', { parameters, files })
    }

    // 监听所有参数变化
    watch([outputSize, seed, referenceMode, processingMode, shapeRestoration, materialRestoration], () => {
      emitParametersChange()
    })

    // 监听图片上传变化
    watch([uploadedWireframe, uploadedMaterial], () => {
      emitParametersChange()
    })

    return {
      isDragOverWireframe,
      isDragOverMaterial,
      uploadedWireframe,
      uploadedMaterial,
      // outputSize,
      randomSeed,
      referenceMode,
      processingMode,
      shapeRestoration,
      materialRestoration,
      wireframeInput,
      materialInput,
      referenceModeOptions,
      processingModeOptions,
      triggerWireframeUpload,
      handleWireframeFileSelect,
      handleWireframeDrop,
      clearWireframe,
      triggerMaterialUpload,
      handleMaterialFileSelect,
      handleMaterialDrop,
      clearMaterial,
      // validateOutputSize,
      generateRandomSeed,
      formatSliderValue
    }
  }
}
</script>


