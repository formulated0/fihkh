<script>
  import { onMount } from 'svelte';
  import path from 'path-browserify';
  import Sidebar from './components/Sidebar.svelte';
  import FileList from './components/FileList.svelte';
  import PaneResizer from './components/PaneResizer.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import KeybindsBar from './components/KeybindsBar.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  
  let currentPath = '';
  let items = [];
  let selectedIndex = 0;
  let loading = true;
  let error = null;
  let mode = 'NORMAL';

  // Navigation history
  let history = [];
  let historyIndex = -1;
  let rememberIndex = {}; // Remember selected index for each directory

  // Rename state
  let renamingIndex = -1;
  let renameValue = '';
  let originalName = '';

  // Delete confirmation
  let showDeleteDialog = false;
  let deleteTarget = null;

  // Pane widths (in pixels)
  let sidebarWidth = 200;
  let previewWidth = 400;

  // Clipboard state for Cut/Copy/Paste (single item for now)
  let clipboard = null; // { op: 'copy'|'cut', entry: { path, name, isDirectory }, sourceDir: string }
  let cutMarkedPaths = new Set();

  // Minimal status feedback (shown in StatusBar)
  let statusMessage = '';
  let statusTimer = null;
  function setStatus(message, ms = 2000) {
    statusMessage = message;
    if (statusTimer) {
      clearTimeout(statusTimer);
    }
    if (ms > 0) {
      statusTimer = setTimeout(() => {
        statusMessage = '';
        statusTimer = null;
      }, ms);
    }
  }

  // Overwrite confirmation dialog (reuses ConfirmDialog)
  let showOverwriteDialog = false;
  let overwriteMessage = '';
  let pendingPaste = null; // function to run on confirm

  onMount(async () => {
    // Get home directory on startup
    const homeResult = await window.electronAPI.getHomeDir();
    if (homeResult.success) {
      currentPath = homeResult.path;
      await loadDirectory(currentPath, true);
    } else {
      error = 'Failed to get home directory';
      loading = false;
    }
  });

  async function loadDirectory(dirPath, addToHistory = true) {
    loading = true;
    error = null;

    const result = await window.electronAPI.readDir(dirPath);

    if (result.success) {
      // Sort: directories first, then files, alphabetically
      items = result.items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      // Restore remembered position or default to 0
      selectedIndex = rememberIndex[dirPath] ?? 0;
      if (selectedIndex >= items.length) selectedIndex = 0;

      const oldPath = currentPath;
      currentPath = dirPath;

      // Update history
      if (addToHistory) {
        // Remove any forward history
        history = history.slice(0, historyIndex + 1);
        history.push(dirPath);
        historyIndex = history.length - 1;
      }
    } else {
      error = result.error;
      items = [];
    }

    loading = false;
  }

  function handleKeyDown(event) {
    // In INSERT mode, only handle Escape
    if (mode === 'INSERT') {
      if (event.key === 'Escape') {
        cancelRename();
      }
      return;
    }

    // Escape in NORMAL mode: cancel pending cut, if any
    if (event.key === 'Escape') {
      if (clipboard && clipboard.op === 'cut') {
        event.preventDefault();
        clipboard = null;
        cutMarkedPaths = new Set();
        setStatus('Cut cancelled');
        return;
      }
      // If no pending cut, let Esc fall through (currently no other action in NORMAL)
    }

    // Normalize ctrl combinations for CCP
    const isCtrlC = (event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey);
    const isCtrlX = (event.key === 'x' || event.key === 'X') && (event.ctrlKey || event.metaKey);
    const isCtrlV = (event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey);

    // CCP keybinds (both single keys and Ctrl variants)
    if (event.key === 'c' || event.key === 'C' || isCtrlC) {
      event.preventDefault();
      startCopy();
      return;
    }
    if (event.key === 'x' || event.key === 'X' || isCtrlX) {
      event.preventDefault();
      startCut();
      return;
    }
    if (event.key === 'p' || event.key === 'P' || isCtrlV) {
      event.preventDefault();
      pasteClipboard();
      return;
    }

    // In NORMAL mode
    switch(event.key) {
      // Navigation: j/k or Arrow keys
      case 'j':
      case 'ArrowDown':
        event.preventDefault();
        if (selectedIndex < items.length - 1) {
          selectedIndex++;
          rememberIndex[currentPath] = selectedIndex;
        }
        break;
      
      case 'k':
      case 'ArrowUp':
        event.preventDefault();
        if (selectedIndex > 0) {
          selectedIndex--;
          rememberIndex[currentPath] = selectedIndex;
        }
        break;
      
      // Enter directory or go up: l/h or Arrow keys
      case 'l':
      case 'ArrowRight':
      case 'Enter':
        event.preventDefault();
        if (items[selectedIndex]) {
          if (items[selectedIndex].isDirectory) {
            loadDirectory(items[selectedIndex].path, true);
          } else {
            // TODO: Open file
            console.log('Open file:', items[selectedIndex].path);
          }
        }
        break;
      
      case 'h':
      case 'ArrowLeft':
        event.preventDefault();
        goToParentDirectory();
        break;
      
      // Jump to bottom
      case 'G':
        event.preventDefault();
        selectedIndex = items.length - 1;
        rememberIndex[currentPath] = selectedIndex;
        break;
      
      // Rename
      case 'i':
        event.preventDefault();
        startRename();
        break;
      
      case 'F2':
        event.preventDefault();
        startRename();
        break;
      
      // Delete
      case 'd':
      case 'Delete':
        event.preventDefault();
        startDelete();
        break;
    }
  }

  // ======== CCP Helpers & Actions ========
  function parseNameParts(name) {
    const lastDot = name.lastIndexOf('.');
    if (lastDot > 0 && lastDot !== name.length - 1) {
      return { base: name.slice(0, lastDot), ext: name.slice(lastDot) };
    }
    return { base: name, ext: '' };
  }

  async function uniqueCopyName(dir, originalName) {
    // Always start with "name 1" as per spec
    const { base, ext } = parseNameParts(originalName);
    let n = 1;
    while (true) {
      const candidate = `${base} ${n}${ext}`;
      const candidatePath = path.join(dir, candidate);
      const existsRes = await window.electronAPI.exists(candidatePath);
      if (!existsRes.success || !existsRes.exists) return candidate;
      n++;
    }
  }

  function startCopy() {
    const entry = items[selectedIndex];
    if (!entry) return;
    clipboard = { op: 'copy', entry, sourceDir: currentPath };
    // Clear visual cut marks if switching op
    cutMarkedPaths = new Set();
    setStatus(`Copied: ${entry.name}`);
  }

  function startCut() {
    const entry = items[selectedIndex];
    if (!entry) return;
    clipboard = { op: 'cut', entry, sourceDir: currentPath };
    cutMarkedPaths = new Set([entry.path]);
    setStatus(`Cut: ${entry.name} (Esc to cancel)`);
  }

  async function pasteClipboard() {
    if (!clipboard) return;
    const entry = clipboard.entry;
    const destDir = currentPath;

    // Same-dir cut to same name is a no-op
    if (clipboard.op === 'cut' && destDir === clipboard.sourceDir) {
      // nothing to do
      clipboard = null;
      cutMarkedPaths = new Set();
      return;
    }

    let targetName = entry.name;
    if (clipboard.op === 'copy' && destDir === clipboard.sourceDir) {
      targetName = await uniqueCopyName(destDir, entry.name);
    }

    let destPath = path.join(destDir, targetName);

    // Check conflicts (for different dir, or copy same dir edge cases already handled)
    const existsRes = await window.electronAPI.exists(destPath);
    if (existsRes.success && existsRes.exists) {
      // Ask to overwrite
      overwriteMessage = `An item named "${targetName}" already exists here. Overwrite?`;
      pendingPaste = async () => {
        await doPaste(destPath, true);
      };
      showOverwriteDialog = true;
      return;
    }

    await doPaste(destPath, false);
  }

  async function doPaste(destPath, overwrite) {
    const entry = clipboard?.entry;
    if (!entry) return;
    try {
      const api = window.electronAPI || {};
      if (clipboard.op === 'cut') {
        let res;
        if (typeof api.moveItems === 'function') {
          res = await api.moveItems([{ src: entry.path, dest: destPath, overwrite }]);
        } else if (typeof api.pasteItems === 'function') {
          // Backward-compat shim: route via pasteItems with op 'cut'
          res = await api.pasteItems([{ src: entry.path, dest: destPath, overwrite }], 'cut');
        } else {
          throw new Error('Paste failed: backend move API not available');
        }
        if (!res?.success) throw new Error(res?.results?.[0]?.error || 'Move failed');
      } else {
        let res;
        if (typeof api.copyItems === 'function') {
          res = await api.copyItems([{ src: entry.path, dest: destPath, overwrite }]);
        } else if (typeof api.pasteItems === 'function') {
          // Backward-compat shim: route via pasteItems with op 'copy'
          res = await api.pasteItems([{ src: entry.path, dest: destPath, overwrite }], 'copy');
        } else {
          throw new Error('Paste failed: backend copy API not available');
        }
        if (!res?.success) throw new Error(res?.results?.[0]?.error || 'Copy failed');
      }

      // Reload destination dir and select pasted item
      await loadDirectory(currentPath, false);
      const pastedIndex = items.findIndex(i => i.path === destPath);
      if (pastedIndex !== -1) {
        selectedIndex = pastedIndex;
        rememberIndex[currentPath] = pastedIndex;
      }

      // Clear clipboard and visual marks
      clipboard = null;
      cutMarkedPaths = new Set();

      // Minimal feedback after paste
      setStatus(`Pasted: ${path.basename(destPath)}`);
    } catch (e) {
      console.error('Paste failed:', e);
      alert(`Paste failed: ${e.message}`);
    }
  }

  function goToParentDirectory() {
    if (currentPath === '/') return; // Already at root
    
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    const currentFolderName = currentPath.split('/').pop();
    
    // Remember to highlight the folder we just came from
    loadDirectory(parentPath, true).then(() => {
      // Find the folder we just exited and select it
      const folderIndex = items.findIndex(item => item.name === currentFolderName);
      if (folderIndex !== -1) {
        selectedIndex = folderIndex;
        rememberIndex[parentPath] = folderIndex;
      }
    });
  }

  function handleSelect(index) {
    selectedIndex = index;
    rememberIndex[currentPath] = index;
  }

  function handleNavigate(newPath) {
    loadDirectory(newPath, true);
  }

  function navigateBack() {
    if (historyIndex > 0) {
      historyIndex--;
      loadDirectory(history[historyIndex], false);
    }
  }

  function navigateForward() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      loadDirectory(history[historyIndex], false);
    }
  }

  // Rename functions
  function startRename() {
    if (items[selectedIndex]) {
      renamingIndex = selectedIndex;
      originalName = items[selectedIndex].name;
      renameValue = originalName;
      mode = 'INSERT';
    }
  }

  function handleRenameChange(newValue) {
    renameValue = newValue;
  }

  async function submitRename() {
    if (!renameValue || renameValue === originalName) {
      cancelRename();
      return;
    }

    const item = items[renamingIndex];
    const result = await window.electronAPI.rename(item.path, renameValue);

    if (result.success) {
      // Reload directory to show changes
      await loadDirectory(currentPath, false);
      // Find and select the renamed item
      const newIndex = items.findIndex(i => i.path === result.newPath);
      if (newIndex !== -1) {
        selectedIndex = newIndex;
        rememberIndex[currentPath] = newIndex;
      }
    } else {
      // Show error (for now, just log it)
      console.error('Rename failed:', result.error);
      alert(`Failed to rename: ${result.error}`);
    }

    cancelRename();
  }

  function cancelRename() {
    renamingIndex = -1;
    renameValue = '';
    originalName = '';
    mode = 'NORMAL';
  }

  // Delete functions
  function startDelete() {
    if (items[selectedIndex]) {
      deleteTarget = items[selectedIndex];
      showDeleteDialog = true;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const result = await window.electronAPI.delete(deleteTarget.path, deleteTarget.isDirectory);

    if (result.success) {
      // Reload directory
      await loadDirectory(currentPath, false);
      // Adjust selection if needed
      if (selectedIndex >= items.length) {
        selectedIndex = items.length - 1;
      }
      if (selectedIndex < 0) selectedIndex = 0;
      rememberIndex[currentPath] = selectedIndex;
    } else {
      console.error('Delete failed:', result.error);
      alert(`Failed to delete: ${result.error}`);
    }

    cancelDelete();
  }

  function cancelDelete() {
    showDeleteDialog = false;
    deleteTarget = null;
  }

  // Overwrite dialog handlers
  async function confirmOverwrite() {
    showOverwriteDialog = false;
    if (pendingPaste) {
      const fn = pendingPaste;
      pendingPaste = null;
      await fn();
    }
  }

  function cancelOverwrite() {
    showOverwriteDialog = false;
    pendingPaste = null;
  }

  function handleSidebarResize(event) {
    const newWidth = event.detail.clientX;
    if (newWidth >= 150 && newWidth <= 400) {
      sidebarWidth = newWidth;
    }
  }

  function handlePreviewResize(event) {
    const containerWidth = window.innerWidth;
    const newWidth = containerWidth - event.detail.clientX;
    if (newWidth >= 250 && newWidth <= 800) {
      previewWidth = newWidth;
    }
  }

  $: canGoBack = historyIndex > 0;
  $: canGoForward = historyIndex < history.length - 1;
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="flex flex-col h-screen w-screen">
  <!-- Header / Breadcrumb -->
  <div class="tui-border-bright bg-terminal-bg-light px-4 py-2 flex items-center justify-between no-select">
    <div class="flex items-center gap-3">
      <!-- Navigation arrows -->
      <div class="flex items-center gap-1">
        <button
          class="nav-arrow"
          class:disabled={!canGoBack}
          on:click={navigateBack}
          disabled={!canGoBack}
          title="Back"
          tabindex="-1"
        >
          ◀
        </button>
        <button
          class="nav-arrow"
          class:disabled={!canGoForward}
          on:click={navigateForward}
          disabled={!canGoForward}
          title="Forward"
          tabindex="-1"
        >
          ▶
        </button>
      </div>
      
      <!-- Separator -->
      <div class="text-terminal-border">│</div>
      
      <!-- Path -->
      <div class="text-terminal-accent font-bold">
        <span class="text-terminal-fg-dim">❯</span> {currentPath || 'Loading...'}
      </div>
    </div>
    
    <div class="text-terminal-fg-dim text-tui-sm">
      🔍 Search
    </div>
  </div>

  <!-- Main Content Area -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Sidebar (Shortcuts & Devices) -->
    <div style="width: {sidebarWidth}px;" class="tui-border-bright flex-shrink-0">
      <Sidebar onNavigate={handleNavigate} {currentPath} />
    </div>

    <!-- Resizer between sidebar and file list -->
    <PaneResizer on:resize={handleSidebarResize} />

    <!-- File List Pane -->
    <div class="flex-1 flex flex-col tui-border-bright min-w-0">
      {#if loading}
        <div class="flex-1 flex items-center justify-center text-terminal-fg-dim">
          Loading...
        </div>
      {:else if error}
        <div class="flex-1 flex items-center justify-center text-terminal-error">
          Error: {error}
        </div>
      {:else}
        <FileList 
          {items} 
          {selectedIndex}
          {renamingIndex}
          {renameValue}
          onNavigate={handleNavigate}
          onSelect={handleSelect}
          onRenameChange={handleRenameChange}
          onRenameSubmit={submitRename}
          onRenameCancel={cancelRename}
          {cutMarkedPaths}
        />
      {/if}
    </div>

    <!-- Resizer between file list and preview -->
    <PaneResizer on:resize={handlePreviewResize} />

    <!-- Preview Pane -->
    <div style="width: {previewWidth}px;" class="tui-border-bright bg-terminal-bg-light flex items-center justify-center text-terminal-fg-dimmer flex-shrink-0">
      <div class="text-center">
        <div class="text-4xl mb-2">📄</div>
        <div>Preview pane</div>
        <div class="text-tui-sm mt-1">(Phase 3)</div>
      </div>
    </div>
  </div>

  <!-- Status Bar -->
  <StatusBar 
    {mode}
    selectedFile={items[selectedIndex]?.name || ''} 
    itemCount={items.length}
    statusMessage={statusMessage}
  />

  <!-- Keybinds Bar -->
  <KeybindsBar />
</div>

<!-- Delete Confirmation Dialog -->
{#if showDeleteDialog && deleteTarget}
  <ConfirmDialog
    title="Delete {deleteTarget.isDirectory ? 'Folder' : 'File'}"
    message="Are you sure you want to delete '{deleteTarget.name}'?{deleteTarget.isDirectory ? ' This will delete all contents.' : ''}"
    confirmText="Delete"
    cancelText="Cancel"
    danger={true}
    on:confirm={confirmDelete}
    on:cancel={cancelDelete}
  />
{/if}

<!-- Overwrite Confirmation Dialog -->
{#if showOverwriteDialog}
  <ConfirmDialog
    title="Overwrite"
    message={overwriteMessage}
    confirmText="Overwrite"
    cancelText="Cancel"
    danger={false}
    on:confirm={confirmOverwrite}
    on:cancel={cancelOverwrite}
  />
{/if}

<style>
  .nav-arrow {
    background: transparent;
    border: none;
    color: var(--tw-text-terminal-accent);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    transition: opacity 0.15s;
  }

  .nav-arrow:hover:not(:disabled) {
    opacity: 0.7;
  }

  .nav-arrow:disabled {
    color: var(--tw-text-terminal-fg-dimmer);
    cursor: not-allowed;
    opacity: 0.3;
  }

  .nav-arrow.disabled {
    color: #504945;
    cursor: not-allowed;
  }
</style>