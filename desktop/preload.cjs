const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vividDesktop', Object.freeze({
  windowState: () => ipcRenderer.invoke('window:state'),
  windowAction: action => ipcRenderer.invoke('window:action', action),
  onWindowState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window:state-changed', listener);
    return () => ipcRenderer.removeListener('window:state-changed', listener);
  },
  accountStatus: () => ipcRenderer.invoke('account:status'),
  accountLogin: input => ipcRenderer.invoke('account:login', input),
  accountRefresh: () => ipcRenderer.invoke('account:refresh'),
  accountLogout: () => ipcRenderer.invoke('account:logout'),
  accountResetPassword: () => ipcRenderer.invoke('account:reset-password'),
  accountRegister: () => ipcRenderer.invoke('account:register'),
  importGallery: () => ipcRenderer.invoke('gallery:import'),
  agentInfo: () => ipcRenderer.invoke('agent:info'),
  onAgentTask: callback => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on('agent:show-task', listener);
    return () => ipcRenderer.removeListener('agent:show-task', listener);
  },
  openOutput: () => ipcRenderer.invoke('output:open'),
  runtimeStatus: () => ipcRenderer.invoke('runtime:status'),
  runtimeCheck: () => ipcRenderer.invoke('runtime:check'),
  runtimeOpenDownload: provider => ipcRenderer.invoke('runtime:open-download', provider),
  clientOpenUpdate: () => ipcRenderer.invoke('client:open-update'),
  runtimeInstall: () => ipcRenderer.invoke('runtime:install'),
  runtimePause: () => ipcRenderer.invoke('runtime:pause'),
  runtimeImportArchive: () => ipcRenderer.invoke('runtime:import-archive'),
  runtimeConnectDirectory: () => ipcRenderer.invoke('runtime:connect-directory'),
  chooseRuntimeDirectory: () => ipcRenderer.invoke('runtime:choose-directory'),
  startEngine: () => ipcRenderer.invoke('runtime:start-engine')
}));
