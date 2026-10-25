import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeEnvironmentController } from './useRuntimeEnvironment.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('runtime environment controller', () => {
  afterEach(() => vi.useRealTimers())

  it('shows the compatibility reason and recommended delta after a rejected operation', async () => {
    const status = { state: 'installed', installed: true, available: true, availableCompatible: true,
      compatibilityMessage: '引擎 0.3.1 尚未声明兼容', recommendedPackage: 'incremental',
      incrementalBaseVersion: '0.3.1', availableVersion: '0.3.2', incrementalPackageBytes: 8994536 }
    const controller = createRuntimeEnvironmentController({ runtimeStatus: async () => status,
      runtimeImportArchive: async () => { throw new Error('rejected'); } })
    await controller.refresh()
    expect(await controller.run('importing', 'runtimeImportArchive')).toBe(false)
    expect(controller.error.value).toContain('尚未声明兼容')
    expect(controller.error.value).toContain('0.3.1 → 0.3.2 增量包')
    controller.dispose()
  })

  it('opens the selected cloud provider and reports external failures without changing the runtime', async () => {
    const status = { state: 'installed', installed: true, version: '0.3.0', updateAvailable: true }
    const bridge = { runtimeStatus: vi.fn(async () => status), runtimeOpenDownload: vi.fn()
      .mockResolvedValueOnce({ opened: true, message: '百度已打开，返回导入 ZIP' })
      .mockResolvedValueOnce({ opened: false, message: '系统无法打开夸克链接' }) }
    const controller = createRuntimeEnvironmentController(bridge)
    await controller.refresh()
    expect(await controller.run('opening-baidu', 'runtimeOpenDownload', 'baidu')).toBe(true)
    expect(bridge.runtimeOpenDownload).toHaveBeenLastCalledWith('baidu')
    expect(controller.actionMessage.value).toContain('导入 ZIP')
    expect(await controller.run('opening-quark', 'runtimeOpenDownload', 'quark')).toBe(false)
    expect(controller.error.value).toBe('系统无法打开夸克链接')
    expect(controller.actionMessage.value).toBe('')
    expect(controller.status.value.version).toBe('0.3.0')
    controller.dispose()
  })

  it('keeps a failed operation retryable and replaces the error after a successful retry', async () => {
    const status = { state: 'not_installed', installed: false, available: true, downloadedBytes: 0, totalBytes: 100 }
    const bridge = {
      runtimeStatus: vi.fn(async () => status),
      runtimeInstall: vi.fn()
        .mockRejectedValueOnce(new Error('下载中断'))
        .mockImplementationOnce(async () => {
          Object.assign(status, { state: 'installed', installed: true, version: '1.2.0' })
          return status
        })
    }
    const controller = createRuntimeEnvironmentController(bridge)

    await controller.refresh()
    expect(await controller.run('installing', 'runtimeInstall')).toBe(false)
    expect(controller.error.value).toBe('运行包操作失败，请检查安装目录后重试。')
    expect(controller.busyAction.value).toBe('')

    expect(await controller.run('installing', 'runtimeInstall')).toBe(true)
    expect(controller.error.value).toBe('')
    expect(controller.status.value.version).toBe('1.2.0')
    expect(bridge.runtimeInstall).toHaveBeenCalledTimes(2)
    controller.dispose()
  })

  it('ignores overlapping actions while the first native operation is pending', async () => {
    const pending = deferred()
    const bridge = {
      runtimeStatus: vi.fn(async () => ({ state: 'downloading', installed: false, available: true })),
      runtimeInstall: vi.fn(() => pending.promise)
    }
    const controller = createRuntimeEnvironmentController(bridge)
    const first = controller.run('installing', 'runtimeInstall')
    const second = await controller.run('installing', 'runtimeInstall')

    expect(second).toBe(false)
    expect(bridge.runtimeInstall).toHaveBeenCalledTimes(1)
    expect(controller.busyAction.value).toBe('installing')
    expect(await controller.run('checking', 'runtimeCheck')).toBe(false)
    expect(await controller.run('choosing-directory', 'chooseRuntimeDirectory')).toBe(false)

    pending.resolve({ state: 'downloading', installed: false, available: true })
    expect(await first).toBe(true)
    expect(controller.busyAction.value).toBe('')
    controller.dispose()
  })

  it('allows one pause during an active download without allowing a second install', async () => {
    const install = deferred()
    let currentStatus = { state: 'not_installed', installed: false, available: true }
    const bridge = {
      runtimeStatus: vi.fn(async () => currentStatus),
      runtimeInstall: vi.fn(() => install.promise),
      runtimePause: vi.fn(async () => {
        currentStatus = { ...currentStatus, state: 'paused', message: '下载已暂停' }
        return true
      })
    }
    const controller = createRuntimeEnvironmentController(bridge)
    await controller.refresh()
    const installOperation = controller.run('installing', 'runtimeInstall')
    currentStatus = { ...currentStatus, state: 'downloading', downloadedBytes: 20, totalBytes: 100 }
    await controller.refresh()

    expect(await controller.run('installing', 'runtimeInstall')).toBe(false)
    expect(await controller.run('checking', 'runtimeCheck')).toBe(false)
    expect(await controller.run('choosing-directory', 'chooseRuntimeDirectory')).toBe(false)
    expect(await controller.pause()).toBe(true)
    expect(await controller.pause()).toBe(false)
    expect(bridge.runtimeInstall).toHaveBeenCalledTimes(1)
    expect(bridge.runtimePause).toHaveBeenCalledTimes(1)
    expect(controller.status.value.state).toBe('paused')

    install.reject(new Error('aborted by pause'))
    expect(await installOperation).toBe(false)
    expect(controller.error.value).toBe('')
    expect(controller.busyAction.value).toBe('')
    controller.dispose()
  })

  it('blocks check and directory selection from transitional status even without a pending UI action', async () => {
    const bridge = {
      runtimeStatus: vi.fn(async () => ({ state: 'installing', installed: false, available: true })),
      runtimeCheck: vi.fn(),
      chooseRuntimeDirectory: vi.fn()
    }
    const controller = createRuntimeEnvironmentController(bridge)
    await controller.refresh()

    expect(await controller.run('checking', 'runtimeCheck')).toBe(false)
    expect(await controller.run('choosing-directory', 'chooseRuntimeDirectory')).toBe(false)
    expect(bridge.runtimeCheck).not.toHaveBeenCalled()
    expect(bridge.chooseRuntimeDirectory).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('polls only while active and stops its timer when disposed', async () => {
    vi.useFakeTimers()
    const bridge = { runtimeStatus: vi.fn(async () => ({ state: 'paused', installed: false, available: true })) }
    const controller = createRuntimeEnvironmentController(bridge)
    await controller.refresh()
    controller.startPolling()
    await vi.advanceTimersByTimeAsync(1800)
    expect(bridge.runtimeStatus).toHaveBeenCalledTimes(2)

    controller.dispose()
    await vi.advanceTimersByTimeAsync(5400)
    expect(bridge.runtimeStatus).toHaveBeenCalledTimes(2)
  })

  it('reports actionable connection errors while the previous runtime remains installed', async () => {
    const status = { state: 'installed', installed: true, version: '1.0.0', error: '新版缺少工作流节点，已恢复旧版' }
    const bridge = { runtimeStatus: vi.fn(async () => status), runtimeConnectDirectory: vi.fn(async () => { throw new Error('IPC failed') }) }
    const controller = createRuntimeEnvironmentController(bridge)
    await controller.refresh()
    expect(await controller.run('connecting', 'runtimeConnectDirectory')).toBe(false)
    expect(controller.error.value).toBe(status.error)
    expect(controller.status.value.version).toBe('1.0.0')
    controller.dispose()
  })

  it('cancelling a native file picker leaves the runtime unchanged without an error', async () => {
    const status = { state: 'not_installed', installed: false }
    const bridge = { runtimeStatus: vi.fn(async () => status), runtimeImportArchive: vi.fn(async () => ({ cancelled: true })) }
    const controller = createRuntimeEnvironmentController(bridge)
    await controller.refresh()
    expect(await controller.run('importing', 'runtimeImportArchive')).toBe(false)
    expect(controller.error.value).toBe('')
    expect(controller.status.value).toEqual(status)
    controller.dispose()
  })
})
