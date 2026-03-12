const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Zoom
  setZoom: (factor) => ipcRenderer.invoke('set-zoom', factor),

  // Store
  storeGet: (key, defaultVal) => ipcRenderer.invoke('store-get', key, defaultVal),
  storeSet: (key, val) => ipcRenderer.invoke('store-set', key, val),
  storeDelete: (key) => ipcRenderer.invoke('store-delete', key),

  // File parsing
  parseFile: (filePath) => ipcRenderer.invoke('parse-file', filePath),
  dialogOpenFiles: () => ipcRenderer.invoke('dialog-open-files'),

  // Presets
  loadPresets: () => ipcRenderer.invoke('load-presets'),
  savePreset: (preset) => ipcRenderer.invoke('save-preset', preset),
  openPresetsFolder: () => ipcRenderer.invoke('open-presets-folder'),

  // Output
  getOutputFolder: () => ipcRenderer.invoke('get-output-folder'),
  changeOutputFolder: () => ipcRenderer.invoke('change-output-folder'),
  openOutputFolder: (path) => ipcRenderer.invoke('open-output-folder', path),
  saveOutputFile: (folder, name, content) => ipcRenderer.invoke('save-output-file', folder, name, content),
  createRunFolder: () => ipcRenderer.invoke('create-run-folder'),
  readOutputFiles: (folderPath) => ipcRenderer.invoke('read-output-files', folderPath),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Inference
  runInference: (params) => ipcRenderer.invoke('run-inference', params),
  onStreamChunk: (requestId, callback) => {
    const channel = `stream-chunk-${requestId}`;
    const handler = (_, chunk) => callback(chunk);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  // Stop controls
  stopRun: () => ipcRenderer.send('stop-run'),
  resetStop: () => ipcRenderer.send('reset-stop'),
  checkStopRequested: () => ipcRenderer.invoke('check-stop-requested'),
});
