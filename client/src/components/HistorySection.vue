<template>
  <!-- History Section - Full width with title and toggle -->
  <div class="w-full mt-4 mb-0">
    <!-- Title and Toggle Header -->
    <div class="flex flex-row gap-[3px] items-start justify-start flex-wrap content-start w-full h-7 mb-2 border-t border-schemes-outline-variant pt-2">
      <!-- History icon (also toggle button) -->
      <button
        type="button"
        class="pod-icon-button pod-icon-md"
        :aria-label="isExpanded ? '收起历史记录' : '展开历史记录'"
        :aria-expanded="isExpanded"
        @click="toggleExpansion"
      >
        <img
          class="shrink-0 w-6 h-6 relative overflow-visible transition-transform duration-300"
          :class="isExpanded ? 'rotate-180' : ''"
          :src="historyIcon"
          alt="Toggle History"
        />
      </button>
      <!-- Title -->
      <div class="text-schemes-on-surface text-left font-m3-title-medium-font-family text-m3-title-medium-font-size leading-m3-title-medium-line-height font-m3-title-medium-font-weight relative flex-1 letter-spacing-m3-title-medium">
        历史记录
      </div>
    </div>
    <div v-if="historyDegraded" class="text-xs text-yellow-500 mb-2">部分历史暂时不可用</div>
    <div v-if="historySyncHint" class="text-xs text-blue-500 mb-2">{{ historySyncHint }}</div>

    <!-- History Content Container -->
    <div
      class="rounded-sm w-full transition-all duration-300 ease-in-out relative overflow-hidden"
      :class="isExpanded ? 'h-[531px]' : 'h-[177px]'"
    >
      <!-- History Images Container with auto-wrap and vertical scroll -->
      <div class="w-full h-full overflow-y-auto pt-3 pb-0">
        <div class="flex flex-wrap gap-3 items-start">
          <div v-if="displayItems.length === 0" class="w-full min-h-40 flex items-center justify-center text-center text-schemes-on-surface-variant text-sm">
            <div>
              <div>暂无历史结果</div>
              <div class="text-xs mt-1">生成或放大图片后，结果会保存在这里</div>
            </div>
          </div>
          <!-- Real history items only -->
          <template v-else>
          <div
            v-for="(item, index) in displayItems"
            :key="item.id || `history-${index}`"
            role="button"
            tabindex="0"
            :aria-label="`历史任务：${getStatusLabel(item)}`"
            class="history-item rounded-xl shrink-0 w-[165px] h-[165px] relative cursor-pointer hover:opacity-90 transition-all overflow-hidden border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-schemes-primary"
            :class="item?.id && item.id === selectedHistoryId ? 'border-schemes-primary' : 'border-transparent'"
            @click="onHistoryClick(item)"
            @dblclick.stop="onHistoryDblClick(item)"
            @keydown.enter.prevent="selectHistoryImage(item)"
            @keydown.space.prevent="selectHistoryImage(item)"
            @contextmenu.prevent.stop="onContextMenu($event, item)"
          >
            <div class="menu">
              <button type="button" class="icon-btn" aria-label="下载图片" @click.stop="downloadImage(item)">
                <div 
                  class="icon-mask"
                  :style="{
                    maskImage: `url(${download})`,
                    WebkitMaskImage: `url(${download})`
                  }"
                ></div>
              </button>
            </div>
            
            <!-- Workflow Type Badge -->
            <div v-if="getWorkflowBadge(item)" class="absolute top-0 left-0 z-40 pointer-events-none">
              <!-- 左上角小三角形状的深色背景 (无透明度, 缩小一半) -->
              <div 
                class="w-0 h-0 border-t-[24px] border-r-[24px] border-t-[#0f0d13] border-r-transparent rounded-tl-xl"
              ></div>
              <!-- 定位在三角中心区域的彩色文字 -->
              <span 
                class="absolute top-[2px] left-[2px] text-[8px] font-bold -rotate-45"
                :style="{ color: getWorkflowBadge(item).color }"
              >{{ getWorkflowBadge(item).text }}</span>
            </div>

            <!-- Completed Image -->
            <img
              v-if="item.status === 'completed' && getImageUrl(item)"
              :src="getImageUrl(item)"
              :alt="`Generated image ${index + 1}`"
              class="w-full h-full object-cover"
              @error="handleImageError"
            />

            <!-- Processing/Queued tasks with blurred background -->
            <div
              v-else
              class="w-full h-full bg-schemes-surface-container flex flex-col items-center justify-center relative"
            >
              <!-- Background image (blurred if available) -->
              <div
                v-if="getInputImageUrl(item)"
                class="absolute inset-0 bg-cover bg-center filter blur-sm opacity-30"
                :style="{ backgroundImage: `url(${getInputImageUrl(item)})` }"
              ></div>

              <!-- Status overlay -->
              <div class="relative z-10 text-center">
                <!-- Progress Ring for Processing -->
                <div
                  v-if="['processing','running'].includes(item.status)"
                  class="relative w-16 h-16 mb-2 mx-auto"
                >
                  <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      class="text-gray-300"
                      stroke="currentColor"
                      stroke-width="2"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      class="text-schemes-primary"
                      stroke="currentColor"
                      stroke-width="2"
                      fill="none"
                      stroke-linecap="round"
                      :stroke-dasharray="`${getDisplayProgress(item)}, 100`"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-schemes-on-surface text-sm font-medium">{{ getDisplayProgress(item) }}%</span>
                  </div>
                </div>

                <!-- Status Icon for other states -->
                <div
                  v-else
                  class="w-12 h-12 mb-2 mx-auto flex items-center justify-center"
                >
                  <!-- Pending/Uploading/Queued: Loading animation -->
                  <div
                    v-if="['pending', 'uploading', 'submitting', 'queued', 'archiving'].includes(item.status)"
                    class="w-8 h-8 border-2 border-schemes-primary border-t-transparent rounded-full animate-spin"
                  ></div>
                  <!-- Failed: Error icon -->
                  <div
                    v-else-if="item.status === 'failed'"
                    class="w-8 h-8 text-red-500 text-2xl"
                  >
                    ❌
                  </div>
                  <!-- Cancelled: Cancel icon -->
                  <div
                    v-else-if="item.status === 'cancelled'"
                    class="w-8 h-8 text-orange-500 text-2xl"
                  >
                    🚫
                  </div>
                  <!-- Unknown status: Question mark -->
                  <div
                    v-else-if="item.status === 'completed'"
                    class="w-8 h-8 text-schemes-tertiary text-2xl"
                  >
                    🖼️
                  </div>
                  <div
                    v-else
                    class="w-8 h-8 text-gray-500 text-2xl"
                  >
                    ❓
                  </div>
                </div>

                <!-- Status Text -->
                <div class="text-schemes-on-surface-variant text-xs text-center px-2">
                  <div class="font-medium">{{ getStatusLabel(item) }}</div>
                  <div v-if="getStageInfo(item)" class="text-xs opacity-80 mt-1">{{ getStageInfo(item) }}</div>
                </div>
                <button
                  v-if="canCancel(item)"
                  type="button"
                  class="mt-2 px-2 py-1 rounded bg-schemes-surface text-schemes-primary text-xs border border-schemes-outline-variant hover:bg-schemes-surface-container"
                  :disabled="isCancelling(item)"
                  @click.stop="cancelQueuedItem(item)"
                >
                  {{ isRunning(item) ? '停止生成' : '取消排队' }}
                </button>
              </div>
            </div>

            <!-- Timestamp -->
            <div
              v-if="item.timestamp || item.createdAt"
              class="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded"
            >
              {{ formatTime(item.timestamp || item.createdAt) }}
            </div>
          </div>
          </template>

        </div>
        <ImageActionsMenu
          :visible="menuVisible"
          :position="menuStyle"
          @close="closeMenu"
          @primary="menuPrimary"
          @secondary="menuSecondary"
          @preview="menuPreview"
          @open-original="menuOpenOriginal"
          @copy="menuCopy"
        />
      </div>
    </div>
  </div>
  <ImagePreviewModal :visible="previewVisible" :image="previewImage" :show-title="false" :return-focus-element="previewReturnFocus" @close="closePreview" @primary="previewPrimary" @secondary="previewSecondary" />
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useJobStore } from '@/stores'
import { useUIStore } from '@/stores/useUIStore.js'
import { icons } from '../utils/assets.js'
import { useImageStore,useXMStore } from '../stores'
import { useImagePreviewMenu } from '@/composables/useImagePreviewMenu.js'
import ImagePreviewModal from './ui/ImagePreviewModal.vue'
import ImageActionsMenu from './ui/ImageActionsMenu.vue'
import { success, error } from '@/utils/toast.js'

