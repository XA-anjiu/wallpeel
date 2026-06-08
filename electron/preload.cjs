const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('weExtractor', {
  // 原有接口
  selectFile: () => ipcRenderer.invoke('dialog:selectFile'),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  startExtract: (payload) => ipcRenderer.invoke('extract:start', payload),
  onExtractLog: (callback) => {
    ipcRenderer.removeAllListeners('extract:log')
    ipcRenderer.on('extract:log', (_event, log) => callback(log))
  },

  // 扫描壁纸目录 & 获取预览图 & 打开本地目录 & 复制图片 & 自动搜索
  scanWallpapers: (dirPath) => ipcRenderer.invoke('wallpaper:scan', dirPath),
  getPreviewImage: (wallpaperDirPath) => ipcRenderer.invoke('wallpaper:preview', wallpaperDirPath),
  openWallpaperDir: (filePath) => ipcRenderer.invoke('wallpaper:openDir', filePath),
  cleanupWallpaperDir: (wpDir) => ipcRenderer.invoke('wallpaper:cleanup', wpDir),
  copyImageToClipboard: (imagePath) => ipcRenderer.invoke('clipboard:copyImage', imagePath),
  autoFindWallpaperDir: () => ipcRenderer.invoke('wallpaper:autoFind'),

  // 批量操作
  batchCopy: (payload) => ipcRenderer.invoke('batch:copy', payload),
  batchExtractPKG: (payload) => ipcRenderer.invoke('batch:extractPKG', payload),

  // MPKG 管理
  scanMPKG: (payload) => ipcRenderer.invoke('mpkg:scan', payload),
  copyMPKG: (payload) => ipcRenderer.invoke('mpkg:copy', payload),
  extractMPKG: (payload) => ipcRenderer.invoke('mpkg:extract', payload),

  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
})
