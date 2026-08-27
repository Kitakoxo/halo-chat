const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  serverUrl: 'http://127.0.0.1:3020',
  notify: (payload) => ipcRenderer.invoke('desktop:notify', payload),
  showWindow: () => ipcRenderer.invoke('desktop:show-window'),
});

