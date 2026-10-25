import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElectronHost } from './electronHost.js'
import { host } from './host.js'

afterEach(() => vi.unstubAllGlobals())

describe('desktop host boundary', () => {
  it('resolves a missing or replaced bridge at call time and rejects unavailable operations', async () => {
    vi.stubGlobal('window', undefined)
    expect(host.supports('runtimeStatus')).toBe(false)
    await expect(host.runtimeStatus()).rejects.toMatchObject({ code: 'HOST_UNAVAILABLE' })
    const status = { state: 'ready' }
    vi.stubGlobal('window', { vividDesktop: { runtimeStatus: () => status, invoke: vi.fn(), toString: vi.fn() } })
    expect(host.supports('runtimeStatus')).toBe(true)
    expect(await host.runtimeStatus()).toBe(status)
    expect(host.supports('invoke')).toBe(false)
    expect(host.supports('toString')).toBe(false)
    expect(host.invoke).toBeUndefined()
    expect(Object.isFrozen(host)).toBe(true)
    vi.stubGlobal('window', { vividDesktop: {} })
    expect(host.supports('runtimeStatus')).toBe(false)
  })

  it('turns synchronous throws into rejected Promises without replacing errors', async () => {
    const error = new Error('operation failed')
    const adapter = createElectronHost(() => ({ windowAction: () => { throw error } }))
    let result
    expect(() => { result = adapter.windowAction('close') }).not.toThrow()
    expect(result).toBeInstanceOf(Promise)
    await expect(result).rejects.toBe(error)
    const rejecting = createElectronHost(() => ({ runtimeInstall: () => Promise.reject(error) }))
    await expect(rejecting.runtimeInstall()).rejects.toBe(error)
  })

  it('preserves input identity, receiver, result and the existing argument signatures', async () => {
    const credentials = { username: 'test-user', password: 'test-only-value' }
    const result = { status: 'signed_in' }
    const bridge = { accountLogin: vi.fn(function (input) { expect(this).toBe(bridge); expect(input).toBe(credentials); return result }),
      windowAction: vi.fn(), runtimeOpenDownload: vi.fn(), runtimeImportArchive: vi.fn(), runtimeCheck: vi.fn() }
    const adapter = createElectronHost(() => bridge)
    expect(await adapter.accountLogin(credentials)).toBe(result)
    expect(bridge.accountLogin).toHaveBeenCalledWith(credentials)
    await adapter.windowAction('maximize')
    await adapter.runtimeOpenDownload('quark', true)
    await adapter.runtimeImportArchive('D:\\下载\\引擎.zip')
    await adapter.runtimeCheck()
    expect(bridge.windowAction).toHaveBeenCalledWith('maximize')
    expect(bridge.runtimeOpenDownload).toHaveBeenCalledWith('quark', true)
    expect(bridge.runtimeImportArchive).toHaveBeenCalledWith('D:\\下载\\引擎.zip')
    expect(bridge.runtimeCheck).toHaveBeenCalledWith()
  })

  it.each(['onWindowState', 'onAgentTask'])('%s forwards one payload and keeps unsubscribe safe across bridge changes', method => {
    let listener
    const unsubscribe = vi.fn()
    let bridge = { [method]: callback => { listener = callback; return unsubscribe } }
    const adapter = createElectronHost(() => bridge)
    const callback = vi.fn()
    const stop = adapter[method](callback)
    const payload = { id: 'task-1', maximized: true }
    listener(payload, { ignored: 'extra bridge data' })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(payload)
    bridge = null
    stop()
    stop()
    listener(payload)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledTimes(1)
    const stopMissing = adapter[method](callback)
    expect(() => { stopMissing(); stopMissing() }).not.toThrow()
  })
})
