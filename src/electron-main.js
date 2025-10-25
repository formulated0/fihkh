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

/**
 * Rename a file or directory
 */
ipcMain.handle('fs:rename', async (event, oldPath, newName) => {
  try {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    
    // Check if new name already exists
    try {
      await fs.access(newPath);
      return { success: false, error: 'A file or folder with that name already exists' };
    } catch {
      // Good, doesn't exist
    }
    
    await fs.rename(oldPath, newPath);
    return { success: true, newPath };
  } catch (error) {
    console.error('Error renaming:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Delete a file or directory
 */
ipcMain.handle('fs:delete', async (event, itemPath, isDirectory) => {
  try {
    if (isDirectory) {
      await fs.rm(itemPath, { recursive: true, force: true });
    } else {
      await fs.unlink(itemPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting:', error);
    return { success: false, error: error.message };
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================
// Copy/Move Helpers and IPC (Phase 2)
// ============================================
async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyEntry(src, dest, { overwrite = false } = {}) {
  // If destination exists
  if (await pathExists(dest)) {
    if (!overwrite) {
      throw new Error('Destination exists');
    }
    // Remove existing destination
    const st = await fs.stat(dest).catch(() => null);
    if (st) {
      if (st.isDirectory()) await fs.rm(dest, { recursive: true, force: true });
      else await fs.unlink(dest);
    }
  }
  // Prefer fs.cp (Node >=16.7)
  if (typeof fs.cp === 'function') {
    await fs.cp(src, dest, { recursive: true });
    return;
  }
  // Fallback: manual copy
  const stats = await fs.stat(src);
  if (stats.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) await copyEntry(s, d, { overwrite: false });
      else await fs.copyFile(s, d);
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

async function moveEntry(src, dest, { overwrite = false } = {}) {
  // If destination exists and overwrite requested, remove it first
  if (await pathExists(dest)) {
    if (!overwrite) {
      throw new Error('Destination exists');
    }
    const st = await fs.stat(dest).catch(() => null);
    if (st) {
      if (st.isDirectory()) await fs.rm(dest, { recursive: true, force: true });
      else await fs.unlink(dest);
    }
  }
  try {
    await fs.rename(src, dest);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      // Cross-device: copy then delete
      await copyEntry(src, dest, { overwrite: false });
      const st = await fs.stat(src);
      if (st.isDirectory()) await fs.rm(src, { recursive: true, force: true });
      else await fs.unlink(src);
    } else {
      throw err;
    }
  }
}

ipcMain.handle('fs:copyItems', async (event, items /* [{src, dest, overwrite?}] */) => {
  const results = [];
  for (const { src, dest, overwrite } of items) {
    try {
      await copyEntry(src, dest, { overwrite: !!overwrite });
      results.push({ src, dest, success: true });
    } catch (error) {
      results.push({ src, dest, success: false, error: error.message });
    }
  }
  const allOk = results.every(r => r.success);
  return { success: allOk, results };
});

ipcMain.handle('fs:moveItems', async (event, items /* [{src, dest, overwrite?}] */) => {
  const results = [];
  for (const { src, dest, overwrite } of items) {
    try {
      await moveEntry(src, dest, { overwrite: !!overwrite });
      results.push({ src, dest, success: true });
    } catch (error) {
      results.push({ src, dest, success: false, error: error.message });
    }
  }
  const allOk = results.every(r => r.success);
  return { success: allOk, results };
});

// Backward-compatible paste handler (routes to copy or move)
// Accepts either:
//  - payload: { op: 'copy'|'cut', items: [{src, dest, overwrite?}] }
//  - or (legacy) items array plus op string as second arg
ipcMain.handle('fs:pasteItems', async (event, payloadOrItems, opMaybe) => {
  try {
    let op;
    let items;
    if (Array.isArray(payloadOrItems)) {
      items = payloadOrItems;
      op = opMaybe || 'copy';
    } else if (payloadOrItems && typeof payloadOrItems === 'object') {
      op = payloadOrItems.op || 'copy';
      items = payloadOrItems.items || [];
    } else {
      return { success: false, error: 'Invalid arguments' };
    }

    if (op === 'cut' || op === 'move') {
      return await ipcMain.invoke('fs:moveItems', items);
    } else {
      return await ipcMain.invoke('fs:copyItems', items);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

console.log('Terminus main process started');