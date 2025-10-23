<script>
  const keybinds = [
    { key: 'i', desc: 'rename' },
    { key: 'c', desc: 'copy' },
    { key: 'x', desc: 'cut' },
    { key: 'p', desc: 'paste' },
    { key: 'd', desc: 'delete' },
    { key: '/', desc: 'filter' },
    { key: 'tab', desc: 'switch pane' },
    { key: '?', desc: 'help' }
  ];
</script>

<div class="tui-border-bright bg-terminal-bg px-4 py-1.5 flex items-center gap-6 text-tui-sm no-select overflow-x-auto">
  {#each keybinds as bind}
    <div class="flex items-center gap-1 whitespace-nowrap">
      <span class="text-terminal-accent font-bold">{bind.key}</span>
      <span class="text-terminal-fg-dim">:</span>
      <span class="text-terminal-fg">{bind.desc}</span>
    </div>
  {/each}
</div>