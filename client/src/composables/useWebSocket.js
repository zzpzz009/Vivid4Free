import { ref, onMounted, onUnmounted } from 'vue'
import { WS_URL } from '@/api/apiUtils.js'

export function useWebSocket(url = null) {
  const isConnected = ref(false)
  const connectionStatus = ref('disconnected')
  const lastMessage = ref(null)
  const error = ref(null)

  let ws = null
  let reconnectTimer = null
  let heartbeatTimer = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000
  const heartbeatInterval = 30000 // 30 seconds

  // 使用配置的 WebSocket URL 或传入的 URL
  const baseUrl = url || WS_URL

  // Event handlers - 适配 Backend WebSocket 消息类型（统一事件名）
  const eventHandlers = {
    status: [],
    progress: [],
    error: [],
    message: [],
    // 🎯 Gateway 标准事件
    'task_status': [],        // 任务状态变化（Gateway 主动发送）
    'progress_state': [],     // ComfyUI 进度状态（透传）
    'job_update': [],
    'job_progress': [],
    'job_completed': [],
    'job_error': [],
    'generation_update': [],
    'system_status': [],
    'backend_connected': [],
    'backend_disconnected': [],
    'ping': [],
    'pong': []
  }

  // Register event handler
  const on = (event, handler) => {
    if (eventHandlers[event]) {
      eventHandlers[event].push(handler)
    }
  }

  // Remove event handler
  const off = (event, handler) => {
    if (eventHandlers[event]) {
      const index = eventHandlers[event].indexOf(handler)
      if (index > -1) {
        eventHandlers[event].splice(index, 1)
      }
    }
  }

  // Emit event to handlers
  const emit = (event, data) => {
    if (eventHandlers[event]) {
      eventHandlers[event].forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in ${event} handler:`, error)
        }
      })
    }
  }

  // 处理 Backend WebSocket 消息
  const handleBackendMessage = (message) => {
    const { type, taskId, jobId, data, timestamp } = message

    switch (type) {
      // 🎯 Gateway 标准事件处理
      case 'task_status':
        // 任务状态更新（Gateway 主动发送）
        emit('task_status', {
          taskId,
          jobId,
          data,
          timestamp
        })
        break

      case 'progress_state':
        // ComfyUI 进度状态（透传）
        emit('progress_state', {
          taskId,
          jobId,
          data,
          timestamp
        })
        // 向后兼容
        emit('progress', data)
        break

      case 'status':
        // ComfyUI 系统状态（透传）
        emit('status', {
          data,
          timestamp
        })
        break

      case 'crystools.monitor':
        // ComfyUI 监控信息（透传）
        emit('crystools.monitor', {
          data,
          timestamp
        })
        break

      // 🗑️ 向后兼容的事件处理（已废弃，请使用 Gateway 标准事件）
      // case 'task_progress':
      //   // 任务进度更新
      //   emit('task_progress', {
      //     taskId,
      //     jobId,
      //     progress: data.progress,
      //     stage: data.stage,
      //     status: data.status,
      //     estimatedTime: data.estimatedTime,
      //     timestamp
      //   })
      //   // 向后兼容
      //   emit('progress', data)
      //   break

      // case 'task_completed':
      //   // 任务完成
      //   emit('task_completed', {
      //     taskId,
      //     jobId,
      //     status: data.status,
      //     resultImages: data.resultImages,
      //     errorMessage: data.errorMessage,
      //     timestamp
      //   })
      //   break

      // case 'task_failed':
      //   // 任务失败
      //   emit('task_failed', {
      //     taskId,
      //     jobId,
      //     status: 'failed',
      //     errorMessage: data.errorMessage,
      //     timestamp
      //   })
      //   emit('error', { message: data.errorMessage, taskId, jobId })
      //   break

      case 'job_update':
        // 作业状态更新
        emit('job_update', {
          jobId,
          status: data.status,
          progress: data.progress,
          currentStep: data.currentStep,
          timestamp
        })
        break

      case 'job_progress':
        // 作业进度更新
        emit('job_progress', {
          jobId,
          progress: data.progress,
          currentStep: data.currentStep,
          steps: data.steps,
          logs: data.logs,
          estimatedCompletion: data.estimatedCompletion,
          timestamp
        })
        break

      case 'job_completed':
        // 作业完成
        emit('job_completed', {
          jobId,
          result: data.result,
          completedAt: timestamp,
          duration: data.duration
        })
        break

      case 'job_error':
        // 作业错误
        emit('job_error', {
          jobId,
          error: data.error,
          errorMessage: data.message,
          failedAt: timestamp
        })
        break

      case 'generation_update':
        // 生成更新
        emit('generation_update', {
          generationId: data.generationId,
          status: data.status,
          progress: data.progress,
          images: data.images,
          timestamp
        })
        break

      case 'system_status':
        // 系统状态更新
        emit('system_status', {
          services: data.services,
          resources: data.resources,
          timestamp
        })
        break

      case 'backend_connected':
        // Backend 服务连接成功
        emit('backend_connected', { timestamp })
        break

      case 'backend_disconnected':
        // Backend 服务连接断开
        emit('backend_disconnected', { timestamp })
        break

      case 'ping':
        // 心跳请求，回复 pong
        send({ type: 'pong', timestamp: new Date().toISOString() })
        break

      case 'pong':
        // 心跳响应，无需处理
        break

      default:
        // 未知消息类型，发出通用事件
        if (eventHandlers[type]) {
          emit(type, data)
        }
        console.debug('Unknown WebSocket message type:', type)
    }
  }

  // Connect to WebSocket
  const connect = () => {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return
    }

    console.log('Connecting to WebSocket:', baseUrl)
    connectionStatus.value = 'connecting'
    error.value = null

    try {
      ws = new WebSocket(baseUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        isConnected.value = true
        connectionStatus.value = 'connected'
        reconnectAttempts = 0

        // Clear reconnect timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }

        // Start heartbeat
        startHeartbeat()

        emit('status', { connected: true, message: 'WebSocket connected' })
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          lastMessage.value = message

          console.log('WebSocket message:', message)

          // 处理不同类型的 Backend WebSocket 消息
          handleBackendMessage(message)

          // Also emit generic message event
          emit('message', message)

        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        isConnected.value = false
        connectionStatus.value = 'disconnected'
        ws = null

        emit('status', { connected: false, message: 'WebSocket disconnected' })

        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          scheduleReconnect()
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        connectionStatus.value = 'error'
        error.value = 'WebSocket connection error'
        emit('error', { message: 'WebSocket connection error', event })
      }

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      connectionStatus.value = 'error'
      error.value = err.message
      emit('error', { message: 'Failed to create WebSocket connection', error: err })
    }
  }

  // 心跳机制
  const startHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
    }

    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        send({ type: 'ping', timestamp: new Date().toISOString() })
      }
    }, heartbeatInterval)
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // Schedule reconnection
  const scheduleReconnect = () => {
    if (reconnectTimer) return

    reconnectAttempts++
    const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1) // Exponential backoff

    console.log(`Scheduling WebSocket reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`)
    connectionStatus.value = 'reconnecting'

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  // Disconnect WebSocket
  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    stopHeartbeat()

    if (ws) {
      ws.close(1000, 'Manual disconnect')
      ws = null
    }

    isConnected.value = false
    connectionStatus.value = 'disconnected'
  }

  // Send message
  const send = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
      return true
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
      return false
    }
  }

  // Auto-connect on mount
  onMounted(() => {
    connect()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    error,
    connect,
    disconnect,
    send,
    on,
    off
  }
}
