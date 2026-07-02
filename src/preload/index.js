const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ambulatorio', {
  transmit: (request) => ipcRenderer.invoke('batch:transmit', request),
  email: {
    getSettings: () => ipcRenderer.invoke('email:get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('email:save-settings', settings),
    getAuthStatus: () => ipcRenderer.invoke('email:get-auth-status'),
    connect: () => ipcRenderer.invoke('email:connect'),
    cancelConnect: () => ipcRenderer.invoke('email:cancel-connect'),
    disconnect: () => ipcRenderer.invoke('email:disconnect'),
    sendTest: () => ipcRenderer.invoke('email:send-test')
  }
});
