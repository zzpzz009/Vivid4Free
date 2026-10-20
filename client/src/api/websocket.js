import { COMFY_WS_URL, WS_URL } from '../api/apiUtils.js'
import { ref } from 'vue'
import {useXMStore} from '../stores/xmStore.js'

const baseUrl = COMFY_WS_URL || WS_URL || ''

const connectionStatus = ref(null)
const error = ref(null)
let ws = null
let wsClientId = null
const promptListeners = new Map()

const resolvePromptId = (message = {}) => (
  message?.data?.prompt_id
  || message?.data?.promptId
  || message?.prompt_id
  || message?.promptId
  || null
)

const resolveErrorMessage = (message = {}) => (
  message?.data?.exception_message
  || message?.data?.error
  || message?.data?.message
  || message?.data?.exception_type
  || '执行失败'
)

const createExecutionState = (options = {}) => ({
  totalNodes: Math.max(1, Number(options?.totalNodes) || 1),
  completedNodes: new Set(),
  activeNode: null
})

const getListenerProgress = (listener, promptId, fallbackProgress = '0%') => {
  const rawProgress = Number.parseFloat(String(fallbackProgress).replace('%', ''))
  const state = listener?.executionState
  if (!state) {
    return {
      label: fallbackProgress,
      percentage: Number.isFinite(rawProgress) ? rawProgress : 0,
      stageInfo: `进度 ${fallbackProgress}`
    }
  }
  const completedSteps = state.completedNodes.size
  const nodeProgress = Math.max(0, Math.min(1, (Number.isFinite(rawProgress) ? rawProgress : 0) / 100))
  const activeContribution = state.activeNode ? nodeProgress : 0
  const nodeBasedPercentage = Math.max(0, Math.min(100, ((completedSteps + activeContribution) / state.totalNodes) * 100))
  // Prefer real Comfy progress when available; fall back to node-based estimation for executing/cached events.
  const percentage = Math.max(
    nodeBasedPercentage,
    Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : 0
  )
  const currentStep = Math.min(state.totalNodes, completedSteps + (state.activeNode ? 1 : 0))
  return {
    label: `${percentage.toFixed(2)}%`,
    percentage,
    stageInfo: `步骤 ${Math.max(1, currentStep)}/${state.totalNodes}`
  }
}

const emitWorkflowProgress = (listener, promptId, fallbackProgress = '0%') => {
  const progressFn = listener?.progress
  if (typeof progressFn !== 'function') {
    return
  }
  const progressState = getListenerProgress(listener, promptId, fallbackProgress)
  progressFn(promptId, progressState.label, progressState)
}

export const connect = (clientId, success, progress, promptId, fail, options = {}) => {
  const xm  = useXMStore()
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    if (wsClientId !== clientId) {
      try {
        ws.close()
      } catch (_) {
        void 0
      }
      ws = null
    }
  }

  console.log('Connecting to WebSocket:', baseUrl)
  connectionStatus.value = 'connecting'
  error.value = null

  if (!ws) {
    wsClientId = clientId
    ws = new WebSocket(baseUrl + '/ws?clientId=' + clientId)
  }

  if (promptId) {
    promptListeners.set(promptId, {
      success,
      progress,
      fail,
      executionState: createExecutionState(options)
    })
  }

  ws.onopen = () => {
    console.log('WebSocket connected')

  }

  ws.onmessage = (event) => { 
    try {
      if (typeof event.data !== 'string') {
        return
      }
      const message = JSON.parse(event.data)
      console.log('WebSocket message:', message)
      if(message.type == 'progress'){
        const {value,max,prompt_id} = message.data
        const listener = promptListeners.get(prompt_id)
        const progressval = (value / Math.max(1, max) * 100).toFixed(2) + '%'
        emitWorkflowProgress(listener, prompt_id, progressval)
        if (message.data.value == message.data.max) {
          xm.savesuccessimgid(prompt_id)
        } else {
          console.log('任务进行中,进度',(value/max*100).toFixed(2)+'%')
        }
      } else if (message.type === 'execution_cached') {
        const cachedPromptId = resolvePromptId(message)
        const listener = promptListeners.get(cachedPromptId)
        const cachedNodes = Array.isArray(message?.data?.nodes) ? message.data.nodes : []
        if (listener?.executionState) {
          cachedNodes.forEach((nodeId) => {
            listener.executionState.completedNodes.add(String(nodeId))
          })
          emitWorkflowProgress(listener, cachedPromptId, '0%')
        }
      } else if (message.type === 'executing' && message.data.node != null) {
        const executingPromptId = resolvePromptId(message)
        const listener = promptListeners.get(executingPromptId)
        if (listener?.executionState) {
          const nextNode = String(message.data.node)
          if (listener.executionState.activeNode && listener.executionState.activeNode !== nextNode) {
            listener.executionState.completedNodes.add(listener.executionState.activeNode)
          }
          listener.executionState.activeNode = nextNode
          emitWorkflowProgress(listener, executingPromptId, '0%')
        }
      }else if(message.type=='executing'&&message.data.node==null){
        const donePromptId = resolvePromptId(message)
        const listener = promptListeners.get(donePromptId)
        if (listener?.executionState?.activeNode) {
          listener.executionState.completedNodes.add(listener.executionState.activeNode)
          listener.executionState.activeNode = null
          emitWorkflowProgress(listener, donePromptId, '100%')
        }
        const successFn = listener?.success || success
        setTimeout(() => {
          if (typeof successFn === 'function') {
            successFn(donePromptId)
          }
        }, 1000)
        if (listener) {
          promptListeners.delete(donePromptId)
        }
      } else if (message.type === 'execution_error' || message.type === 'execution_interrupted') {
        const failedPromptId = resolvePromptId(message)
        const listener = promptListeners.get(failedPromptId)
        const failFn = listener?.fail || fail
        const errorMessage = resolveErrorMessage(message)
        if (typeof failFn === 'function') {
          failFn(failedPromptId, errorMessage, message)
        }
        if (listener) {
          promptListeners.delete(failedPromptId)
        }
      }
    } catch (error) { 
      console.error('报错，返回数据不是json:', error)
    }
  }

  ws.onerror = (event) => { 
    console.error('WebSocket error:', event)
    // ws.close()
    error.value = event
  }

  ws.onclose = () => { 
    console.log('WebSocket closed')
    connectionStatus.value = 'closed'
  }

  return ws
}
