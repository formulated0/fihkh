const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose protected methods that allow the renderer process to use
 * ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // File System Operations
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  stat: (itemPath) => ipcRenderer.invoke('fs:stat', itemPath),
  readFile: (filePath, encoding) => ipcRenderer.invoke('fs:readFile', filePath, encoding),
  getHomeDir: () => ipcRenderer.invoke('fs:getHomeDir'),
  exists: (itemPath) => ipcRenderer.invoke('fs:exists', itemPath),
  
  // Platform info
  platform: process.platform
});

console.log('Preload script loaded');