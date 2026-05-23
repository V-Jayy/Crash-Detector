const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crashDetector", {
  scan: (options) => ipcRenderer.invoke("scan-crashes", options),
  getGames: () => ipcRenderer.invoke("get-games"),
  detectGames: () => ipcRenderer.invoke("detect-games"),
  pickExecutable: () => ipcRenderer.invoke("pick-executable"),
  exportReport: (payload) => ipcRenderer.invoke("export-report", payload),
  windowControl: (action) => ipcRenderer.invoke("window-control", action)
});
