<template>
  <div id="workspace-inputs" class="h-full flex flex-col shrink-0" data-testid="unified-sidebar">
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
      <div class="flex flex-col gap-4 m-4 pb-8">
        <!-- Upload Image Area -->
        <component :is="uiStore.skin === 'animal-island' ? IslandCard : 'div'"
          v-bind="uiStore.skin === 'animal-island' ? { type: 'dashed', pattern: 'default' } : {}"
          class="island-upload-card island-main-card bg-schemes-surface-container rounded-lg flex flex-col gap-0 items-center justify-center w-[265px] overflow-hidden cursor-pointer transition-colors duration-200 relative"
          :class="[
            multipleImages ? 'min-h-[182px]' : 'h-[182px]',
            isDragOverImage ? 'bg-schemes-surface-container-high' : ''
          ]"
          @drop="handleImageDrop"
          @dragover.prevent
          @dragenter="isDragOverImage = true"
          @dragleave="isDragOverImage = false"
          role="button" tabindex="0" aria-label="上传待处理图片" @keydown.enter.self.prevent="triggerImageUpload" @keydown.space.self.prevent="triggerImageUpload" @click="triggerImageUpload"
        >
          <input
            ref="imageInput"
            type="file"
            accept="image/*"
            :multiple="multipleImages"
            class="hidden"
            @change="handleImageFileSelect"
          >

          <!-- Single Image Preview -->
          <div
            v-if="!multipleImages && uploadedImage"
            class="w-full h-full relative"
          >
            <img
              :src="baseImageWithMask || uploadedImage.preview"
              :alt="uploadedImage.name"
              class="w-full h-full object-cover rounded-lg"
            >
            <!-- Overlay with image info -->
            <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 rounded-lg">
              <div class="text-white text-xs font-medium truncate">
                {{ uploadedImage.name }}
              </div>
              <!-- <div class="text-white text-xs opacity-75">{{ formatFileSize(uploadedImage.size) }}</div> -->
            </div>
            <!-- Clear image button -->
            <button
              class="absolute top-1 right-1 w-5 h-5 bg-schemes-surface-container-high rounded-full flex items-center justify-center hover:bg-schemes-surface-container transition-colors"
              title="清空基础图"
              @click.stop="clearImage"
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
            <button
              v-if="showBrushButton && uploadedImage"
              class="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-black/80"
              title="绘制蒙版"
              @click.stop="$emit('open-mask-editor')"
            >
              <img
                class="h-4 w-4"
                :src="magicWandIcon"
                alt="Open Mask Editor"
              >
              <span>绘制蒙版</span>
            </button>
          </div>

          <!-- Multiple Images Preview -->
          <div
            v-else-if="multipleImages && uploadedImages.length"
            class="w-full p-2"
          >
            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="(image, index) in uploadedImages"
                :key="index"
                class="relative group"
              >
                <img
                  :src="image.preview"
                  :alt="image.name"
                  class="w-full h-20 object-cover rounded-lg"
                >
                <button
                  class="absolute -top-1 -right-1 w-5 h-5 bg-schemes-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="removeImage(index)"
                >
                  <img
                    class="w-3 h-3"
                    :src="closeIcon"
                    alt="Remove"
                  >
                </button>
                <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">
                  {{ image.name }}
                </div>
              </div>
            </div>
            <div class="text-center text-xs text-schemes-on-surface-variant mt-2">
              {{ uploadedImages.length }} 张图片
            </div>
          </div>

          <!-- Loading State -->
          <div
            v-else-if="isImageUploading"
            class="flex flex-col items-center justify-center gap-3"
          >
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-schemes-primary" />
            <div class="text-schemes-primary text-center font-m3-body-medium-font-family">
              正在加载图片...
            </div>
          </div>

          <!-- Upload Prompt -->
          <div
            v-else
            class="flex flex-col items-center justify-center gap-2"
            :class="multipleImages ? 'p-4' : ''"
          >
            <span v-if="uiStore.skin === 'animal-island'" class="island-upload-index" aria-hidden="true">主图 / 01</span>
            <span v-if="uiStore.skin === 'animal-island'" class="island-upload-glyph" aria-hidden="true"><IslandIcon name="Upload" :size="29" /></span>
            <img
              v-else
              class="shrink-0 w-5 h-5 relative overflow-visible"
              :src="uploadIcon"
              alt="Upload"
            >
            <div class="text-schemes-primary text-center font-m3-body-large-emphasized-font-family text-m3-body-large-emphasized-font-size leading-m3-body-large-emphasized-line-height font-m3-body-large-emphasized-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-large-emphasized">
              {{ imageUploadTitle }}
            </div>
            <div class="text-schemes-outline text-center font-m3-body-small-font-family text-m3-body-small-font-size leading-m3-body-small-line-height font-m3-body-small-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-small">
              {{ imageUploadSubtitle }}
            </div>
          </div>
        </component>

        <!-- Upload Reference Area -->
        <component :is="uiStore.skin === 'animal-island' ? IslandCard : 'div'"
          v-bind="uiStore.skin === 'animal-island' ? { type: 'dashed', pattern: 'default' } : {}"
          v-if="showReferenceUpload && currentActionMode.id !== 'generate'"
          class="island-upload-card island-reference-card bg-schemes-surface-container rounded-lg flex flex-col gap-0 items-center justify-center w-[265px] overflow-hidden cursor-pointer transition-colors duration-200 relative"
          :class="[
            multipleReferences ? 'min-h-[182px]' : 'h-[182px]',
            isDragOverReference ? 'bg-schemes-surface-container-high' : ''
          ]"
          @drop="handleReferenceDrop"
          @dragover.prevent
          @dragenter="isDragOverReference = true"
          @dragleave="isDragOverReference = false"
          role="button" tabindex="0" aria-label="上传参考图片" @keydown.enter.self.prevent="triggerReferenceUpload" @keydown.space.self.prevent="triggerReferenceUpload" @click="triggerReferenceUpload"
        >
          <input
            ref="referenceInput"
            type="file"
            accept="image/*"
            :multiple="multipleReferences"
            class="hidden"
            @change="handleReferenceFileSelect"
          >
          <button
            v-if="!multipleReferences"
            class="absolute top-1 left-1 h-6 px-2 rounded-full flex items-center justify-center transition-colors z-10"
            :class="cktjx === 'true' ? 'bg-schemes-primary-container text-white' : 'bg-schemes-surface-container-high text-schemes-on-surface-variant hover:bg-schemes-surface-container'"
            title="参考图镜像"
            @click.stop="toggleReferenceMirror"
          >
            <span class="text-xs font-m3-label-medium-font-family font-m3-label-medium-font-weight letter-spacing-m3-label-medium">
              镜像
            </span>
          </button>

          <!-- Single Reference Preview -->
          <div
            v-if="!multipleReferences && uploadedReference"
            class="w-full h-full relative"
          >
            <img
              :src="uploadedReference.preview"
              :alt="uploadedReference.name"
              class="w-full h-full object-cover rounded-lg"
              :style="{ transform: cktjx === 'true' ? 'scaleX(-1)' : 'none' }"
            >
            <!-- Overlay with image info -->
            <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 rounded-lg">
              <div class="text-white text-xs font-medium truncate">
                {{ uploadedReference.name }}
              </div>
              <!-- <div class="text-white text-xs opacity-75">{{ formatFileSize(uploadedReference.size) }}</div> -->
            </div>
            <!-- Clear reference button -->
            <button
              class="absolute top-1 right-1 w-5 h-5 bg-schemes-surface-container-high rounded-full flex items-center justify-center hover:bg-schemes-surface-container transition-colors"
              title="清空参考图"
              @click.stop="clearReference"
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

          <!-- Multiple References Preview -->
          <div
            v-else-if="multipleReferences && uploadedReferences.length"
            class="w-full p-2"
          >
            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="(reference, index) in uploadedReferences"
                :key="index"
                class="relative group"
              >
                <img
                  :src="reference.preview"
                  :alt="reference.name"
                  class="w-full h-20 object-cover rounded-lg"
                  :style="{ transform: cktjx === 'true' ? 'scaleX(-1)' : 'none' }"
                >
                <button
                  class="absolute -top-1 -right-1 w-5 h-5 bg-schemes-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="removeReference(index)"
                >
                  <img
                    class="w-3 h-3"
                    :src="closeIcon"
                    alt="Remove"
                  >
                </button>
                <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">
                  {{ reference.name }}
                </div>
              </div>
            </div>
            <div class="text-center text-xs text-schemes-on-surface-variant mt-2">
              {{ uploadedReferences.length }} 张参考图
            </div>
          </div>

          <!-- Reference Loading State -->
          <div
            v-else-if="isReferenceUploading"
            class="flex flex-col items-center justify-center gap-3"
          >
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-schemes-primary" />
            <div class="text-schemes-primary text-center font-m3-body-medium-font-family">
              正在加载参考图片...
            </div>
          </div>

          <!-- Reference Upload Prompt -->
          <div
            v-else
            class="flex flex-col items-center gap-2"
            :class="multipleReferences ? 'p-4' : ''"
          >
            <span v-if="uiStore.skin === 'animal-island'" class="island-upload-index" aria-hidden="true">参考 / 02</span>
            <span v-if="uiStore.skin === 'animal-island'" class="island-upload-glyph" aria-hidden="true"><IslandIcon name="Image" :size="28" /></span>
            <img
              v-else
              class="shrink-0 w-5 h-5 relative overflow-visible"
              :src="referenceIcon"
              alt="Reference"
            >
            <div class="text-schemes-primary text-center font-m3-body-large-emphasized-font-family text-m3-body-large-emphasized-font-size leading-m3-body-large-emphasized-line-height font-m3-body-large-emphasized-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-large-emphasized">
              {{ referenceUploadTitle }}
            </div>
            <div class="text-schemes-outline text-center font-m3-body-small-font-family text-m3-body-small-font-size leading-m3-body-small-line-height font-m3-body-small-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-small">
              {{ referenceUploadSubtitle }}
            </div>
          </div>
        </component>
        <div v-if="showRandomSeed && !showAdvancedParams" class="flex flex-col gap-1.5 w-[265px] py-2">
          <div class="flex justify-between items-center">
            <label class="text-schemes-on-surface-variant text-xs font-medium">
              随机种子
            </label>
            <button
              class="text-xs text-schemes-primary hover:text-white transition-colors flex items-center gap-1"
              @click="generateRandomSeed"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              随机
            </button>
          </div>
          <div class="relative group">
            <input
              id="workspace-seed" aria-label="随机种子" v-model="randomSeed"
              type="text"
              class="w-full bg-schemes-surface-container text-schemes-outline text-sm rounded-lg px-3 py-2.5 outline-none border border-transparent focus:border-schemes-primary transition-all font-mono tracking-wide"
              placeholder="输入种子..."
              @blur="changeseed"
            >
          </div>
        </div>

        <!-- Advanced Parameters Header -->
        <button 
          v-if="showAdvancedParams"
          class="island-parameter-heading flex flex-row items-center justify-between w-[265px] group focus:outline-none py-2"
          @click.stop="toggleAdvancedOpen"
        >
          <span v-if="uiStore.skin === 'animal-island'" class="island-parameter-title">高级参数 <small>可选</small></span>
          <div v-else class="text-schemes-primary-container font-medium text-sm flex items-center gap-2">
            高级参数
          </div>
          <div 
            class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-schemes-surface-container-high text-schemes-on-surface-variant group-hover:text-schemes-primary-container transition-colors"
          >
            <div
              class="w-4 h-4 transition-transform duration-200 bg-current opacity-60 group-hover:opacity-100"
              :class="advancedOpen ? 'rotate-180' : ''"
              :style="{ 
                maskImage: `url(${dropdownIcon})`, 
                maskSize: 'contain', 
                maskRepeat: 'no-repeat', 
                maskPosition: 'center', 
                WebkitMaskImage: `url(${dropdownIcon})`, 
                WebkitMaskSize: 'contain', 
                WebkitMaskRepeat: 'no-repeat', 
                WebkitMaskPosition: 'center' 
              }"
            ></div>
          </div>
        </button>

        <!-- Divider below header - only visible when expanded -->
        <div v-if="showAdvancedParams" class="w-[265px] border-t border-schemes-outline-variant/50 -mt-2 mb-4"></div>

        <transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform -translate-y-2 opacity-0"
          enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform -translate-y-2 opacity-0"
        >
          <div v-if="showAdvancedParams && advancedOpen" class="island-parameter-card flex flex-col gap-5 w-[265px]">
            
            <!-- Random Seed -->
            <div v-if="showRandomSeed" class="space-y-1.5">
              <div class="flex justify-between items-center">
                <label class="text-schemes-on-surface-variant text-xs font-medium">
                  随机种子
                </label>
                <button
                  class="text-xs text-schemes-primary hover:text-white transition-colors flex items-center gap-1"
                  @click="generateRandomSeed"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  随机
                </button>
              </div>
              <div class="relative group">
                <input
                  id="workspace-seed" aria-label="随机种子" v-model="randomSeed"
                  type="text"
                  class="w-full bg-schemes-surface-container text-schemes-outline text-sm rounded-lg px-3 py-2.5 outline-none border border-transparent focus:border-schemes-primary transition-all font-mono tracking-wide"
                  placeholder="输入种子..."
                  @blur="changeseed"
                >
              </div>
            </div>

            <div v-if="showReferenceStrength && currentActionMode.id !== 'generate'" class="space-y-1.5">
              <div class="flex justify-between items-center mb-1">
                <label class="text-schemes-on-surface-variant text-xs font-medium">
                  参考图匹配
                </label>
                <component :is="uiStore.skin === 'animal-island' ? IslandTag : 'span'"
                  v-bind="uiStore.skin === 'animal-island' ? { size: 'small', variant: 'soft' } : {}"
                  :class="uiStore.skin === 'animal-island' ? 'island-parameter-value' : 'text-xs bg-schemes-surface-container-high px-1.5 py-0.5 rounded text-schemes-on-surface-variant'">{{ referenceStrengthLabel }}</component>
              </div>
              <Slider
                v-model="referenceStrength"
                :min="0"
                :max="1"
                :step="0.01"
                :show-value="false"
                :show-progress="true"
                @change="validateReferenceStrength"
              />
            </div>

            <div v-if="showColorMatchStrength && currentActionMode.id !== 'generate'" class="space-y-1.5">
              <div class="flex justify-between items-center mb-1">
                <label class="text-schemes-on-surface-variant text-xs font-medium">
                  颜色匹配
                </label>
                <component :is="uiStore.skin === 'animal-island' ? IslandTag : 'span'"
                  v-bind="uiStore.skin === 'animal-island' ? { size: 'small', variant: 'soft' } : {}"
                  :class="uiStore.skin === 'animal-island' ? 'island-parameter-value' : 'text-xs bg-schemes-surface-container-high px-1.5 py-0.5 rounded text-schemes-on-surface-variant'">{{ colorMatchStrengthLabel }}</component>
              </div>
              <Slider
                v-model="colorMatchStrength"
                :min="0"
                :max="1"
                :step="0.01"
                :show-value="false"
                :show-progress="true"
                @change="validateColorMatchStrength"
              />
            </div>

            <!-- Add Scene Toggle -->
            <div v-if="showAddScene && currentActionMode.id !== 'generate'" class="flex items-center justify-between py-1">
              <label class="text-schemes-on-surface-variant text-sm font-medium">
                添加配景
              </label>
              <IslandSwitch v-if="uiStore.skin === 'animal-island'" v-model="addScene" aria-label="添加配景" size="small" />
              <label v-else class="relative inline-flex items-center cursor-pointer">
                <input 
                  id="workspace-scene" aria-label="添加配景" v-model="addScene"
                  type="checkbox" 
                  class="sr-only peer"
                >
                <div class="w-9 h-5 bg-schemes-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-schemes-outline after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-schemes-primary-container peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>

            <!-- Output Size -->
            <div v-if="showOutputSize && currentActionMode.id === 'generate'" class="space-y-1.5">
              <div class="flex justify-between items-center">
                <label class="text-schemes-on-surface-variant text-xs font-medium">
                  输出尺寸
                </label>
                <span class="text-xs text-schemes-outline">{{ outputSize }}px</span>
              </div>
              <div class="relative group">
                <input
                  id="workspace-output-size" aria-label="输出尺寸" v-model.number="outputSize"
                  type="number"
                  min="2536"
                  max="6500"
                  step="64"
                  class="w-full bg-schemes-surface-container text-schemes-outline text-sm rounded-lg px-3 py-2.5 outline-none border border-transparent focus:border-schemes-primary transition-all"
                  placeholder="2536 - 6500"
                  @blur="validateOutputSize"
                >
              </div>
            </div>

            <!-- Redraw Strength -->
            <div v-if="showRedraw && currentActionMode.id === 'generate'" class="space-y-1.5">
              <div class="flex justify-between items-center mb-1">
                <label class="text-schemes-on-surface-variant text-xs font-medium">
                  重绘幅度
                </label>
                <component :is="uiStore.skin === 'animal-island' ? IslandTag : 'span'"
                  v-bind="uiStore.skin === 'animal-island' ? { size: 'small', variant: 'soft' } : {}"
                  :class="uiStore.skin === 'animal-island' ? 'island-parameter-value' : 'text-xs bg-schemes-surface-container-high px-1.5 py-0.5 rounded text-schemes-on-surface-variant'">{{ redraw }}</component>
              </div>
              <Slider
                v-model="redraw"
                :min="0"
                :max="0.4"
                :step="0.01"
                :show-value="false"
                :show-progress="true"
                @change="validateRedrawSize"
              />
            </div>

          </div>
        </transition>

        <div v-if="showAdvancedParams && advancedOpen" class="border-t border-schemes-outline-variant/50 w-[265px] my-2"></div>


        <slot name="extra-controls"></slot>
        <!-- Prompt Input -->
        <div v-if="showPromptInput && currentActionMode.id !== 'generate'" class="w-[265px] space-y-2">
          <label class="text-schemes-on-surface-variant text-sm font-medium pl-1">
            {{ promptLabel }}
          </label>
          <div
            class="bg-schemes-surface-container rounded-xl p-3 flex flex-row gap-1 items-start justify-center w-full h-[137px] border border-transparent focus-within:border-schemes-primary/50 focus-within:ring-1 focus-within:ring-schemes-primary/50 transition-all duration-200"
          >
            <textarea
              id="workspace-prompt" :aria-label="promptLabel" v-model="promptText"
              class="text-schemes-on-surface text-sm leading-relaxed relative flex-1 h-full resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 placeholder-schemes-outline"
              placeholder="在此输入提示词..."
              @input="handlePromptChange"
            />
          </div>
        </div>
        <!-- <div class="space-y-3">
      <RadioGroup v-model="referenceMode">
        <div class="grid grid-cols-2 gap-3">
          <RadioGroupOption
            v-for="option in referenceModeOptions"
            :key="option.value"
            :value="option.value"
            v-slot="{ checked }"
          >
            <div class="flex items-center cursor-pointer">
              <div
                class="w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 transition-colors"
                :class="checked ? 'border-schemes-primary' : 'border-schemes-outline'"
              >
                <div
                  v-if="checked"
                  class="w-2 h-2 rounded-full bg-schemes-primary"
                ></div>
              </div>
              <span class="text-schemes-on-surface text-sm font-m3-body-medium-font-family">{{ option.label }}</span>
            </div>
          </RadioGroupOption>
        </div>
      </RadioGroup>
      </div> -->
    
        <!-- Advanced Parameters (conditional) -->
        <!-- <div v-if="showAdvancedParams" class="w-[265px]">
      <Disclosure v-slot="{ open }">
        <DisclosureButton class="flex items-center justify-between cursor-pointer w-full focus:outline-none">
          <div class="text-schemes-primary-container text-left font-m3-body-large-emphasized-font-family text-m3-body-large-emphasized-font-size leading-m3-body-large-emphasized-line-height font-m3-body-large-emphasized-font-weight letter-spacing-m3-body-large-emphasized">
            高级参数
          </div>
          <img
            class="w-[30px] h-[30px] transition-transform duration-200"
            :class="{ 'rotate-180': open }"
            :src="dropdownIcon"
            alt="Dropdown"
          />
        </DisclosureButton>

        <transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <DisclosurePanel class="mt-4">
            <AdvancedParameters @parameters-change="handleAdvancedParametersChange" />
          </DisclosurePanel>
        </transition>
      </Disclosure>
    </div> -->

        <!-- <div class="border-solid border-schemes-outline-variant border-t w-[265px] h-0 my-4"></div>
    <div v-if="multipleImages && multipleReferences && uploadedImages.length && uploadedReferences.length" class="text-xs text-schemes-on-surface-variant text-center">
      将生成 {{ uploadedImages.length }} × {{ uploadedReferences.length }} = {{ uploadedImages.length * uploadedReferences.length }} 张图片
    </div> -->
      </div>
    </div>
    <div class="island-action-dock shrink-0 m-4 mt-4">
      <p v-if="uiStore.skin === 'animal-island'" id="workspace-action-hint" class="island-action-hint" role="status">{{ islandActionHint }}</p>
      <div class="island-action-row w-[265px] flex flex-row gap-3 items-center justify-between">
          <div class="island-action-primary flex-1 h-10 relative">
            <HMenu as="div" class="primary-action-group rounded-2xl flex flex-row items-center justify-center w-full h-full relative" :class="{ 'action-disabled': isPrimaryActionDisabled }">
              <component :is="uiStore.skin === 'animal-island' ? IslandButton : 'button'"
                v-bind="uiStore.skin === 'animal-island' ? { type: 'primary', htmlType: 'button' } : {}"
                class="primary-button flex-1 h-10 min-w-0"
                :class="showActionDropdown ? 'rounded-r-none' : ''"
                :disabled="isPrimaryActionDisabled"
                data-testid="primary-action-button"
                :aria-describedby="uiStore.skin === 'animal-island' ? 'workspace-action-hint' : undefined"
                :data-mode="mode"
                @click="handlePrimaryAction"
              >
                <div class="pt-2.5 pr-2.5 pb-2.5 pl-3 flex flex-row gap-1 items-center justify-start flex-1 relative">
                  <IslandIcon v-if="uiStore.skin === 'animal-island'" :name="currentActionMode.id === 'preview' ? 'Eye' : 'Search'" :size="18" aria-hidden="true" />
                  <div class="button-text-primary letter-spacing-m3-title-medium-emphasized truncate">
                    {{ primaryActionText }}
                  </div>
                </div>
              </component>

              <HMenuButton
                v-if="showActionDropdown"
                class="bg-primary-container rounded-r-xl rounded-l-none flex flex-col gap-0 items-center justify-center shrink-0 w-[30px] relative overflow-hidden border-l border-on-primary-container/10"
                :disabled="previewUpscaleRunState !== 'idle' || submitting"
                aria-label="选择预览或放大"
                data-testid="primary-action-dropdown"
              >
                <div class="pt-[5px] pr-3.5 pb-[5px] pl-3 flex flex-row gap-2 items-center justify-center shrink-0 w-12 h-10 relative">
                  <img
                    class="shrink-0 w-[22px] h-[22px] relative overflow-visible transform scale-y-[-1]"
                    :src="generateDropdownIcon"
                    alt="Action Options"
                  />
                </div>
              </HMenuButton>

              <transition
                v-if="showActionDropdown"
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <HMenuItems class="absolute bottom-full left-0 mb-2 w-[140px] bg-schemes-surface-container-high rounded-xl shadow-lg border border-schemes-outline-variant z-50 focus:outline-none">
                  <HMenuItem v-for="m in actionModes" :key="m.id" v-slot="{ active }">
                    <button
                      :class="[
                        'group flex w-full items-center px-4 py-3 text-left transition-colors duration-200 rounded-xl',
                        active ? 'bg-schemes-surface-container' : '',
                        currentActionMode.id === m.id ? 'bg-schemes-primary-container' : ''
                      ]"
                      @click.stop="selectActionMode(m)"
                    >
                      <span
                        :class="[
                          'text-schemes-on-surface-variant font-m3-body-medium-font-family text-m3-body-medium-font-size leading-m3-body-medium-line-height font-m3-body-medium-font-weight letter-spacing-m3-body-medium',
                          currentActionMode.id === m.id ? 'text-schemes-on-primary-container font-semibold' : ''
                        ]"
                      >
                        {{ m.name }}
                      </span>
                    </button>
                  </HMenuItem>
                </HMenuItems>
              </transition>
            </HMenu>
          </div>

          <component :is="uiStore.skin === 'animal-island' ? IslandButton : 'button'"
            v-bind="uiStore.skin === 'animal-island' ? { type: 'text', htmlType: 'button' } : {}"
            class="secondary-button flex-1 h-10"
            :disabled="isCancelDisabled"
            data-testid="cancel-button"
            :data-mode="mode"
            @click.stop="selectGenerateMode({ id: 'cancel' })"
          >
            <div class="pt-2.5 pr-2.5 pb-2.5 pl-3 flex flex-row gap-1 items-center justify-center flex-1 relative">
              <div class="button-text-secondary letter-spacing-m3-title-medium-emphasized">
                {{ cancelActionText }}
              </div>
            </div>
          </component>

          <!-- <div v-if="!showBrushButton" class="flex-1 h-10 relative"> -->
          <!-- <div v-if="!showBrushButton&& selectedTabIndex==0" class="flex-1 h-10 relative ">
        <Menu as="div" class="rounded-2xl flex flex-row items-center justify-center w-full h-full relative">
          <Popover class="relative">
            <PopoverButton
              as="button"
              class="primary-button w-[265px] h-10"
              @click="handlePreview"
              @mouseenter="showTooltip = true"
              @mouseleave="showTooltip = false"
              :disabled="!canGenerate"
              data-testid="generate-button"
              :data-mode="mode"
            >
            
              <div class="pt-2.5 pr-2.5 pb-2.5 pl-3 flex flex-row gap-1 items-center justify-start flex-1 relative">
                <div class="button-text-primary letter-spacing-m3-title-medium-emphasized">
                  预览
                </div>
              </div>
            </PopoverButton>

          </Popover>

          <Popover class="relative">
            <PopoverButton
              as="div"
              @mouseenter="showDropdownTooltip = true"
              @mouseleave="showDropdownTooltip = false"
            >
              <MenuButton class="bg-primary-container rounded-tl rounded-tr-xl rounded-br-xl rounded-bl flex flex-col gap-0 items-center justify-center shrink-0 w-[30px] relative overflow-hidden ml-[-8px]">
                <div class="pt-[5px] pr-3.5 pb-[5px] pl-3 flex flex-row gap-2 items-center justify-center shrink-0 w-12 h-10 relative">
                  <img
                    class="shrink-0 w-[22px] h-[22px] relative overflow-visible transform scale-y-[-1]"
                    :src="generateDropdownIcon"
                    alt="Generate Options"
                  />
                </div>
              </MenuButton>
            </PopoverButton>

          </Popover>

          <transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems class="absolute top-[-40px] right-0 w-[140px] bg-schemes-surface-container-high rounded-xl shadow-lg border border-schemes-outline-variant z-50 focus:outline-none">
              <MenuItem
                v-for="mode in generateModes"
                :key="mode.id"
                v-slot="{ active }"
              >
                <button
                  :class="[
                    'group flex w-full items-center px-4 py-3 text-left transition-colors duration-200 rounded-xl',
                    active ? 'bg-schemes-surface-container ' : '',
                    currentGenerateMode.id === mode.id ? 'bg-schemes-primary-container' : ''
                  ]"
                  @click.stop="selectGenerateMode(mode)"
                >
                  <span
                    :class="[
                      'text-schemes-on-surface-variant font-m3-body-medium-font-family text-m3-body-medium-font-size leading-m3-body-medium-line-height font-m3-body-medium-font-weight letter-spacing-m3-body-medium',
                      currentGenerateMode.id === mode.id ? 'text-schemes-on-primary-container font-semibold' : ''
                    ]"
                  >
                    {{ mode.name }}
                  </span>
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
      </div>
      <div v-if="!showBrushButton&& selectedTabIndex==1" class="flex-1 h-10 relative ">
        <Menu as="div" class="rounded-2xl flex flex-row items-center justify-center w-full h-full relative">
          <Popover class="relative">
            <PopoverButton
              as="button"
              class="primary-button w-[265px] h-10"
              @click="handleGenerate"
              @mouseenter="showTooltip = true"
              @mouseleave="showTooltip = false"
              :disabled="!canGenerate"
              data-testid="generate-button"
              :data-mode="mode"
            >
              <div class="pt-2.5 pr-2.5 pb-2.5 pl-3 flex flex-row gap-1 items-center justify-start flex-1 relative">
                <div class="button-text-primary letter-spacing-m3-title-medium-emphasized">
                  生成
                </div>
              </div>
            </PopoverButton>

          </Popover>

          <Popover class="relative">
            <PopoverButton
              as="div"
              @mouseenter="showDropdownTooltip = true"
              @mouseleave="showDropdownTooltip = false"
            >
              <MenuButton class="bg-primary-container rounded-tl rounded-tr-xl rounded-br-xl rounded-bl flex flex-col gap-0 items-center justify-center shrink-0 w-[30px] relative overflow-hidden ml-[-8px]">
                <div class="pt-[5px] pr-3.5 pb-[5px] pl-3 flex flex-row gap-2 items-center justify-center shrink-0 w-12 h-10 relative">
                  <img
                    class="shrink-0 w-[22px] h-[22px] relative overflow-visible transform scale-y-[-1]"
                    :src="generateDropdownIcon"
                    alt="Generate Options"
                  />
                </div>
              </MenuButton>
            </PopoverButton>

          </Popover>

          <transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems class="absolute top-[-40px] right-0 w-[140px] bg-schemes-surface-container-high rounded-xl shadow-lg border border-schemes-outline-variant z-50 focus:outline-none">
              <MenuItem
                v-for="mode in generateModes"
                :key="mode.id"
                v-slot="{ active }"
              >
                <button
                  :class="[
                    'group flex w-full items-center px-4 py-3 text-left transition-colors duration-200 rounded-xl',
                    active ? 'bg-schemes-surface-container' : '',
                    currentGenerateMode.id === mode.id ? 'bg-schemes-primary-container' : ''
                  ]"
                  @click.stop="selectGenerateMode(mode)"
                >
                  <span
                    :class="[
                      'text-schemes-on-surface-variant font-m3-body-medium-font-family text-m3-body-medium-font-size leading-m3-body-medium-line-height font-m3-body-medium-font-weight letter-spacing-m3-body-medium',
                      currentGenerateMode.id === mode.id ? 'text-schemes-on-primary-container font-semibold' : ''
                    ]"
                  >
                    {{ mode.name }}
                  </span>
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
      </div> -->

          <!-- Simple Generate Button for local-repaint mode only -->
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Menu as HMenu, MenuButton as HMenuButton, MenuItems as HMenuItems, MenuItem as HMenuItem } from '@headlessui/vue'
import Slider from './ui/Slider.vue'
import { Card as IslandCard, Icon as IslandIcon, Switch as IslandSwitch, Button as IslandButton, Tag as IslandTag } from 'animal-island-vue'
import { useImageStore, useJobStore, useAssetStore, useUIStore,useXMStore } from '../stores'
import { icons } from '../utils/assets.js'
import { success, error } from '../utils/toast.js'


