<template>
  <div class="bg-schemes-surface h-screen flex flex-col relative overflow-hidden">
    <!-- Global Header -->
    <AppHeader />

    <!-- Main Content Area -->
    <div class="flex flex-col flex-1 min-h-0 mt-12">
      <WorkspaceHeader
        :active-workspace-tab="uiStore.activeWorkspaceTab"
        :active-right-tab="uiStore.activeRightTab"
        :is-right-panel-expanded="uiStore.isRightPanelExpanded"
        @tab-change="handleWorkspaceTabChange"
        @toggle-tabs="handleToggleTabs"
        @right-tab-change="handleRightTabChange"
        @toggle-right-panel="handleRightPanelToggle"
      />

      <div class="flex flex-1 relative min-h-0">
        <!-- Main Workspace Area -->
        <div class="flex flex-col flex-1 min-h-0">
          <SingleEditContent v-if="uiStore.currentWorkspaceComponent()=='SingleEditContent'" />
          <LocalRepaintContent v-if="uiStore.currentWorkspaceComponent()=='LocalRepaintContent'" />
          <WorkspaceContent v-if="uiStore.currentWorkspaceComponent()=='WorkspaceContent'" />
        </div>

        <div
          v-if="uiStore.activeRightTab && uiStore.isRightPanelExpanded"
          class="absolute inset-y-4 right-4 z-[100] bg-schemes-surface-container-lowest rounded-corner-medium overflow-hidden transition-all duration-200 ease-out p-4"
          :style="{ left: uiStore.activeWorkspaceTab === 'local-repaint' ? '16px' : 'calc(var(--workspace-sidebar-total-width) + 16px)' }"
        >
          <RightPanel
            variant="floating"
            :active-tab="uiStore.activeRightTab"
            :is-expanded="uiStore.isRightPanelExpanded"
            @image-select="handleRightImageSelect"
          />
        </div>

        <div
          v-if="uiStore.activeRightTab && !uiStore.isRightPanelExpanded && uiStore.activeWorkspaceTab === 'local-repaint'"
          class="absolute right-4 top-4 bottom-4 z-[100] bg-transparent rounded-corner-medium overflow-hidden transition-all duration-200 ease-out"
          :style="{ width: 'var(--right-toolbar-controls-width)' }"
        >
          <RightPanel
            variant="floating"
            :active-tab="uiStore.activeRightTab"
            :is-expanded="uiStore.isRightPanelExpanded"
            @image-select="handleRightImageSelect"
          />
        </div>

        <div
          v-if="uiStore.activeRightTab && !uiStore.isRightPanelExpanded && uiStore.activeWorkspaceTab !== 'local-repaint'"
          class="my-4 h-[calc(100%-32px)] min-h-0"
        >
          <RightPanel
            variant="docked"
            :active-tab="uiStore.activeRightTab"
            :is-expanded="uiStore.isRightPanelExpanded"
            @image-select="handleRightImageSelect"
          />
        </div>
      </div>
    </div>

    <!-- Bottom Status Bar -->
    <StatusBar />

    <!-- Toast Notifications -->
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <Toast
        v-for="toastItem in toasts"
        :key="toastItem.id"
        :type="toastItem.type"
        :title="toastItem.title"
        :message="toastItem.message"
        :duration="toastItem.duration"
        :show-progress="toastItem.showProgress"
        :persistent="toastItem.persistent"
        :progress="toastItem.progress"
        @close="removeToast(toastItem.id)"
      />
    </div>

    <!-- Keyboard Shortcuts Help -->
    <KeyboardShortcutsHelp
      :visible="uiStore.showShortcutsHelp"
      @close="uiStore.setShowShortcutsHelp(false)"
    />

    <!-- ProgressDisplay 已移除，使用 StatusBar 的进度显示 -->
  </div>
</template>

