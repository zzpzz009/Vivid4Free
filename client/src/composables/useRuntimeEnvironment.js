import { onBeforeUnmount, ref } from 'vue'

const POLL_INTERVAL_MS = 1800
const TRANSITION_STATES = new Set(['checking', 'downloading', 'verifying', 'installing', 'starting'])

export function createRuntimeEnvironmentController(bridge) {
  const status = ref(null)
  const busyAction = ref('')
  const pausePending = ref(false)
  const error = ref('')
  const bridgeUnavailable = ref(false)
  let pollTimer = null
  let polling = false
  let disposed = false
  let activeOperation = false

  async function refresh() {
    if (!bridge?.runtimeStatus) {
      bridgeUnavailable.value = true
      status.value = null
      return null
    }
    if (polling) return status.value
    polling = true
    try {
      const next = await bridge.runtimeStatus()
      if (disposed) return null
      status.value = next || null
      bridgeUnavailable.value = false
      return status.value
    } catch {
      if (!disposed) error.value = '暂时无法读取运行包状态，请重试。'
      return null
    } finally {
      polling = false
    }
  }

  async function run(action, methodName) {
    if (activeOperation) return false
    if (TRANSITION_STATES.has(status.value?.state) && ['runtimeCheck', 'runtimeInstall', 'chooseRuntimeDirectory'].includes(methodName)) return false
    const method = bridge?.[methodName]
    if (!method) {
      bridgeUnavailable.value = true
      error.value = '当前桌面版本尚未提供运行包管理功能。'
      return false
    }
    activeOperation = true
    busyAction.value = action
    error.value = ''
    try {
      const result = await method.call(bridge)
      if (result && typeof result === 'object' && 'state' in result) status.value = result
      await refresh()
      if (status.value?.state === 'error') error.value = status.value.message || '运行包操作失败，请重试。'
      return status.value?.state !== 'error'
    } catch {
      await refresh()
      if (status.value?.state === 'paused') {
        error.value = ''
      } else {
        error.value = '运行包操作失败，请检查安装目录后重试。'
      }
      return false
    } finally {
      activeOperation = false
      busyAction.value = ''
    }
  }

  async function pause() {
    if (pausePending.value || !activeOperation || busyAction.value !== 'installing' || status.value?.state !== 'downloading') return false
    const method = bridge?.runtimePause
    if (!method) {
      error.value = '当前桌面版本尚未提供暂停下载功能。'
      return false
    }
    pausePending.value = true
    error.value = ''
    try {
      await method.call(bridge)
      await refresh()
      return true
    } catch {
      error.value = '暂停下载失败，请重试。'
      return false
    } finally {
      pausePending.value = false
    }
  }

  function startPolling() {
    stopPolling()
    if (disposed) return
    pollTimer = setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollTimer !== null) clearInterval(pollTimer)
    pollTimer = null
  }

  function dispose() {
    disposed = true
    stopPolling()
  }

  return { status, busyAction, pausePending, error, bridgeUnavailable, refresh, run, pause, startPolling, stopPolling, dispose }
}

export function useRuntimeEnvironment(bridge) {
  const controller = createRuntimeEnvironmentController(bridge)
  onBeforeUnmount(controller.dispose)
  return controller
}
