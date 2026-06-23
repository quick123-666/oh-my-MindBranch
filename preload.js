// 预加载脚本 - 安全地暴露 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  saveJson: (content) => ipcRenderer.invoke('file:save-json', content),
  openJson: () => ipcRenderer.invoke('file:open-json'),
  savePng: (dataUrl) => ipcRenderer.invoke('file:save-png', dataUrl),

  // 文件夹操作
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:show-item', filePath),
  openPath: (dirPath) => ipcRenderer.invoke('shell:open-path', dirPath),

  // Markdown 导出
  saveMd: (content) => ipcRenderer.invoke('file:save-md', content),

  // Markdown 导入
  openMd: () => ipcRenderer.invoke('file:open-md'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read-text'),

  // 菜单事件监听
  onMenu: (channel, callback) => {
    const validChannels = [
      'menu:new',
      'menu:open',
      'menu:save',
      'menu:import-md',
      'menu:import-md-clipboard',
      'menu:export-png',
      'menu:export-md',
      'menu:open-export-menu',
      'menu:show-in-folder',
      'menu:open-data-folder',
      'menu:undo',
      'menu:redo',
      'menu:reset-view',
      'menu:zoom-in',
      'menu:zoom-out',
      'menu:layout'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  }
});