<script>
import { onMounted, onUnmounted, computed, ref } from 'vue'
import AppHeader from '../../components/AppHeader.vue'
import WorkspaceHeader from '../../components/WorkspaceHeader.vue'
import WorkspaceContent from '../../components/WorkspaceContent.vue'
import SingleEditContent from '../../components/SingleEditContent.vue'
import LocalRepaintContent from '../../components/LocalRepaintContent.vue'
import RightPanel from '../../components/RightPanel.vue'
import StatusBar from '../../components/StatusBar.vue'
import Toast from '../../components/ui/Toast.vue'
import KeyboardShortcutsHelp from '../../components/KeyboardShortcutsHelp.vue'
// ProgressDisplay 已移除
import { useToast, loading, success, error, removeToast } from '../../utils/toast.js'
import { api } from '../../api/index.js'
import { useKeyboardShortcuts, SHORTCUTS } from '../../composables/useKeyboardShortcuts.js'
// import { useWebSocket } from './composables/useWebSocket.js'
// Import Pinia stores
import { useImageStore, useJobStore, useUIStore, useAuthStore, useAssetStore } from '../../stores/index.js'
import { xmAPI } from '../../api/xmapi.js'
import { useXMStore } from '@/stores/xmStore.js'
import {objgetimgurl} from '../../utils/utils.js'