export default {
  name: 'UnifiedSidebar',
  components: {
    HMenu,
    HMenuButton,
    HMenuItems,
    HMenuItem,
    IslandCard,
    IslandButton,
    IslandTag,
    IslandIcon,
    IslandSwitch,
    Slider
  },
  props: {
    // Mode configuration
    mode: {
      type: String,
      default: 'workspace',
      validator: (value) => ['workspace', 'batch-preview', 'local-repaint'].includes(value)
    },
    multipleImages: {
      type: Boolean,
      default: false
    },
    multipleReferences: {
      type: Boolean,
      default: false
    },
    showAdvancedParams: {
      type: Boolean,
      default: true
    },
    showBrushButton: {
      type: Boolean,
      default: true
    },
    showActionDropdown: {
      type: Boolean,
      default: true
    },
    showReferenceUpload: {
      type: Boolean,
      default: true
    },
    showPromptInput: {
      type: Boolean,
      default: true
    },
    showRandomSeed: {
      type: Boolean,
      default: true
    },
    showReferenceStrength: {
      type: Boolean,
      default: true
    },
    showColorMatchStrength: {
      type: Boolean,
      default: true
    },
    showAddScene: {
      type: Boolean,
      default: true
    },
    showOutputSize: {
      type: Boolean,
      default: true
    },
    showRedraw: {
      type: Boolean,
      default: true
    },
    promptLabel: {
      type: String,
      default: '提示词'
    },
    defaultPromptText: {
      type: String,
      default: ''
    },
    primaryActionLabel: {
      type: String,
      default: ''
    },
    
    // Text customization
    imageUploadTitle: {
      type: String,
      default: '待处理图片'
    },
    imageUploadSubtitle: {
      type: String,
      default: '将图像拖到这里上传\n或 点我选择图片'
    },
    referenceUploadTitle: {
      type: String,
      default: '参考图片'
    },
    referenceUploadSubtitle: {
      type: String,
      default: '将图像拖到这里上传\n或 点我选择图片'
    },
    generateButtonText: {
      type: String,
      default: '生成'
    },
    
    // External data
    externalReferenceImage: {
      type: Object,
      default: null
    },
    baseImageWithMask: {
      type: String,
      default: null
    },
    maskImage: {
      type: String,
      default: null
    },
    submitting: { type: Boolean, default: false },
    engineReady: { type: Boolean, default: true },
    previewUpscaleRunState: {
      type: String,
      default: 'idle'
    }
  },
  emits: [
    'action-mode-change',
    'upload-image', 'upload-images', 'upload-reference', 'upload-references',
    'clear-image', 'clear-images', 'clear-reference', 'clear-references',
    'prompt-change', 'generate', 'preview', 'open-mask-editor', 'cancel-rw'
  ],
  setup(props, { emit }) {
    const xm = useXMStore()
    // 表单数据
    const outputSize = ref(Number(xm.size) || 4096)

    const redraw = ref(Number(xm.chfd) || 0)
    const cktjx = ref(String(xm.jx) === 'true' ? 'true' : 'false')
    const referenceStrength = ref(Number(xm.referenceStrength ?? 1))
    const referenceStrengthLabel = computed(() => Number(referenceStrength.value).toFixed(2))
    const colorMatchStrength = ref(Number(xm.colorMatchStrength ?? 0.285403))
    const colorMatchStrengthLabel = computed(() => Number(colorMatchStrength.value).toFixed(2))

    // 随机种子码
    const randomSeed = ref(xm.seed);

    // 生成随机种子
    const generateRandomSeed = () => {
      randomSeed.value = Math.floor(Math.random() * 1000000000000000).toString()
      changeseed();
    }
    // 保存种子
    const changeseed = ()=>{
      xm.saveseed(randomSeed.value)
    }
    const addScene = ref(Boolean(xm.addScene ?? true))
    const advancedOpen = ref(true)
    const toggleAdvancedOpen = () => {
      advancedOpen.value = !advancedOpen.value
    }
    watch(addScene, (value) => {
      xm.saveAddScene(Boolean(value))
    }, { immediate: true })
    const toggleReferenceMirror = () => {
      cktjx.value = cktjx.value === 'true' ? 'false' : 'true'
      xm.savejx(cktjx.value)
    }

    // 验证重绘大小
    const validateRedrawSize = ()=>{
      const clamped = Math.min(0.4, Math.max(0, Number(redraw.value)))
      redraw.value = Number(clamped.toFixed(2))
      xm.savechsize(redraw.value)
    }

    const validateReferenceStrength = () => {
      if (referenceStrength.value < 0) {
        referenceStrength.value = 0
      } else if (referenceStrength.value > 1) {
        referenceStrength.value = 1
      } else {
        referenceStrength.value = Number(Number(referenceStrength.value).toFixed(2))
      }
      xm.saveReferenceStrength(referenceStrength.value)
    }

    const validateColorMatchStrength = () => {
      if (colorMatchStrength.value < 0) {
        colorMatchStrength.value = 0
      } else if (colorMatchStrength.value > 1) {
        colorMatchStrength.value = 1
      } else {
        colorMatchStrength.value = Number(Number(colorMatchStrength.value).toFixed(2))
      }
      xm.saveColorMatchStrength(colorMatchStrength.value)
    }

    // 验证输出尺寸
    const validateOutputSize = () => {
      if (outputSize.value < 2536) {
        outputSize.value = 2536
      } else if (outputSize.value > 6300) {
        outputSize.value = 6300
      }
      // 确保是64的倍数
      // outputSize.value = Math.round(outputSize.value / 64) * 64
      xm.savesize(outputSize.value)
    }

    // Stores
    const imageStore = useImageStore()
    const jobStore = useJobStore()
    const assetStore = useAssetStore()
    const uiStore = useUIStore()

    // Store 响应式数据
    const {
      uploadedImageFile,
      uploadedReferenceFile,
      uploadedImages,
      uploadedReferences,
      currentMode
    } = storeToRefs(imageStore)
    const { floorplanFile, styleFile } = storeToRefs(assetStore)
    const { prompt } = storeToRefs(jobStore)

    // 设置当前模式
    if (props.multipleImages || props.multipleReferences) {
      imageStore.setMode('batch')
    } else {
      imageStore.setMode('single')
    }

    const isDragOverImage = ref(false)
    const isDragOverReference = ref(false)
    const isImageUploading = ref(false)
    const isReferenceUploading = ref(false)
    const promptText = ref(String(prompt.value || xm.tsc || props.defaultPromptText || ''))

    const imageInput = ref(null)

    const referenceInput = ref(null)

    // Advanced parameters state
    const advancedParameters = ref({})
    const advancedParameterFiles = ref({})

    // 计算属性 - 使用全局状态
    const uploadedImage = computed(() => uploadedImageFile.value)
    const uploadedReference = computed(() => uploadedReferenceFile.value)

    // Generate mode state (for workspace mode)
    const showTooltip = ref(false)
    const showDropdownTooltip = ref(false)
    const actionModes = [
      { id: 'preview', name: '预览' },
      { id: 'generate', name: '放大' }
    ]
    const currentActionMode = ref(actionModes[0])
    const currentGenerateMode = ref({ id: 'generate', name: '生成' })



    const generateModes = [
      { id: 'cancel', name: '取消' }
    ]

    // Icons
    const uploadIcon = icons.upload
    const referenceIcon = icons.reference
    const dropdownIcon = icons.dropdown
    const closeIcon = icons.close
    const magicWandIcon = icons.magicWand
    const generateDropdownIcon = icons.generateDropdown

    const canPreview = computed(() => props.engineReady && Boolean(uploadedImage.value) && !isImageUploading.value && !isReferenceUploading.value)
    const canGenerate = canPreview
    const isActionDisabled = computed(() => currentActionMode.value.id === 'preview' ? !canPreview.value : !canGenerate.value)
    const isRunBusy = computed(() => props.previewUpscaleRunState !== 'idle')
    const islandActionHint = computed(() => {
      const action = currentActionMode.value.id === 'generate' ? '放大' : '预览'
      if (props.submitting) return '正在提交，请稍候'
      if (isRunBusy.value) return props.previewUpscaleRunState === 'cancelling' ? '正在取消任务…' : '任务运行中，可用右侧取消'
      if (isImageUploading.value || isReferenceUploading.value) return '正在准备图片…'
      if (!uploadedImage.value) return action === '预览' ? '添加主图与参考图' : '添加需要放大的图片'
      if (action === '预览' && !uploadedReference.value) return '还需要一张风格参考图'
      if (!props.engineReady) return '等待引擎就绪'
      return '素材已就绪'
    })
    const primaryActionText = computed(() => {
      if (props.submitting) return '正在提交…'
      if (props.previewUpscaleRunState === 'cancelling') {
        return '取消中...'
      }
      if (props.previewUpscaleRunState === 'previewing') {
        return currentActionMode.value.id === 'preview' ? `${resolvedPrimaryActionLabel.value}中...` : '预览中'
      }
      if (props.previewUpscaleRunState === 'upscaling') {
        return currentActionMode.value.id === 'generate' ? '放大中...' : '放大中'
      }
      return resolvedPrimaryActionLabel.value
    })
    const resolvedPrimaryActionLabel = computed(() => {
      if (props.primaryActionLabel) {
        return props.primaryActionLabel
      }
      return currentActionMode.value.name
    })
    const cancelActionText = computed(() => props.previewUpscaleRunState === 'cancelling' ? '取消中...' : '取消')
    const isPrimaryActionDisabled = computed(() => isRunBusy.value || isActionDisabled.value)
    const isCancelDisabled = computed(() => props.submitting || props.previewUpscaleRunState === 'idle' || props.previewUpscaleRunState === 'cancelling')

    // Image upload handlers
    const triggerImageUpload = () => {
      imageInput.value?.click()
    }

    // 待处理图片点击
    const handleImageFileSelect = async (event) => {
      const files = Array.from(event.target.files)
      if (files.length) {
        isImageUploading.value = true

        try {
          if (props.multipleImages) {
            imageStore.addImages(files)
            emit('upload-images', files)
          } else {
            emit('upload-image', files[0])
          }

          // success('图片已选择！')
        } catch (error) {
          error('图片处理失败：' + error.message)
        } finally {
          isImageUploading.value = false
        }
      }
    }

    const handleImageDrop = async (event) => {
      event.preventDefault()
      isDragOverImage.value = false
      const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'))
      const getDroppedPayload = () => {
        const dt = event?.dataTransfer
        if (!dt) return null
        const raw = dt.getData('application/x-va-image')
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            if (parsed?.url) return parsed
          } catch (e) {
            return null
          }
        }
        const uriList = dt.getData('text/uri-list')
        if (uriList) {
          const first = uriList
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line && !line.startsWith('#'))
          if (first) return { url: first }
        }
        const text = (dt.getData('text/plain') || '').trim()
        if (text && /^https?:\/\//i.test(text)) return { url: text }
        return null
      }
      const fileFromUrl = async (url, suggestedName) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
        const blob = await response.blob()
        const mime = blob.type || 'image/jpeg'
        const extByMime = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/webp': 'webp',
          'image/gif': 'gif'
        }
        const ext = extByMime[mime] || 'jpg'
        const fromUrl = (() => {
          try {
            const u = new URL(url, window.location.href)
            const name = u.pathname.split('/').pop()
            return name || ''
          } catch (e) {
            return url.split('/').pop() || ''
          }
        })()
        let fileName = (suggestedName || fromUrl || `dropped-image.${ext}`).trim()
        if (!/\.[a-z0-9]+$/i.test(fileName)) fileName = `${fileName}.${ext}`
        const file = new File([blob], fileName, { type: mime })
        file.preview = url
        file.url = url
        return file
      }
      if (files.length) {
        isImageUploading.value = true

        try {
          if (props.multipleImages) {
            // 批量模式 - 添加到全局状态
            imageStore.addImages(files)
            emit('upload-images', files)
          } else {
            emit('upload-image', files[0])
          }

          // success('图片已选择！')
        } catch (error) {
          error('图片处理失败：' + error.message)
        } finally {
          isImageUploading.value = false
        }
      }
      if (!files.length) {
        const payload = getDroppedPayload()
        if (!payload?.url) return
        isImageUploading.value = true
        try {
          const file = await fileFromUrl(payload.url, payload.name)
          if (props.multipleImages) {
            imageStore.addImages([file])
            emit('upload-images', [file])
          } else {
            emit('upload-image', file)
          }
        } catch (error) {
          error('图片处理失败：' + error.message)
        } finally {
          isImageUploading.value = false
        }
      }
    }

    // Reference upload handlers
    const triggerReferenceUpload = () => {
      referenceInput.value?.click()
    }

    // 参考图片
    const handleReferenceFileSelect = async (event) => {
      const files = Array.from(event.target.files)
      
      if (files.length) {
        isReferenceUploading.value = true
        try {
          if (props.multipleReferences) {
            // 批量模式 - 添加到全局状态
            imageStore.addReferences(files)
            emit('upload-references', files)
          } else {
            emit('upload-reference', files[0])
          }

          // success('参考图片已选择！')
        } catch (error) {
          error('参考图片处理失败：' + error.message)
        } finally {
          isReferenceUploading.value = false
        }
      }
    }

    const handleReferenceDrop = async (event) => {
      event.preventDefault()
      isDragOverReference.value = false
      const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'))
      const getDroppedPayload = () => {
        const dt = event?.dataTransfer
        if (!dt) return null
        const raw = dt.getData('application/x-va-image')
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            if (parsed?.url) return parsed
          } catch (e) {
            return null
          }
        }
        const uriList = dt.getData('text/uri-list')
        if (uriList) {
          const first = uriList
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line && !line.startsWith('#'))
          if (first) return { url: first }
        }
        const text = (dt.getData('text/plain') || '').trim()
        if (text && /^https?:\/\//i.test(text)) return { url: text }
        return null
      }
      const fileFromUrl = async (url, suggestedName) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
        const blob = await response.blob()
        const mime = blob.type || 'image/jpeg'
        const extByMime = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/webp': 'webp',
          'image/gif': 'gif'
        }
        const ext = extByMime[mime] || 'jpg'
        const fromUrl = (() => {
          try {
            const u = new URL(url, window.location.href)
            const name = u.pathname.split('/').pop()
            return name || ''
          } catch (e) {
            return url.split('/').pop() || ''
          }
        })()
        let fileName = (suggestedName || fromUrl || `dropped-image.${ext}`).trim()
        if (!/\.[a-z0-9]+$/i.test(fileName)) fileName = `${fileName}.${ext}`
        const file = new File([blob], fileName, { type: mime })
        file.preview = url
        file.url = url
        return file
      }
      if (files.length) {
        isReferenceUploading.value = true

        try {
          if (props.multipleReferences) {
            await processMultipleImageFiles(files, 'references')
            emit('upload-references', files)
          } else {
            emit('upload-reference', files[0])
          }

          // success('参考图片已选择！')
        } catch (err) {
          error('参考图片处理失败：' + err.message)
        } finally {
          isReferenceUploading.value = false
        }
      }
      if (!files.length) {
        const payload = getDroppedPayload()
        if (!payload?.url) return
        isReferenceUploading.value = true
        try {
          const file = await fileFromUrl(payload.url, payload.name)
          if (props.multipleReferences) {
            await processMultipleImageFiles([file], 'references')
            emit('upload-references', [file])
          } else {
            emit('upload-reference', file)
          }
        } catch (err) {
          error('参考图片处理失败：' + err.message)
        } finally {
          isReferenceUploading.value = false
        }
      }
    }

    // Clear functions - 使用全局状态
    const clearImage = () => {
      xm.deldcl()
      imageStore.clearImage()
      if (imageInput.value) {
        imageInput.value.value = ''
      }
      emit('clear-image')
    }

    const clearReference = () => {
      xm.delck()

      imageStore.clearReference()
      if (referenceInput.value) {
        referenceInput.value.value = ''
      }
      xm.saveckimgurl('')
      emit('clear-reference')
    }

    const removeImage = (index) => {
      imageStore.removeImage(index)
      if (uploadedImages.value.length === 0) {
        emit('clear-images')
      }
    }

    const removeReference = (index) => {
      uploadedReferences.value.splice(index, 1)
      if (uploadedReferences.value.length === 0) {
        emit('clear-references')
      }
    }

    // Other handlers
    const handlePromptChange = () => {
      emit('prompt-change', promptText.value)
    }

    //  点击生成按钮
    const handleGenerate = () => {
      // alert('生成')
      // const options = {
      //   mode: currentGenerateMode.value,
      //   advancedParameters: advancedParameters.value,
      //   advancedParameterFiles: advancedParameterFiles.value
      // }

      // if (props.multipleImages || props.multipleReferences) {
      //   // Batch mode
      //   emit('generate', {
      //     ...options,
      //     images: uploadedImages.value,
      //     references: uploadedReferences.value,
      //     prompt: promptText.value
      //   })
      // } else {
        // Single mode
        // emit('generate', options)
        emit('generate', {})
      // }
    }

    const cancelthis = async () => { 
      emit('cancel-rw')
    }


    const selectGenerateMode = (mode) => {
      if (isCancelDisabled.value) return
      currentGenerateMode.value = mode
      console.log('Generate mode selected:', mode)
      if(mode.id=='cancel'){
        cancelthis()
      }
    }



    /// 点击预览按钮
    const handlePreview = () => {
      
      // alert('预览')
      if (props.multipleImages || props.multipleReferences) {
        // Batch preview mode - 使用全局状态
        emit('preview', {
          images: imageStore.getCurrentImages(),
          references: imageStore.getCurrentReferences(),
          prompt: promptText.value
        })
      } else {
        // Single preview mode
        emit('preview')
      }
    }

    const selectActionMode = (m) => {
      if (isRunBusy.value) return
      currentActionMode.value = m
      emit('action-mode-change', m.id)
    }

    const handlePrimaryAction = () => {
      if (!props.showActionDropdown) return handleGenerate()
      if (currentActionMode.value.id === 'preview') return handlePreview()
      return handleGenerate()
    }

    const handleAdvancedParametersChange = (data) => {
      advancedParameters.value = data.parameters || data
      advancedParameterFiles.value = data.files || {}
    }

    // Format file size for display
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    // Watch for external reference image changes
    watch(() => props.externalReferenceImage, (newValue) => {
      if (newValue && !props.multipleReferences) {
        void imageStore.setUploadedReferenceFile(newValue)
      }
    }, { immediate: true })
    watch(() => props.defaultPromptText, (nextValue) => {
      const nextText = String(nextValue || '')
      if (promptText.value !== nextText) {
        promptText.value = nextText
      }
      emit('prompt-change', promptText.value)
    })
    watch(prompt, value => { if (promptText.value !== value) promptText.value = String(value || '') })


    return {
      uiStore,
      IslandCard,
      IslandButton,
      IslandTag,
      actionModes,
      currentActionMode,
      isActionDisabled,
      isPrimaryActionDisabled,
      isCancelDisabled,
      primaryActionText,
      islandActionHint,
      cancelActionText,
      selectActionMode,
      handlePrimaryAction,
      toggleReferenceMirror,
      outputSize,
      validateOutputSize,

      isDragOverImage,
      isDragOverReference,
      isImageUploading,
      isReferenceUploading,
      promptText,
      imageInput,
      referenceInput,
      uploadedImage,
      uploadedReference,
      uploadedImages,
      uploadedReferences,
      uploadIcon,
      referenceIcon,
      dropdownIcon,
      closeIcon,
      magicWandIcon,
      generateDropdownIcon,
      showTooltip,
      showDropdownTooltip,
      currentGenerateMode,
      generateModes,

      canPreview,
      canGenerate,
      triggerImageUpload,
      handleImageFileSelect,
      handleImageDrop,
      triggerReferenceUpload,
      handleReferenceFileSelect,
      handleReferenceDrop,
      clearImage,
      clearReference,
      removeImage,
      removeReference,
      handlePromptChange,
      handleGenerate,
      handlePreview,
      handleAdvancedParametersChange,
      selectGenerateMode,
      randomSeed,
      generateRandomSeed,
      advancedOpen,
      toggleAdvancedOpen,
      addScene,
      redraw,
      referenceStrength,
      referenceStrengthLabel,
      colorMatchStrength,
      colorMatchStrengthLabel,
      cktjx,
      changeseed,
      validateRedrawSize,
      validateReferenceStrength,
      validateColorMatchStrength,

      // referenceModeOptions,

      formatFileSize
    }
  }
}
</script>
