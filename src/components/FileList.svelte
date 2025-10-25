<script>
  import { afterUpdate, tick } from "svelte";

  export let items = [];
  export let selectedIndex = 0;
  export let onNavigate;
  export let onSelect;
  export let renamingIndex = -1;
  export let renameValue = "";
  export let onRenameChange;
  export let onRenameSubmit;
  export let onRenameCancel;
  // Paths that are marked as cut (to render semi-transparent)
  export let cutMarkedPaths = new Set();

  let itemElements = [];
  let listContainer;
  $: selectedElement = itemElements[selectedIndex];
  let renameInput;

  // Scroll selected item into view after updates
  afterUpdate(() => {
    if (selectedElement && listContainer) {
      selectedElement.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  });

  // Focus rename input when renaming starts
  $: if (renamingIndex >= 0 && renameInput) {
    tick().then(() => {
      renameInput.focus();
      renameInput.select();
    });
  }

  function formatSize(bytes) {
    if (bytes === 0) return "0 B";
    if (!bytes) return "---";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(date) {
    if (!date) return "---";

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
    if (item.isDirectory) return "📁";

    const ext = item.name.split(".").pop().toLowerCase();
    const iconMap = {
      js: "📜",
      json: "📋",
      md: "📝",
      txt: "📄",
      png: "🖼️",
      jpg: "🖼️",
      jpeg: "🖼️",
      gif: "🖼️",
      pdf: "📕",
      zip: "📦",
      tar: "📦",
      gz: "📦",
    };

    return iconMap[ext] || "📄";
  }

  function handleClick(index) {
    // Ignore list clicks while renaming to avoid unintended blurs/navigations
    if (renamingIndex >= 0) return;
    onSelect(index);
  }

  function handleDoubleClick(item) {
    // While renaming (INSERT mode), do not navigate/open on double-click
    if (renamingIndex >= 0) return;
    if (item.isDirectory) {
      onNavigate(item.path);
    } else {
      // TODO: Open file in Phase 2
      console.log("Open file:", item.path);
    }
  }

  function handleRenameKeydown(event) {
    if (event.key === "Enter") {
      // Prevent Enter from bubbling to window handler (which could navigate)
      event.stopPropagation();
      event.preventDefault();
      onRenameSubmit();
    } else if (event.key === "Escape") {
      // Prevent Escape from bubbling as well
      event.stopPropagation();
      event.preventDefault();
      onRenameCancel();
    }
  }
</script>

<div class="flex flex-col h-full">
  <!-- Header Row -->
  <div
    class="bg-terminal-bg-light px-4 py-2 border-b border-terminal-border text-terminal-fg-dim text-tui-sm font-bold no-select flex"
  >
    <div class="w-12"></div>
    <div class="flex-1">Name</div>
    <div class="w-24 text-right">Size</div>
    <div class="w-32 text-right">Modified</div>
  </div>

  <!-- File List -->
  <div
    class="flex-1 overflow-y-auto custom-scrollbar"
    bind:this={listContainer}
  >
    {#each items as item, index}
      <div
        bind:this={itemElements[index]}
        class="px-4 py-1.5 flex items-center cursor-pointer"
        class:file-item-selected={index === selectedIndex}
        class:file-item-hover={index !== selectedIndex}
        class:opacity-50={cutMarkedPaths && cutMarkedPaths.has(item.path)}
        on:click={() => handleClick(index)}
        on:dblclick={() => handleDoubleClick(item)}
        role="button"
        tabindex="-1"
      >
        <!-- Icon & Type Indicator -->
        <div class="w-12 flex items-center gap-2">
          <span>{getIcon(item)}</span>
          <span
            class="text-tui-sm"
            class:text-white={index === selectedIndex}
            class:text-terminal-fg-dimmer={index !== selectedIndex}
          >
            {item.isDirectory ? "d" : "f"}
          </span>
        </div>

        <!-- Name -->
        <div class="flex-1 truncate min-w-0" title={item.name}>
          {#if index === renamingIndex}
            <input
              bind:this={renameInput}
              type="text"
              class="rename-input"
              value={renameValue}
              on:input={(e) => onRenameChange(e.target.value)}
              on:keydown={handleRenameKeydown}
              on:click|stopPropagation
              on:dblclick|stopPropagation
              on:mousedown|stopPropagation
              on:blur={onRenameCancel}
            />
          {:else}
            {item.name}
          {/if}
        </div>

        <!-- Size -->
        <div
          class="w-24 text-right text-tui-sm"
          class:text-white={index === selectedIndex}
          class:text-terminal-fg-dim={index !== selectedIndex}
        >
          {formatSize(item.size)}
        </div>

        <!-- Modified Date -->
        <div
          class="w-32 text-right text-tui-sm"
          class:text-white={index === selectedIndex}
          class:text-terminal-fg-dim={index !== selectedIndex}
        >
          {formatDate(item.modified)}
        </div>
      </div>
    {/each}

    {#if items.length === 0}
      <div
        class="flex items-center justify-center h-full text-terminal-fg-dimmer"
      >
        Empty directory
      </div>
    {/if}
  </div>
</div>

<style>
  .rename-input {
    background: #3c3836;
    color: #ebdbb2;
    border: 1px solid #fabd2f;
    padding: 0.125rem 0.25rem;
    font-family: inherit;
    font-size: inherit;
    width: 100%;
    outline: none;
  }

  .rename-input:focus {
    border-color: #fabd2f;
    box-shadow: 0 0 0 1px #fabd2f;
  }
</style>
