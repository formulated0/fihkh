<script>
  import { onMount } from 'svelte';
  import path from 'path-browserify';
  import Sidebar from './components/Sidebar.svelte';
  import FileList from './components/FileList.svelte';
  import PaneResizer from './components/PaneResizer.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import KeybindsBar from './components/KeybindsBar.svelte';
  
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

  // Pane widths (in pixels)
  let sidebarWidth = 200;
  let previewWidth = 400;

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
    // Ignore keys when in INSERT mode (for future text inputs)
    if (mode === 'INSERT') return;

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
      
      // Jump to top/bottom
      case 'g':
        if (event.shiftKey) {
          // Shift+G = bottom
          event.preventDefault();
          selectedIndex = items.length - 1;
          rememberIndex[currentPath] = selectedIndex;
        }
        break;
      
      case 'G':
        event.preventDefault();
        selectedIndex = items.length - 1;
        rememberIndex[currentPath] = selectedIndex;
        break;
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
          onNavigate={handleNavigate}
          onSelect={handleSelect}
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
  />

  <!-- Keybinds Bar -->
  <KeybindsBar />
</div>

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