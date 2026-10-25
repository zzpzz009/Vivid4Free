import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, apiBlobRequest, apiPost } from './apiUtils.js'

vi.mock('@/utils/toast.js', () => ({ warning: vi.fn() }))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

const stalledFetch = (_url, { signal }) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason), { once: true })
})

describe('request deadlines, cancellation and safe retries', () => {
  it('bounds a stalled request and does not replay a submission', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(stalledFetch)
    vi.stubGlobal('fetch', fetch)
    const result = apiPost('/api/desktop/tasks', { requestId: 'one' }, { timeoutMs: 50 })
    const check = expect(result).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(50)
    await check
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the deadline until a stalled body finishes', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => ({ ok: true,
      text: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) })))
    const check = expect(apiRequest('/api/jobs', { timeoutMs: 30 })).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(30)
    await check
  })

  it('cancels a request and cancels a retry backoff immediately', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockRejectedValue(new TypeError('network'))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const reason = new DOMException('cancelled', 'AbortError')
    const check = expect(apiRequest('/api/jobs', { signal: controller.signal })).rejects.toBe(reason)
    await vi.advanceTimersByTimeAsync(0)
    controller.abort(reason)
    await check
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retries transient reads but never 401 or writes', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ready":true}'))
    vi.stubGlobal('fetch', fetch)
    expect(await apiRequest('/api/jobs', { retryDelayMs: 0 })).toEqual({ ready: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    fetch.mockReset().mockResolvedValue(new Response('{"error":"signed out"}', { status: 401 }))
    await expect(apiRequest('/api/jobs')).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch.mockReset().mockResolvedValue(new Response('', { status: 503 }))
    await expect(apiPost('/api/desktop/tasks', {}, { retries: 2 })).rejects.toMatchObject({ status: 503 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('passes cancellation to blobs and omits JSON headers for uploads', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('pixels')).mockResolvedValueOnce(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    expect(await (await apiBlobRequest('/view')).text()).toBe('pixels')
    await apiPost('/upload/image', new FormData())
    expect(fetch.mock.calls[1][1].headers?.['Content-Type']).toBeUndefined()
  })
})
