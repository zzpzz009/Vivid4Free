const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vividDesktop', Object.freeze({
  importGallery: () => ipcRenderer.invoke('gallery:import'),
  agentInfo: () => ipcRenderer.invoke('agent:info'),
  openOutput: () => ipcRenderer.invoke('output:open'),
  runtimeStatus: () => ipcRenderer.invoke('runtime:status'),
  runtimeCheck: () => ipcRenderer.invoke('runtime:check'),
  runtimeInstall: () => ipcRenderer.invoke('runtime:install'),
  runtimePause: () => ipcRenderer.invoke('runtime:pause'),
  chooseRuntimeDirectory: () => ipcRenderer.invoke('runtime:choose-directory'),
  startEngine: () => ipcRenderer.invoke('runtime:start-engine')
}));
