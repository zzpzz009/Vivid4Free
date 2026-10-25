import { host } from '@/platform/host.js'

const STATUSES = new Set(['signed_out', 'checking', 'signed_in', 'unavailable'])
const PROFILE_FIELDS = ['userId', 'id', 'username', 'displayName', 'nickname', 'avatarUrl', 'emailMasked', 'role', 'companyName']

function safeProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return Object.fromEntries(PROFILE_FIELDS
    .filter((key) => typeof value[key] === 'string' || typeof value[key] === 'number')
    .map((key) => [key, value[key]]))
}

function safeSnapshot(value) {
  if (!value || typeof value !== 'object') return null
  return {
    status: STATUSES.has(value.status) ? value.status : 'unavailable',
    profile: safeProfile(value.profile),
    persistent: value.persistent === true,
    message: typeof value.message === 'string' ? value.message : '',
    retryAfterSeconds: Number.isFinite(value.retryAfterSeconds) ? Math.max(0, value.retryAfterSeconds) : 0,
    lastCheckedAt: typeof value.lastCheckedAt === 'string' ? value.lastCheckedAt : null
  }
}

async function invoke(method, ...args) {
  if (!host.supports(method)) {
    return method === 'accountRegister' ? { opened: false, message: '桌面账号服务暂不可用，请稍后重试。' }
      : safeSnapshot({ status: 'unavailable', message: '桌面账号服务暂不可用，请稍后重试。' })
  }
  try {
    const result = await host[method](...args)
    if (method === 'accountResetPassword' || method === 'accountRegister') {
      return result?.opened === true
        ? { opened: true, ...(typeof result.message === 'string' ? { message: result.message } : {}) }
        : { opened: false, message: typeof result?.message === 'string' ? result.message : '暂时无法打开账号页面。' }
    }
    return safeSnapshot(result)
  } catch {
    return method === 'accountRegister' ? { opened: false, message: '账号服务暂时不可用，请稍后重试。' }
      : safeSnapshot({ status: 'unavailable', message: '账号服务暂时不可用，请稍后重试。' })
  }
}

export const desktopAccount = {
  status: () => invoke('accountStatus'),
  login: (credentials) => invoke('accountLogin', credentials),
  refresh: () => invoke('accountRefresh'),
  logout: () => invoke('accountLogout'),
  resetPassword: () => invoke('accountResetPassword'),
  register: () => invoke('accountRegister')
}

export { safeSnapshot }
