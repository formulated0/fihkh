<script>
  const keybinds = [
    { key: 'j/k', desc: 'up/down' },
    { key: 'h', desc: 'parent' },
    { key: 'l', desc: 'open' },
    { key: 'G', desc: 'bottom' },
    { key: 'i', desc: 'rename' },
    { key: 'c', desc: 'copy' },
    { key: 'x', desc: 'cut' },
    { key: 'p', desc: 'paste' },
    { key: 'd', desc: 'delete' },
    { key: '/', desc: 'filter' }
  ];
</script>

<div class="tui-border-bright bg-terminal-bg px-4 py-1.5 flex items-center justify-between text-tui-sm no-select">
  <!-- Main keybinds (may overflow and hide) -->
  <div class="flex items-center gap-6 overflow-hidden flex-shrink min-w-0">
    {#each keybinds as bind}
      <div class="flex items-center gap-1 whitespace-nowrap flex-shrink-0">
        <span class="text-terminal-accent font-bold">{bind.key}</span>
        <span class="text-terminal-fg-dim">:</span>
        <span class="text-terminal-fg">{bind.desc}</span>
      </div>
    {/each}
  </div>

  <!-- Help keybind (always visible, pinned right) -->
  <div class="flex items-center gap-1 whitespace-nowrap flex-shrink-0 ml-4">
    <span class="text-terminal-accent font-bold">?</span>
    <span class="text-terminal-fg-dim">:</span>
    <span class="text-terminal-fg">help</span>
  </div>
</div>