export default {
  name: 'HistorySection',
  emits: ['expansion-change','image-select','preview-select'],
  components: { ImagePreviewModal, ImageActionsMenu },
  setup(props, { emit }) {
    // 使用 JobStore
    const jobStore = useJobStore()
    const uiStore = useUIStore()
    const { historyItems, historyDegraded, progressMap, queuePositionMap, historySyncHint } = storeToRefs(jobStore)
    const xm = useXMStore()
    
    const isExpanded = computed({
      get: () => uiStore.isHistoryExpanded,
      set: (value) => uiStore.setHistoryExpanded(value)
    })
    const cancellingSet = ref(new Set())

    // Icons
    const historyIcon = icons.history
    const download = icons.download

    onMounted(async () => {
      await jobStore.startHistoryLiveSync({
        defaultInputUrl: xm.dclimgurl,
        defaultStyleUrl: xm.ckimgurl,
        forceInit: true
      })
    })

    onUnmounted(() => {
      jobStore.stopHistoryLiveSync()
    })

    const displayItems = computed(() => {
      return Array.isArray(historyItems.value) ? historyItems.value : []
    })

    const selectedHistoryId = computed(() => uiStore.selectedHistoryId)

    const selectHistoryImage = (item) => {
      uiStore.setSelectedHistoryId(item?.id || '')

      if (item?.status === 'completed') {
        const urls = jobStore.getOutputUrls(item)
        if (urls.length > 0) {
          emit('preview-select', { urls, item })
        }
      }
    }

    const toggleExpansion = () => {
      isExpanded.value = !isExpanded.value
      console.log('History expanded:', isExpanded.value)
      // 通知父组件展开状态变化
      emit('expansion-change', isExpanded.value)
    }

    // Status text mapping (与 Backend JobStatus 枚举保持一致)
    const getStatusText = (status) => {
      const statusMap = {
        'pending': '待处理',
        'uploading': '上传中',
        'submitting': '提交中',
        'submission_unknown': '提交状态待核对',
        'queued': '排队中',
        'running': '生成中',
        'processing': '生成中',
        'archiving': '写入历史中',
        'completed': '已完成',
        'failed': '失败',
        'cancelled': '已取消'
      }
      return statusMap[status] || `未知状态 (${status})`
    }

    const getDisplayProgress = (item) => {
      const id = item?.id
      if (!id) return 0
      const fromMap = progressMap.value?.[id]
      if (Number.isFinite(Number(fromMap))) return Math.max(0, Math.min(100, Math.round(Number(fromMap))))
      return Math.max(0, Math.min(100, Math.round(Number(item?.progress || 0))))
    }

    const getQueuePosition = (item) => {
      const id = item?.id
      if (!id) return null
      const position = queuePositionMap.value?.[id]
      if (!Number.isFinite(Number(position))) return null
      return Math.max(1, Number(position))
    }

    const getStatusLabel = (item) => {
      const status = item?.status
      if (['running', 'processing'].includes(status)) {
        return `生成中 · 进度 ${getDisplayProgress(item)}%`
      }
      if (status === 'submitting') return '提交中'
      if (status === 'submission_unknown') return '提交状态待核对'
      if (status === 'archiving') {
        return '等待正式归档'
      }
      if (status === 'completed' && !getImageUrl(item)) {
        return '结果缺失'
      }
      if (status === 'queued') {
        const position = getQueuePosition(item)
        return position ? `排队中 · 第${position}位` : '排队中'
      }
      return getStatusText(status)
    }

    const getStageInfo = (item) => {
      if (item?.status === 'submission_unknown') {
        return item?.errorMessage || '请核对本地任务列表后再操作'
      }
      if (item?.status === 'submitting') {
        return item?.stageInfo || '正在提交本地任务'
      }
      if (['running', 'processing'].includes(item?.status)) {
        return item?.stageInfo || '处理中'
      }
      if (item?.status === 'archiving') {
        return item?.stageInfo || '等待稳定输出写入历史'
      }
      if (item?.status === 'completed' && !getImageUrl(item)) {
        return item?.stageInfo || '请刷新历史或重新生成'
      }
      if (item?.status === 'queued') {
        return item?.stageInfo || '等待资源'
      }
      return item?.stageInfo || ''
    }

    const isRunning = (item) => ['running', 'processing'].includes(item?.status)
    const canCancel = (item) => ['queued', 'running', 'processing'].includes(item?.status)
    const isCancelling = (item) => cancellingSet.value.has(item?.id)

    const cancelQueuedItem = async (item) => {
      const jobId = item?.id
      if (!jobId || isCancelling(item)) return
      const nextStart = new Set(cancellingSet.value)
      nextStart.add(jobId)
      cancellingSet.value = nextStart
      try {
        const result = await jobStore.cancelJobById(jobId, '用户取消')
        if (result?.success) {
          success('已取消')
        } else {
          error(`取消失败：${result?.error || '未知错误'}`)
        }
      } catch (e) {
        error(`取消失败：${e?.message || '未知错误'}`)
      } finally {
        const nextEnd = new Set(cancellingSet.value)
        nextEnd.delete(jobId)
        cancellingSet.value = nextEnd
      }
    }

    // Format timestamp
    const formatTime = (timestamp) => {
      if (!timestamp) return ''

      const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp)
      const now = new Date()
      const diff = now - date

      // Less than 1 minute
      if (diff < 60000) {
        return '刚刚'
      }

      // Less than 1 hour
      if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`
      }

      // Less than 1 day
      if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`
      }

      // More than 1 day
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const getWorkflowBadge = (item) => {
      const wid = (item?.workflowId && item.workflowId !== 'unknown') ? item.workflowId : (item?.origin || '')
      const lower = wid.toLowerCase()
      
      // 兼容一些老的无状态/没有正确保存 workflowId 的放大流兜底逻辑
      const isFallbackUpscale = (!wid || wid === 'unknown' || lower === 'comfy-history' || lower === 'degraded-legacy' || lower === 'job') && 
                                item?.output?.resultUrls?.[0]?.includes('upscale')

      // 参考 UI用色标准：
      // EX(扩图): 蓝 --color-blue-500 -> #60A5FA
      // RE(局部重绘): 绿 --color-emerald-500 -> #10b981
      // ED(图像编辑): 紫亮 --color-purple-light -> #C5AEF6
      // UP(放大): 香蕉黄 --color-banana-100 -> #F9E76D
      // PR(预览): 红 --color-red-400 -> #ff6b6b

      if (lower.includes('outpaint')) {
        return { text: 'EX', color: '#60A5FA' } // 蓝
      }
      if (lower.includes('inpaint') || lower.includes('repaint')) {
        return { text: 'RE', color: '#10b981' } // 绿
      }
      if (lower.includes('image-edit') || lower.includes('single-edit') || lower.includes('imageedit')) {
        return { text: 'ED', color: '#C5AEF6' } // 紫亮
      }
      if (lower.includes('upscale') || lower.includes('generate') || lower === 'sc' || lower === 'archviz-upscale' || isFallbackUpscale) {
        return { text: 'UP', color: '#F9E76D' } // 香蕉黄
      }
      if (lower.includes('preview') || lower === 'yl') {
        return { text: 'PR', color: '#ff6b6b' } // 红
      }
      return null
    }

    // Get image URL from job data structure
    const getImageUrl = (item) => {
      // 直接使用 JobStore 的统一逻辑
      return jobStore.getOutputUrl(item)
    }

    // Get input image URL for background
    const getInputImageUrl = (item) => {
      // 直接使用 JobStore 的统一逻辑
      return jobStore.getInputUrl(item)
    }

    // Handle image load errors
    const handleImageError = (event) => {
      console.warn('Failed to load image:', event.target.src)
      // Could set a placeholder image here
    }
    
    // 使用a标签下载图片
    async function downloadByLink(url, fileName) {
      const res  = await fetch(url);        // 先请求
      const blob = await res.blob();        // 拿到二进制
      const obj  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = obj;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(obj);
    }
    // 点击下载图标
    function downloadImage(img){
      const url = jobStore.getOutputUrl(img)
      if (!url) return
      const fileName = img?.name || (img?.id ? `job-${img.id}.png` : 'image.png')
      downloadByLink(url, fileName)
    }

    
    const selectImage = (image) => {
      uiStore.setSelectedHistoryId(image?.id || '')
      const xm  = useXMStore()
      xm.deldcl()
      const imageStore = useImageStore()
      imageStore.clearImage()
      image.preview = jobStore.getOutputUrl(image) || image.url
      imageStore.setUploadedImageFile(image)
            xm.savedclimg(image.name)
      emit('image-select', {image,type:'dcl'})
    }

    const selectCkImage = (image) => {
      uiStore.setSelectedHistoryId(image?.id || '')
      const xm  = useXMStore()
      xm.delck()
      const imageStore = useImageStore()
      imageStore.clearReference()
      image.preview = jobStore.getOutputUrl(image) || image.url
      imageStore.setUploadedReferenceFile(image)
      xm.saveckimg(image.name)
      emit('image-select', {image,type:'ck'})
    }

    const previewPrimary = (image) => {
      selectImage(image)
      closePreview()
    }

    const previewSecondary = (image) => {
      selectCkImage(image)
      closePreview()
    }

    const {
      previewVisible,
      previewImage,
      previewReturnFocus,
      openPreview,
      closePreview,
      menuVisible,
      menuStyle,
      openMenu,
      closeMenu,
      menuPreview,
      menuPrimary,
      menuSecondary,
      menuCopy,
      menuOpenOriginal
    } = useImagePreviewMenu({ onPrimary: selectImage, onSecondary: selectCkImage })

    let clickTimer = 0
    const onHistoryClick = (item) => {
      if (clickTimer) window.clearTimeout(clickTimer)
      clickTimer = window.setTimeout(() => {
        clickTimer = 0
        selectHistoryImage(item)
      }, 240)
    }

    const onHistoryDblClick = (item) => {
      if (clickTimer) {
        window.clearTimeout(clickTimer)
        clickTimer = 0
      }
      const url = getImageUrl(item)
      const image = url ? { ...item, url } : item
      if (image) openPreview(image)
    }

    const onContextMenu = (event, item) => {
      const url = getImageUrl(item)
      const image = url ? { ...item, url } : item
      openMenu({ image, x: event.clientX, y: event.clientY })
    }

    return {
      // Store 数据
      displayItems,
      historyDegraded,
      historySyncHint,

      // 本地状态
      isExpanded,
      selectedHistoryId,

      // 图标
      historyIcon,

      // 方法
      selectHistoryImage,
      toggleExpansion,
      getStatusText,
      getStatusLabel,
      getStageInfo,
      isRunning,
      canCancel,
      isCancelling,
      cancelQueuedItem,
      getDisplayProgress,
      formatTime,
      getImageUrl,
      getInputImageUrl,
      handleImageError,
      selectImage,
      selectCkImage,
      downloadImage,
      download,
      previewVisible,
      previewImage,
      previewReturnFocus,
      openPreview,
      closePreview,
      previewPrimary,
      previewSecondary,
      menuVisible,
      menuStyle,
      closeMenu,
      menuPreview,
      menuPrimary,
      menuSecondary,
      menuCopy,
      menuOpenOriginal,
      onContextMenu,
      onHistoryClick,
      onHistoryDblClick,
      getWorkflowBadge
    }
  }
}
</script>

<style scoped lang="scss">
.history-item:hover .menu,
.history-item:focus-within .menu {
  opacity: 1;
}

.menu{
  position:absolute;
  top: 0;
  right: 0;
  z-index: 20;
  opacity: 0;
  transition: opacity 0.2s ease;
  
  /* Subtle vignette for contrast */
  background: radial-gradient(circle at top right, rgba(0,0,0,0.4) 0%, transparent 70%);
  width: 48px;
  height: 48px;
  border-top-right-radius: 12px; /* Match container radius */
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 8px;

  .icon-btn{
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 0;
    padding: 6px;
    border-radius: 999px;
    background: var(--bg-component-solid);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

    &:focus-visible {
      outline: none;
      box-shadow: var(--pod-ring);
    }

    .icon-mask {
      width: 100%;
      height: 100%;
      background-color: var(--schemes-primary);
      mask-size: contain;
      mask-repeat: no-repeat;
      mask-position: center;
      -webkit-mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-position: center;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }

    &:hover{
      transform: scale(1.15);
      
      .icon-mask {
        opacity: 1;
        /* Optional: Add a subtle glow filter if supported, or just brighter opacity */
        filter: drop-shadow(0 0 2px var(--schemes-primary));
      }
    }
  }
}
</style>
