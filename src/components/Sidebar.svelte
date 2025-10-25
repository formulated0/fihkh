<script>
  import { onMount } from 'svelte';
  
  export let onNavigate;
  export let currentPath = '';

  let shortcuts = [];
  let devices = [];

  onMount(async () => {
    // Get home directory for default shortcuts
    const homeResult = await window.electronAPI.getHomeDir();
    const homePath = homeResult.success ? homeResult.path : '/home';

    // Default shortcuts
    shortcuts = [
      { name: 'Home', path: homePath, icon: '🏠' },
      { name: 'Desktop', path: `${homePath}/Desktop`, icon: '🖥️' },
      { name: 'Documents', path: `${homePath}/Documents`, icon: '📄' },
      { name: 'Downloads', path: `${homePath}/Downloads`, icon: '⬇️' },
      { name: 'Pictures', path: `${homePath}/Pictures`, icon: '🖼️' },
      { name: 'Music', path: `${homePath}/Music`, icon: '🎵' },
      { name: 'Videos', path: `${homePath}/Videos`, icon: '🎬' }
    ];

    // Get devices (drives)
    const devicesResult = await window.electronAPI.getDevices();
    if (devicesResult.success) {
      devices = devicesResult.devices;
    }
  });

  function handleShortcutClick(shortcut) {
    onNavigate(shortcut.path);
  }

  function handleDeviceClick(device) {
    onNavigate(device.mountPoint);
  }
</script>

<div class="flex flex-col h-full bg-terminal-bg-light">
  <!-- Shortcuts Section -->
  <div class="flex-1 flex flex-col min-h-0">
    <div class="px-3 py-2 text-terminal-fg-dim text-tui-sm font-bold border-b border-terminal-border no-select">
      SHORTCUTS
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      {#each shortcuts as shortcut}
        <button
          class="w-full px-3 py-1.5 flex items-center gap-2 text-left no-select hover:bg-terminal-bg-lighter"
          on:click={() => handleShortcutClick(shortcut)}
          tabindex="-1"
        >
          <span class="text-base">{shortcut.icon}</span>
          <span class="text-tui truncate">{shortcut.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Devices Section -->
  <div class="flex-1 flex flex-col min-h-0 border-t border-terminal-border">
    <div class="px-3 py-2 text-terminal-fg-dim text-tui-sm font-bold border-b border-terminal-border no-select">
      DEVICES
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      {#if devices.length === 0}
        <div class="px-3 py-2 text-terminal-fg-dimmer text-tui-sm">
          No devices found
        </div>
      {:else}
        {#each devices as device}
          <button
            class="w-full px-3 py-1.5 flex items-center gap-2 text-left no-select hover:bg-terminal-bg-lighter"
            on:click={() => handleDeviceClick(device)}
            tabindex="-1"
          >
            <span class="text-base">{device.icon || '💾'}</span>
            <div class="flex-1 min-w-0">
              <div class="text-tui truncate">{device.name}</div>
              {#if device.used !== 'N/A'}
                <div class="text-tui-sm text-terminal-fg-dimmer">
                  {device.used} / {device.total}
                </div>
              {:else}
                <div class="text-tui-sm text-terminal-fg-dimmer truncate">
                  {device.mountPoint}
                </div>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  button {
    cursor: pointer;
    border: none;
    background: none;
  }
  
  button:focus {
    outline: none;
  }
</style>