export default {
  name: 'App',
  components: {
    AppHeader,
    WorkspaceHeader,
    WorkspaceContent,
    SingleEditContent,
    LocalRepaintContent,
    RightPanel,
    StatusBar,
    Toast,
    KeyboardShortcutsHelp
    // ProgressDisplay 已移除
  },
  setup() {
    const WORKSPACE_ACTION_EVENT = 'va-workspace-action'
    const dclinput = ref(null)
    const tabval = ref('')
    function setInputVal(v){
      dclinput.value.value = v
    }
    function setdclinput(v){
      dclinput.value = v
    }
    // Initialize Pinia stores
    const imageStore = useImageStore()
    const jobStore = useJobStore()
    const uiStore = useUIStore()
    const authStore = useAuthStore()
    const assetStore = useAssetStore()
    const currentImage = computed(() => imageStore.uploadedImageFile)
    const showShortcutsHelp = computed({
      get: () => uiStore.showShortcutsHelp,
      set: (value) => uiStore.setShowShortcutsHelp(value)
    })
    const isWorkspaceActive = computed(() => uiStore.currentWorkspaceComponent() === 'WorkspaceContent')

    // Toast system
    const { toasts, success, error, warning, info, loading, removeToast } = useToast()

    // Keyboard shortcuts
    useKeyboardShortcuts({
      [SHORTCUTS.GENERATE]: () => {
        if (isWorkspaceActive.value) {
          window.dispatchEvent(new CustomEvent(WORKSPACE_ACTION_EVENT, { detail: { action: 'upscale' } }))
          return
        }
        if (currentImage.value && !jobStore.isGenerating) {
          handleGenerate()
        } else if (!currentImage.value) {
          warning('请先上传待处理图片')
        }
      },
      [SHORTCUTS.PREVIEW]: () => {
        if (isWorkspaceActive.value) {
          window.dispatchEvent(new CustomEvent(WORKSPACE_ACTION_EVENT, { detail: { action: 'preview' } }))
          return
        }
        if (currentImage.value) {
          handlePreview()
        } else {
          warning('请先上传待处理图片')
        }
      },
      [SHORTCUTS.SAVE]: (event) => {
        event.preventDefault()
        if (currentImage.value) {
          info('保存功能开发中...')
        } else {
          warning('没有可保存的图片')
        }
      },
      [SHORTCUTS.ESCAPE]: () => {
        if (showShortcutsHelp.value) {
          showShortcutsHelp.value = false
          return
        }
        if (isWorkspaceActive.value && jobStore.previewUpscaleRunState !== 'idle') {
          window.dispatchEvent(new CustomEvent(WORKSPACE_ACTION_EVENT, { detail: { action: 'cancel' } }))
        }
      },
      '?': () => {
        showShortcutsHelp.value = !showShortcutsHelp.value
      }
    })

    const handleImageUpload = async (file) => {
      console.log('Image uploaded:', file)

      // Show loading toast
      const loader = loading('正在处理上传的图片...')

      try {
        const result = await assetStore.setFloorplanFile(file)

        // Remove loading toast
        removeToast(loader)

        if (result.success) {
          success('待处理图片已选择！')
        } else {
          error('图片处理失败：' + result.error)
        }
      } catch (error) {
        console.error('Image processing failed:', error)
        removeToast(loader)
        error('图片处理失败：' + error.message)
      }
    }

    const handleReferenceUpload = async (file) => {
      console.log('Reference image uploaded:', file)

      // Show loading toast
      const loader = loading('正在处理参考图片...')

      try {
        const result = await assetStore.setStyleFile(file)

        // Remove loading toast
        removeToast(loader)

        if (result.success) {
          success('参考图片已选择！')
        } else {
          error('参考图片处理失败：' + result.error)
        }
      } catch (error) {
        console.error('Reference processing failed:', error)
        removeToast(loader)
        error('参考图片处理失败：' + error.message)
      }
    }

    const handleClearImage = () => {
      console.log('Image cleared')
      uiStore.clearImage()
      info('主图已清空')
    }

    const handleClearReference = () => {
      console.log('Reference image cleared')
      uiStore.clearReference()
      info('参考图已清空')
    }

    const handlePromptChange = (newPrompt) => {
      jobStore.setPrompt(newPrompt)
    }

    // Fetch latest result from API as fallback
    const fetchLatestResult = async () => {
      try {
        const data = await api.results.getLatest()
        if (data.success && data.result) {
          const result = data.result
          const baseUrl = window.location.origin
          const fullImageUrl = result.apiImageUrl.startsWith('http')
            ? result.apiImageUrl
            : `${baseUrl}${result.apiImageUrl}`

          currentImage.value = fullImageUrl

          // Job store will handle history automatically

          return result
        }
      } catch (error) {
        console.error('Error fetching latest result:', error)
      }
      return null
    }

    // handleGenerate 方法已经移动到各个内容组件中，直接使用 JobStore 的 executeGeneration 方法
    const handleGenerate_DEPRECATED = async (options = {}) => {
      if (!imageStore.hasUploadedImage()) {
        error('请先上传待处理图片')
        return
      }

      if (!imageStore.hasUploadedReference()) {
        error('请先上传参考图片')
        return
      }

      const mode = options.mode || { name: '生成', id: 'archviz-preview' }
      const advancedParameters = options.advancedParameters || {}
      const advancedParameterFiles = options.advancedParameterFiles || {}
      const isLocalRepaint = options.isLocalRepaint || false
      const maskImage = options.maskImage || null

      // For local repaint, check if mask is provided
      if (isLocalRepaint && !maskImage) {
        error('局部重绘需要绘制蒙版区域')
        return
      }

      // Start generation using store
      jobStore.setLoading(true)
      jobStore.setStatusMessage(`正在使用${mode.name}模式生成图像...`, 'info')

      // Initialize current generation status
      jobStore.setCurrentGenerationStatus({
        status: 'queued',
        progress: 0,
        stage: '准备中',
        stageInfo: '正在准备生成任务...'
      })

      // Show loading toast
      const loadingToastId = loading(`正在使用${mode.name}模式生成图像...`)

      try {
        // Try direct HTTP API call first (for web and LAN access)
        jobStore.setStatusMessage('正在准备图片文件...', 'info')

        const formData = new FormData()
        formData.append('floorplan', imageStore.uploadedImageFile)
        formData.append('style', imageStore.uploadedReferenceFile)
        formData.append('prompt', jobStore.prompt || 'architectural rendering, modern building, professional visualization, high quality, detailed')
        formData.append('workflowId', mode.id)

        jobStore.setStatusMessage('正在连接生成服务...', 'info')

        console.log('Calling generation API with files:',
          imageStore.uploadedImageFile?.name || imageStore.uploadedImageFile?.file?.name,
          imageStore.uploadedReferenceFile?.name || imageStore.uploadedReferenceFile?.file?.name)

        // 设置蒙版文件（如果有）
        if (isLocalRepaint && maskImage) {
          const maskBlob = await fetch(maskImage).then(r => r.blob())
          const maskFile = new File([maskBlob], 'mask.png', { type: 'image/png' })
          await assetStore.setMaskFile(maskFile)
        }

        // 通过 JobStore 执行生成
        const result = await jobStore.executeGeneration(assetStore)

        if (result.success) {
          jobStore.setStatusMessage('生成请求已提交，等待完成...', 'info')

          // Start generation tracking
          jobStore.startGeneration(result.promptId)

          // Add job to job store immediately
          const jobData = {
            id: result.promptId,  // Use promptId as primary ID
            promptId: result.promptId,
            status: 'queued',
            progress: 0,
            stage: 'Queued',
            stageInfo: '排队中...',
            input: {
              prompt: jobStore.prompt,
              floorplanFile: imageStore.uploadedImageFile?.name || imageStore.uploadedImageFile?.file?.name,
              styleFile: imageStore.uploadedReferenceFile?.name || imageStore.uploadedReferenceFile?.file?.name
            },
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
          }

          jobStore.addJob(jobData)

          // The WebSocket will handle the image loading and history update
          // But also set a timeout to fetch result directly as fallback
          setTimeout(async () => {
            if (jobStore.isGenerating) {
              console.log('WebSocket completion not received, fetching result directly...')
              const latestResult = await fetchLatestResult()
              if (latestResult) {
                jobStore.setStatusMessage('生成完成！', 'success')
                jobStore.setGenerationProgress(100)

                setTimeout(() => {
                  jobStore.setGenerationProgress(0)
                  jobStore.setStatusMessage('Ready', 'info')
                  jobStore.setLoading(false)
                }, 3000)

                removeToast(loadingToastId)
                success(`${mode.name}模式生成完成！`)
              }
            }
          }, 10000) // Wait 10 seconds for WebSocket

          // Don't remove loading toast or set success immediately
          // Let WebSocket or timeout handle it
        } else {
          throw new Error(result.error || '生成失败')
        }

      } catch (err) {
        console.error('HTTP API failed, trying Electron fallback:', err)
        const finalError = err

        // No Electron API fallback - Web app is now independent

        // Handle final error
        console.error('Generation failed:', finalError)
        jobStore.setStatusMessage('生成失败：' + finalError.message, 'error')

        // Remove loading toast and show error
        removeToast(loadingToastId)
        error('生成失败：' + finalError.message)
      } finally {
        jobStore.setLoading(false)
      }
    }

    const handlePreview = async () => {
      // 预览功能直接使用 handleGenerate，只是使用预览工作流
      const previewMode = {
        id: 'archviz-preview',
        name: '预览'
      }

      // 通过 JobStore 执行预览
      try {
        const loadingToastId = loading('正在生成预览...')

        const result = await jobStore.executePreview(assetStore)

        removeToast(loadingToastId)

        if (result.success) {
          success('预览任务已开始')
        } else {
          error('预览失败：' + result.error)
        }
      } catch (err) {
        error('预览失败：' + err.message)
      }
    }
    const handleRightTabChange = (tab) => {
      if (uiStore.activeWorkspaceTab === 'local-repaint') {
        if (uiStore.activeRightTab === tab) {
          uiStore.setActiveRightTab(null)
          uiStore.toggleRightPanel(false)
          return
        }
        uiStore.toggleRightPanel(false)
      }
      uiStore.setActiveRightTab(tab)
    }

    const handleRightPanelToggle = (forceState) => {
      uiStore.toggleRightPanel(forceState)
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result); // data:image/xxx;base64,xxxx
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);                   // 关键一步
      });
    }
    
    const handleRightImageSelect = async (payload, fn) => {
      // Set as reference image instead of current display image
      
      try {
        const selection = payload?.image ? payload : { image: payload, type: 'ck' }
        const image = selection?.image
        const type = selection?.type || 'ck'
        if (!image) {
          error('未找到可用图片')
          return
        }
        const deriveFileName = (url, fallbackName, mimeType) => {
          const fallback = String(fallbackName || '').trim()
          let candidate = fallback
          if (!candidate) {
            try {
              const parsed = new URL(url, window.location.origin)
              const queryFilename = parsed.searchParams.get('filename')
              if (queryFilename) {
                candidate = decodeURIComponent(queryFilename)
              } else {
                candidate = decodeURIComponent(parsed.pathname.split('/').pop() || '')
              }
            } catch {
              candidate = String(url || '').split('/').pop() || ''
            }
          }
          candidate = String(candidate || '')
            .split('?')[0]
            .split('#')[0]
            .replace(/[\\/:*?"<>|]/g, '_')
            .trim()
          if (!candidate) candidate = 'selected-reference'
          const hasExt = /\.[a-zA-Z0-9]{2,8}$/.test(candidate)
          if (!hasExt) {
            const extFromMime = String(mimeType || '').split('/')[1]?.split('+')[0] || 'jpg'
            candidate = `${candidate}.${extFromMime}`
          }
          return candidate
        }
        const imageUrl = image.url || image.path || image
        if (!imageUrl) {
          error('图片地址无效')
          return
        }
        jobStore.setStatusMessage('正在加载参考图片...', 'info')

        // Fetch the image and convert to File object
        const response = await fetch(imageUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`)
        }

        const blob = await response.blob()
        const fileName = deriveFileName(imageUrl, image.name, blob.type)

        // Create a proper File object
        const referenceFile = new File([blob], fileName, {
          type: blob.type || 'image/jpeg'
        })

        // Add preview property for UnifiedSidebar display
        referenceFile.preview = imageUrl
        referenceFile.url = imageUrl
        referenceFile.path = image.path || imageUrl

        if (type === 'dcl') {
          await assetStore.setFloorplanFile(referenceFile)
        } else if (type === 'ck') {
          await assetStore.setStyleFile(referenceFile)
        }

        // uploadedReferenceFile.value = referenceFile
        // referenceImage.value = referenceFile

        // jobStore.setStatusMessage('参考图片选择成功', 'success')
        success('参考图片选择成功！')

        // Reset status after delay
        // setTimeout(() => {
        //   jobStore.setStatusMessage('Ready', 'info')
        // }, 2000)

        console.log('Reference image selected:', referenceFile)
        const xm  = useXMStore()
        
        const result = await xmAPI.uploadimgapi(referenceFile)
        // debugger;

        if(result.name){
          if(fn){
            fn(result)
            return;
          }
            // debugger;
          const base64 =  await fileToBase64(referenceFile)
          if(type=='dcl'){
            xm.savedclimg(result.name)
            xm.savedclimgurl(base64)
          }else if(type == 'ck'){
            xm.saveckimg(result.name)
            xm.saveckimgurl(base64)
          }
          // if(!xm.dclimg){
          //   xm.savedclimg(result.name)
          // }else if(!xm.ckimg){
          //   xm.saveckimg(result.name)
          // }else{
          //   info('已经有图片选中了')
          // }
        }
      } catch (err) {
        console.error('Reference selection failed:', err)
        // jobStore.setStatusMessage('参考图片选择失败', 'error')
        error('参考图片选择失败，请重试')
      }
    }

    // Batch Preview specific handlers
    const handleImagesUpload = (files) => {
      console.log('Multiple images uploaded:', files.length)

      // Show loading toast
      const loadingToastId = loading(`正在处理 ${files.length} 张图片...`)

      try {
        // TODO: Store multiple images for batch processing

        // Remove loading toast and show success
        removeToast(loadingToastId)
        success(`成功上传 ${files.length} 张图片！`)
      } catch (error) {
        console.error('Multiple images upload failed:', error)

        // Remove loading toast and show error
        removeToast(loadingToastId)
        error('批量图片上传失败，请重试')
      }
    }

    const handleReferencesUpload = (files) => {
      console.log('Multiple references uploaded:', files.length)

      // Show loading toast
      const loadingToastId = loading(`正在处理 ${files.length} 张参考图片...`)

      try {
        // TODO: Store multiple reference images for batch processing

        // Remove loading toast and show success
        removeToast(loadingToastId)
        success(`成功上传 ${files.length} 张参考图片！`)
      } catch (error) {
        console.error('Multiple references upload failed:', error)

        // Remove loading toast and show error
        removeToast(loadingToastId)
        error('批量参考图片上传失败，请重试')
      }
    }

    const handleClearImages = () => {
      console.log('Clear all images')
      // TODO: Clear all uploaded images
    }

    const handleClearReferences = () => {
      console.log('Clear all references')
      // TODO: Clear all uploaded reference images
    }

    const handleBatchGenerate = async (options) => {
      console.log('Batch generate:', options)
      const { images, references, prompt } = options

      if (!images.length || !references.length) {
        error('请上传主图和参考图')
        return
      }

      try {
        jobStore.setLoading(true)
        const totalJobs = images.length * references.length
        jobStore.setStatusMessage(`准备批量生成 ${images.length} × ${references.length} = ${totalJobs} 张图片...`, 'info')

        // Show loading toast
        const loadingToastId = loading(`正在创建 ${totalJobs} 个生成任务...`, true)

        // 设置批量文件到 AssetStore
        assetStore.setMode('batch')
        await Promise.all(images.map(img => assetStore.addFloorplanFile(img.file)))
        await Promise.all(references.map(ref => assetStore.addStyleFile(ref.file)))

        // 通过 JobStore 执行批量生成
        const result = await jobStore.executeBatchGeneration(assetStore)

        if (result.success) {
          // Remove loading toast
          removeToast(loadingToastId)

          success(`批量生成任务已创建！将生成 ${result.jobCount} 张图片`)
          jobStore.setStatusMessage(`批量生成进行中 (${result.jobCount} 个任务)`, 'info')

          console.log('✅ Batch generation started:', result)
          console.log(`📊 Batch ID: ${result.batchId}`)
          console.log(`🔢 Job count: ${result.jobCount}`)
          console.log(`⏱️ Estimated time: ${result.estimatedTime}`)
        } else {
          removeToast(loadingToastId)
          throw new Error(result.message || '批量生成启动失败')
        }
      } catch (err) {
        console.error('Batch generation failed:', err)
        error('批量生成失败：' + err.message)
        jobStore.setStatusMessage('批量生成失败', 'error')
      } finally {
        jobStore.setLoading(false)
      }
    }

    const handleBatchPreview = async (options) => {
      console.log('Batch preview:', options)
      const { images, references, prompt } = options

      if (!images.length || !references.length) {
        error('预览需要上传图片和参考图')
        return
      }

      try {
        jobStore.setLoading(true)
        jobStore.setStatusMessage('正在生成预览...', 'info')

        // Show loading toast
        const loadingToastId = loading('正在生成预览图片...', true)

        // 设置单个文件进行预览
        await assetStore.setFloorplanFile(images[0].file)
        await assetStore.setStyleFile(references[0].file)

        // 通过 JobStore 执行预览
        const result = await jobStore.executePreview(assetStore)

        if (result.success) {
          // Remove loading toast
          removeToast(loadingToastId)

          success('预览生成已启动！')
          jobStore.setStatusMessage('预览生成中...', 'info')

          console.log('✅ Batch preview started:', result)
        } else {
          removeToast(loadingToastId)
          throw new Error(result.message || '预览生成启动失败')
        }
      } catch (err) {
        console.error('Batch preview failed:', err)
        error('预览生成失败：' + err.message)
        jobStore.setStatusMessage('预览生成失败', 'error')
      } finally {
        jobStore.setLoading(false)
      }
    }

    const handleWorkspaceTabChange = (tab) => {
      uiStore.setActiveWorkspaceTab(tab)
      console.log('tab:',tab)
      tabval.value = tab;

      imageStore.setMode('single')

      console.log('Workspace tab changed to:', tab, 'imageStore mode:', imageStore.currentMode)
    }

    const handleToggleTabs = () => {
      console.log('Toggle tabs clicked')
      // TODO: Implement tabs collapse/expand functionality
    }
    // 系统监控功能
    const systemHealthy = ref(true)
    const lastHealthCheck = ref(null)

    const checkSystemHealth = async () => {
      try {
        const result = await api.system.getHealth()
        systemHealthy.value = result.status === 'healthy'
        lastHealthCheck.value = new Date()

        if (!systemHealthy.value) {
          warning('系统状态异常，请检查后端服务')
        }
      } catch (error) {
        console.error('Health check failed:', error)
        systemHealthy.value = false
        lastHealthCheck.value = new Date()
      }
    }

    // 会话监控功能
    const sessionCheckInterval = ref(null)

    const checkSessionStatus = () => {
      if (!authStore.isAuthenticated) {
        // 会话已过期，跳转到登录页
        console.log('Session expired, redirecting to login')
        window.location.href = '/#/login'
      }
    }

    const startSessionMonitoring = () => {
      // 每5分钟检查一次会话状态
      sessionCheckInterval.value = setInterval(checkSessionStatus, 5 * 60 * 1000)
    }

    const stopSessionMonitoring = () => {
      if (sessionCheckInterval.value) {
        clearInterval(sessionCheckInterval.value)
        sessionCheckInterval.value = null
      }
    }

    const startSystemMonitoring = () => {
      // 立即执行一次健康检查
      checkSystemHealth()

      // 每30秒检查一次系统健康状态
      const healthCheckInterval = setInterval(checkSystemHealth, 30000)

      // 组件卸载时清理定时器
      onUnmounted(() => {
        clearInterval(healthCheckInterval)
        stopSessionMonitoring()
      })
    }

    // Initialize on component mount
    onMounted(async () => {
      // 首先检查认证状态
      const isAuthenticated = authStore.initAuth()
      if (!isAuthenticated) {
        // 未认证，路由守卫会处理跳转
        return
      }

      // 启动会话监控
      startSessionMonitoring()

      // Load jobs from localStorage first
      jobStore.loadJobsFromStorage()

      // Then load jobs from server API
      await jobStore.loadJobsFromServer(api)

      // Start system monitoring
      // startSystemMonitoring()
    })

    return {
      // Stores (for template access)
      imageStore,
      jobStore,
      uiStore,

      // Toast system
      toasts,
      removeToast,

      // System monitoring
      systemHealthy,
      lastHealthCheck,

      // Event handlers (仅保留必要的全局事件处理)
      // handleImageUpload, handleReferenceUpload - 已移动到组件中
      // handleClearImage, handleClearReference - 已移动到组件中
      // handlePromptChange - 已移动到组件中
      // handleGenerate - 已移动到各个内容组件中
      // handlePreview - 已移动到组件中
      handleRightTabChange,
      handleRightPanelToggle,
      handleRightImageSelect,
      handleWorkspaceTabChange,
      tabval,
      handleToggleTabs
      // handleImagesUpload, handleReferencesUpload - 已移动到组件中
      // handleClearImages, handleClearReferences - 已移动到组件中
      // handleBatchGenerate, handleBatchPreview - 已移动到组件中
    }
  }
}
</script>

<style>
</style>
