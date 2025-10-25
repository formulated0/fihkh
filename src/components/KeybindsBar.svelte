<script>
  import { createEventDispatcher } from 'svelte';
  import { keybinds as allKeybinds, normalizeKeyLabel } from '../keybinds.js';
  export let mode = 'NORMAL';
  export let platform = 'linux';
  const dispatch = createEventDispatcher();

  function keysForMode(item, mode) {
    // In FILTER mode, only show modifier-based ops for copy/cut/paste and allow Delete.
    if (mode === 'FILTER') {
      if (item.id === 'copy' || item.id === 'cut' || item.id === 'paste') {
        return (item.keys || []).filter(k => k.startsWith('C-'));
      }
      if (item.id === 'delete') {
        return (item.keys || []).filter(k => k === 'delete');
      }
    }
    return item.keys || [];
  }

  $: visibleBinds = (allKeybinds || [])
    .filter(b => b.implemented !== false)
    .filter(b => b.mode === 'ALL' || b.mode === mode)
    .map(b => ({ ...b, keys: keysForMode(b, mode) }))
    .filter(b => b.keys.length > 0)
    // Choose a compact set to display in the bar (primary binds only)
    .map(b => ({ key: b.keys.map(k => normalizeKeyLabel(k, platform)).join(' / '), desc: b.desc }));
</script>

<div class="tui-border-bright bg-terminal-bg px-4 py-1.5 flex items-center justify-between text-tui-sm no-select">
  <!-- Main keybinds (may overflow and hide) -->
  <div class="flex items-center gap-6 overflow-hidden flex-shrink min-w-0">
    {#each visibleBinds as bind}
      <div class="flex items-center gap-1 whitespace-nowrap flex-shrink-0">
        <span class="text-terminal-accent font-bold">{bind.key}</span>
        <span class="text-terminal-fg-dim">:</span>
        <span class="text-terminal-fg">{bind.desc}</span>
      </div>
    {/each}
  </div>

  <!-- Help keybind (always visible, pinned right) -->
  <div class="flex items-center gap-1 whitespace-nowrap flex-shrink-0 ml-4 cursor-pointer" title="help ( ? )" on:click={() => dispatch('openHelp')}>
    <span class="text-terminal-accent font-bold">?</span>
    <span class="text-terminal-fg-dim">:</span>
    <span class="text-terminal-fg">help</span>
  </div>
</div>