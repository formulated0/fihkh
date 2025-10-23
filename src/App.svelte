<script>
  import { onMount } from 'svelte';
  import FileList from './components/FileList.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import KeybindsBar from './components/KeybindsBar.svelte';
  
  let currentPath = '';
  let items = [];
  let selectedIndex = 0;
  let loading = true;
  let error = null;

  onMount(async () => {
    // Get home directory on startup
    const homeResult = await window.electronAPI.getHomeDir();
    if (homeResult.success) {
      currentPath = homeResult.path;
      await loadDirectory(currentPath);
    } else {
      error = 'Failed to get home directory';
      loading = false;
    }
  });

  async function loadDirectory(path) {
    loading = true;
    error = null;
    
    const result = await window.electronAPI.readDir(path);
    
    if (result.success) {
      // Sort: directories first, then files, alphabetically
      items = result.items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      selectedIndex = 0;
      currentPath = path;
    } else {
      error = result.error;
      items = [];
    }
    
    loading = false;
  }

  function handleKeyDown(event) {
    // Keyboard navigation will be implemented here
    console.log('Key pressed:', event.key);
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="flex flex-col h-screen w-screen">
  <!-- Header / Breadcrumb -->
  <div class="tui-border-bright bg-terminal-bg-light px-4 py-2 flex items-center justify-between no-select">
    <div class="text-terminal-accent font-bold">
      <span class="text-terminal-fg-dim">❯</span> {currentPath || 'Loading...'}
    </div>
    <div class="text-terminal-fg-dim text-tui-sm">
      🔍 Search
    </div>
  </div>

  <!-- Main Content Area -->
  <div class="flex-1 flex overflow-hidden">
    <!-- File List Pane -->
    <div class="flex-1 flex flex-col tui-border-bright">
      {#if loading}
        <div class="flex-1 flex items-center justify-center text-terminal-fg-dim">
          Loading...
        </div>
      {:else if error}
        <div class="flex-1 flex items-center justify-center text-terminal-error">
          Error: {error}
        </div>
      {:else}
        <FileList {items} {selectedIndex} />
      {/if}
    </div>

    <!-- Preview Pane (Placeholder) -->
    <div class="w-1/3 tui-border-bright bg-terminal-bg-light flex items-center justify-center text-terminal-fg-dimmer">
      <div class="text-center">
        <div class="text-4xl mb-2">📄</div>
        <div>Preview pane</div>
        <div class="text-tui-sm mt-1">(Phase 3)</div>
      </div>
    </div>
  </div>

  <!-- Status Bar -->
  <StatusBar 
    mode="NORMAL" 
    selectedFile={items[selectedIndex]?.name || ''} 
    itemCount={items.length}
  />

  <!-- Keybinds Bar -->
  <KeybindsBar />
</div>

<style>
  /* Component-specific styles if needed */
</style>