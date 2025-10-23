<script>
  import { afterUpdate } from 'svelte';
  
  export let items = [];
  export let selectedIndex = 0;
  export let onNavigate;
  export let onSelect;

  let listContainer;
  // An array to hold references to each DOM element in the list
  let itemElements = [];

  // Scroll selected item into view after updates
  afterUpdate(() => {
    // Get the specific element corresponding to the selectedIndex
    const selectedElement = itemElements[selectedIndex];
    
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'auto'
      });
    }
  });

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (!bytes) return '---';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(date) {
    if (!date) return '---';
    
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    
    return new Date(date).toLocaleDateString();
  }

  function getIcon(item) {
    if (item.isDirectory) return '📁';
    
    const ext = item.name.split('.').pop().toLowerCase();
    const iconMap = {
      'js': '📜',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'pdf': '📕',
      'zip': '📦',
      'tar': '📦',
      'gz': '📦'
    };
    
    return iconMap[ext] || '📄';
  }

  function handleClick(index) {
    onSelect(index);
  }

  function handleDoubleClick(item) {
    if (item.isDirectory) {
      onNavigate(item.path);
    } else {
      // TODO: Open file in Phase 2
      console.log('Open file:', item.path);
    }
  }
</script>

<div class="flex flex-col h-full">
  <!-- Header Row -->
  <div class="bg-terminal-bg-light px-4 py-2 border-b border-terminal-border text-terminal-fg-dim text-tui-sm font-bold no-select flex">
    <div class="w-12"></div>
    <div class="flex-1">Name</div>
    <div class="w-24 text-right">Size</div>
    <div class="w-32 text-right">Modified</div>
  </div>

  <!-- File List -->
  <div class="flex-1 overflow-y-auto custom-scrollbar" bind:this={listContainer}>
    {#each items as item, index}
      <div 
        bind:this={itemElements[index]}
        class="px-4 py-1.5 flex items-center cursor-pointer"
        class:file-item-selected={index === selectedIndex}
        class:file-item-hover={index !== selectedIndex}
        on:click={() => handleClick(index)}
        on:dblclick={() => handleDoubleClick(item)}
        role="button"
        tabindex="-1"
      >
        <!-- Icon & Type Indicator -->
        <div class="w-12 flex items-center gap-2">
          <span>{getIcon(item)}</span>
          <span class="text-terminal-fg-dimmer text-tui-sm">
            {item.isDirectory ? 'd' : 'f'}
          </span>
        </div>
        
        <!-- Name -->
        <div class="flex-1 truncate" title={item.name}>
          {item.name}
        </div>
        
        <!-- Size -->
        <div class="w-24 text-right text-terminal-fg-dim text-tui-sm">
          {formatSize(item.size)}
        </div>
        
        <!-- Modified Date -->
        <div class="w-32 text-right text-terminal-fg-dim text-tui-sm">
          {formatDate(item.modified)}
        </div>
      </div>
    {/each}

    {#if items.length === 0}
      <div class="flex items-center justify-center h-full text-terminal-fg-dimmer">
        Empty directory
      </div>
    {/if}
  </div>
</div>