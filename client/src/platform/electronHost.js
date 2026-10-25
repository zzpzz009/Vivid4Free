// This is the only renderer module that knows the Electron preload global.
// Resolve it per call so late injection and test bridge replacement both work.
const getElectronBridge = () => typeof window === 'undefined' ? null : window.vividDesktop

export function createElectronHost(getBridge = getElectronBridge) {
  async function call(method, ...args) {
    const bridge = getBridge()
    if (typeof bridge?.[method] !== 'function') {
      const error = new Error(`Desktop host operation unavailable: ${method}`)
      error.code = 'HOST_UNAVAILABLE'
      throw error
    }
    return bridge[method](...args)
  }

  function subscribe(method, callback) {
    const bridge = getBridge()
    if (typeof bridge?.[method] !== 'function') return () => {}
    let active = true
    const unsubscribe = bridge[method](payload => { if (active) callback(payload) })
    return () => {
      if (!active) return
      active = false
      unsubscribe?.()
    }
  }

  const operations = {
    windowState: () => call('windowState'),
    windowAction: action => call('windowAction', action),
    accountStatus: () => call('accountStatus'),
    accountLogin: input => call('accountLogin', input),
    accountRefresh: () => call('accountRefresh'),
    accountLogout: () => call('accountLogout'),
    accountResetPassword: () => call('accountResetPassword'),
    accountRegister: () => call('accountRegister'),
    enterWorkspace: () => call('enterWorkspace'),
    importGallery: () => call('importGallery'),
    agentInfo: () => call('agentInfo'),
    openOutput: () => call('openOutput'),
    runtimeStatus: () => call('runtimeStatus'),
    runtimeCheck: () => call('runtimeCheck'),
    runtimeOpenDownload: provider => call('runtimeOpenDownload', provider),
    clientOpenUpdate: () => call('clientOpenUpdate'),
    runtimeInstall: () => call('runtimeInstall'),
    runtimePause: () => call('runtimePause'),
    runtimeImportArchive: () => call('runtimeImportArchive'),
    runtimeConnectDirectory: () => call('runtimeConnectDirectory'),
    chooseRuntimeDirectory: () => call('chooseRuntimeDirectory'),
    startEngine: () => call('startEngine'),
    onWindowState: callback => subscribe('onWindowState', callback),
    onAgentTask: callback => subscribe('onAgentTask', callback)
  }
  return Object.freeze({
    ...operations,
    supports: method => Object.hasOwn(operations, method) && typeof getBridge()?.[method] === 'function'
  })
}
