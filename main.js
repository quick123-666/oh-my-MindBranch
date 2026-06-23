// Electron 主进程入口
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '思维导图',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    backgroundColor: '#fafafa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 构建应用菜单
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:new')
        },
        {
          label: '打开 JSON...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:open')
        },
        {
          label: '导入 Markdown 文章...',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow.webContents.send('menu:import-md')
        },
        {
          label: '从剪贴板导入...',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow.webContents.send('menu:import-md-clipboard')
        },
        {
          label: '保存为 JSON...',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save')
        },
        { type: 'separator' },
        {
          label: '导出为 PNG...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu:open-export-menu')
        },
        {
          label: '导出为 Markdown...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow.webContents.send('menu:open-export-menu')
        },
        { type: 'separator' },
        {
          label: '在文件管理器中显示',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow.webContents.send('menu:show-in-folder')
        },
        {
          label: '打开应用数据文件夹',
          click: () => {
            // 应用数据目录：用户配置/缓存等
            shell.openPath(app.getPath('userData'));
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu:undo')
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu:redo')
        },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重置视图',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu:reset-view')
        },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow.webContents.send('menu:zoom-in')
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu:zoom-out')
        },
        { type: 'separator' },
        {
          label: '重新布局',
          accelerator: 'CmdOrCtrl+L',
          click: () => mainWindow.webContents.send('menu:layout')
        },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '思维导图',
              detail: '一个基于 Electron 的现代简洁思维导图工具。\n\n快捷键:\nTab - 添加子节点\nEnter - 添加兄弟节点\nDelete - 删除节点\nF2 - 编辑节点\nCtrl+Z/Y - 撤销/重做'
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: 保存 JSON 文件
ipcMain.handle('file:save-json', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存为 JSON',
    defaultPath: 'mindmap.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: 打开 JSON 文件
ipcMain.handle('file:open-json', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 JSON',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths.length) {
    return { success: false, canceled: true };
  }
  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    return { success: true, content, filePath: result.filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: 保存 PNG 文件
ipcMain.handle('file:save-png', async (event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出为 PNG',
    defaultPath: 'mindmap.png',
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  });
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: 保存 Markdown 文件
ipcMain.handle('file:save-md', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出为 Markdown',
    defaultPath: 'mindmap.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: '文本文件', extensions: ['txt'] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  try {
    // 确保内容以换行结尾
    const text = content.endsWith('\n') ? content : content + '\n';
    fs.writeFileSync(result.filePath, text, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: 打开 Markdown 文件（用于 MD 导入）
ipcMain.handle('file:open-md', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths.length) {
    return { success: false, canceled: true };
  }
  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    return { success: true, content, filePath: result.filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: 读取剪贴板内容（用于 MD 导入）
ipcMain.handle('clipboard:read-text', async () => {
  try {
    const { clipboard } = require('electron');
    const text = clipboard.readText() || '';
    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: 在文件管理器中显示文件（高亮选中）
ipcMain.handle('shell:show-item', async (event, filePath) => {
  if (!filePath) return { success: false, error: '路径为空' };
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在: ' + filePath };
    }
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: 打开文件夹（不选中文件）
ipcMain.handle('shell:open-path', async (event, dirPath) => {
  if (!dirPath) return { success: false, error: '路径为空' };
  try {
    // 如果是文件路径，取其目录
    let target = dirPath;
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isFile()) {
      target = path.dirname(dirPath);
    }
    const errMsg = await shell.openPath(target);
    if (errMsg) return { success: false, error: errMsg };
    return { success: true, path: target };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 应用启动
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});