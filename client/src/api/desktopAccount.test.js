import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopAccount, safeSnapshot } from './desktopAccount.js'

afterEach(() => vi.unstubAllGlobals())

describe('desktop account bridge', () => {
  it('keeps only the documented status fields and excludes credentials', () => {
    expect(safeSnapshot({ status: 'signed_in', profile: { username: 'user' }, token: 'secret', virtualKeys: ['secret'] })).toEqual({
      status: 'signed_in', profile: { username: 'user' }, persistent: false, message: '', retryAfterSeconds: 0, lastCheckedAt: null
    })
  })

  it('forwards credentials only to the login bridge and returns a sanitized snapshot', async () => {
    const accountLogin = vi.fn().mockResolvedValue({ status: 'signed_out', message: '账号或密码不正确', token: 'secret' })
    vi.stubGlobal('window', { vividDesktop: { accountLogin } })
    const credentials = { username: 'someone', password: 'one-time-secret' }
    const result = await desktopAccount.login(credentials)
    expect(accountLogin).toHaveBeenCalledWith(credentials)
    expect(result).toMatchObject({ status: 'signed_out', message: '账号或密码不正确' })
    expect(result).not.toHaveProperty('token')
  })

  it('fails closed when the desktop bridge is unavailable', async () => {
    vi.stubGlobal('window', {})
    expect(await desktopAccount.status()).toMatchObject({ status: 'unavailable' })
  })

  it('opens registration through the native bridge without returning an auth URL or changing auth state', async () => {
    const accountRegister = vi.fn().mockResolvedValue({ opened: true, message: '注册页面已打开', redirectUrl: 'private-state', token: 'secret' })
    vi.stubGlobal('window', { vividDesktop: { accountRegister } })
    expect(await desktopAccount.register()).toEqual({ opened: true, message: '注册页面已打开' })
    expect(accountRegister).toHaveBeenCalledWith()
  })

  it('returns a registration action error if native opening is absent or fails', async () => {
    vi.stubGlobal('window', {})
    expect(await desktopAccount.register()).toMatchObject({ opened: false })
    vi.stubGlobal('window', { vividDesktop: { accountRegister: vi.fn().mockRejectedValue(new Error('private-provider-error')) } })
    const result = await desktopAccount.register()
    expect(result.opened).toBe(false)
    expect(result.message).not.toContain('private-provider-error')
  })
})
