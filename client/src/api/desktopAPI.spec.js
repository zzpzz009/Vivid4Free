import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopAPI } from './desktopAPI.js'

vi.mock('@/utils/toast.js', () => ({ warning: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

describe('desktop HTTP operations', () => {
  it('encodes task identifiers and input filenames without adding paths or query fields', async () => {
    const fetch = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    const id = '中文/task ?#&'
    await desktopAPI.getTask(id)
    await desktopAPI.cancelTask(id)
    expect(fetch.mock.calls[0][0]).toBe(`/api/desktop/tasks/${encodeURIComponent(id)}`)
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'GET', cache: 'no-store' })
    expect(fetch.mock.calls[1][0]).toBe(`/api/desktop/tasks/${encodeURIComponent(id)}/cancel`)
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST' })
    const url = new URL(desktopAPI.inputImageUrl('图/a &b.png'), 'http://localhost')
    expect([...url.searchParams]).toEqual([['filename', '图/a &b.png'], ['type', 'input']])
  })

  it('preserves requestId and parameters and never retries a submission or cancellation', async () => {
    const fetch = vi.fn(async () => new Response('{"error":"temporarily unavailable"}', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const parameters = { requestId: 'one-request', mainImage: 'main.png', kind: 'render', seed: 7, mirror: false }
    await expect(desktopAPI.submitTask(parameters, { retries: 2 })).rejects.toMatchObject({ status: 503 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(parameters)
    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json')
    await expect(desktopAPI.cancelTask('task-1', { retries: 2 })).rejects.toMatchObject({ status: 503 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('retries transient reads through the shared helper', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response('{"tasks":[]}'))
      .mockResolvedValueOnce(new Response('{"capabilities":{}}'))
    vi.stubGlobal('fetch', fetch)
    expect(await desktopAPI.listTasks({ retryDelayMs: 0 })).toEqual({ tasks: [] })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await desktopAPI.capabilities()).toEqual({ capabilities: {} })
    expect(fetch.mock.calls[2][0]).toBe('/api/desktop/capabilities')
  })

  it.each([
    options => desktopAPI.capabilities(options),
    options => desktopAPI.listTasks(options),
    options => desktopAPI.getTask('task-1', options),
    options => desktopAPI.submitTask({ requestId: 'one-request' }, options),
    options => desktopAPI.cancelTask('task-1', options)
  ])('propagates caller cancellation without replaying an operation', async operation => {
    const fetch = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const reason = new DOMException('scope disposed', 'AbortError')
    const pending = operation({ signal: controller.signal })
    controller.abort(reason)
    await expect(pending).rejects.toBe(reason)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  })
})
