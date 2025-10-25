<script>
  export let mode = 'NORMAL';
  export let selectedFile = '';
  export let itemCount = 0;
  export let statusMessage = '';

  // Get mode color
  $: modeColor = {
    'NORMAL': 'text-terminal-accent',
    'INSERT': 'text-terminal-success',
    'VISUAL': 'text-terminal-info'
  }[mode] || 'text-terminal-fg';
</script>

<div class="tui-border-bright bg-terminal-bg-light px-4 py-1.5 flex items-center justify-between text-tui-sm no-select">
  <div class="flex items-center gap-4">
    <!-- Mode Indicator -->
    <span class="font-bold {modeColor}">
      [{mode}]
    </span>
    
    <!-- Selected File -->
    {#if selectedFile}
      <span class="text-terminal-fg">
        {selectedFile}
      </span>
    {/if}
  </div>

  <div class="flex items-center gap-4 text-terminal-fg-dim">
    <!-- Status message (minimal feedback) -->
    {#if statusMessage}
      <span class="text-terminal-fg">{statusMessage}</span>
      <span class="text-terminal-border">│</span>
    {/if}

    <!-- Item Count -->
    <span>
      {itemCount} {itemCount === 1 ? 'item' : 'items'}
    </span>
    
    <!-- Disk Space (Placeholder) -->
    <span>
      2.1 GB free on /dev/sda2
    </span>
  </div>
</div>