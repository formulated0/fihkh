import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    frame: false,
    titleBarStyle: 'hidden'
  });

  // Load from Vite dev server in development, or built files in production
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

// ============================================
// IPC HANDLERS - File System Operations
// ============================================

/**
 * Read directory contents
 * Returns array of file/folder objects with metadata
 */
ipcMain.handle('fs:readDir', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime,
            permissions: stats.mode
          };
        } catch (err) {
          // Handle permission errors gracefully
          console.error(`Error reading ${fullPath}:`, err);
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size: 0,
            modified: null,
            created: null,
            permissions: null,
            error: 'Permission denied'
          };
        }
      })
    );

    return { success: true, items };
  } catch (error) {
    console.error('Error reading directory:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get file/directory stats
 */
ipcMain.handle('fs:stat', async (event, itemPath) => {
  try {
    const stats = await fs.stat(itemPath);
    return {
      success: true,
      stats: {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: stats.mode
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Read file contents (for preview)
 */
ipcMain.handle('fs:readFile', async (event, filePath, encoding = 'utf8') => {
  try {
    const content = await fs.readFile(filePath, encoding);
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Get home directory path
 */
ipcMain.handle('fs:getHomeDir', async () => {
  return { success: true, path: app.getPath('home') };
});

/**
 * Check if path exists
 */
ipcMain.handle('fs:exists', async (event, itemPath) => {
  try {
    await fs.access(itemPath);
    return { success: true, exists: true };
  } catch {
    return { success: true, exists: false };
  }
});

/**
 * Get storage devices (Linux-specific for now)
 */
ipcMain.handle('fs:getDevices', async () => {
  try {
    const devices = [];
    
    // On Linux, check /proc/mounts
    if (process.platform === 'linux') {
      try {
        const mounts = await fs.readFile('/proc/mounts', 'utf8');
        const lines = mounts.split('\n');
        const seenMounts = new Set();
        
        for (const line of lines) {
          const parts = line.split(' ');
          if (parts.length < 2) continue;
          
          const device = parts[0];
          const mountPoint = parts[1];
          
          // Filter for actual disk devices and avoid duplicates
          if ((device.startsWith('/dev/sd') || device.startsWith('/dev/nvme') || device.startsWith('/dev/mmcblk')) 
              && !seenMounts.has(mountPoint)
              && mountPoint !== '/boot'
              && mountPoint !== '/boot/efi') {
            seenMounts.add(mountPoint);
            
            devices.push({
              name: path.basename(device),
              device: device,
              mountPoint: mountPoint,
              total: 'N/A',
              used: 'N/A',
              free: 'N/A',
              icon: mountPoint === '/' ? '💿' : '💾'
            });
          }
        }
      } catch (readError) {
        console.error('Error reading /proc/mounts:', readError);
      }
    }
    
    return { success: true, devices };
  } catch (error) {
    console.error('Error getting devices:', error);
    return { success: true, devices: [] };
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

console.log('Terminus main process started');