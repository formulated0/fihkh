<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { keybinds as allKeybinds, groupKeybinds, normalizeKeyLabel } from '../keybinds.js';

  export let visible = false;
  export let platform = 'linux';

  const dispatch = createEventDispatcher();
  let search = '';
  let inputEl;

  $: filtered = search
    ? allKeybinds.filter(k =>
        (k.desc && k.desc.toLowerCase().includes(search.toLowerCase())) ||
        (k.keys && k.keys.join(' ').toLowerCase().includes(search.toLowerCase()))
      )
    : allKeybinds;

  $: grouped = groupKeybinds(filtered);

  function close() {
    dispatch('close');
  }

  function handleKeyDown(e) {
    // Only act when modal is visible (svelte:window must be top-level)
    if (!visible) return;
    const isQuestion = e.key === '?' || (e.key === '/' && e.shiftKey);
    if (e.key === 'Escape' || isQuestion) {
      e.preventDefault();
      close();
    }
  }

  $: if (visible && inputEl) {
    // Focus the search box when opening
    setTimeout(() => inputEl && inputEl.focus(), 0);
  }
</script>

<svelte:window on:keydown={handleKeyDown} />
{#if visible}
  <div class="overlay" on:click={close}>
    <div class="box" on:click|stopPropagation>
      <!-- Header -->
      <div class="header">
        <div class="title">keybindings ( ? )</div>
        <input
          bind:this={inputEl}
          class="search"
          type="text"
          placeholder="search"
          bind:value={search}
        />
      </div>

      <!-- Body -->
      <div class="content custom-scrollbar">
        {#if grouped.length === 0}
          <div class="empty">no matches</div>
        {:else}
          {#each grouped as group}
            <div class="group">
              <div class="group-title">{group.category}</div>
              <div class="rows">
                {#each group.items as item}
                  <div class="row">
                    <div class="keys">
                      {#each item.keys as k, i}
                        <span class="keychip">{normalizeKeyLabel(k, platform)}</span>{#if i < item.keys.length - 1}<span class="sep"> / </span>{/if}
                      {/each}
                    </div>
                    <div class="desc">
                      {item.desc}
                      {#if item.mode && item.mode !== 'ALL'}
                        <span class="mode">[{item.mode}]</span>
                      {/if}
                      {#if item.implemented === false}
                        <span class="planned">planned</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="footer">
        <span>esc / ? to close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }
  .box {
    background: #282828;
    border: 2px solid #665c54;
    width: min(900px, 90vw);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #3c3836;
    border-bottom: 1px solid #504945;
  }
  .title {
    color: #ebdbb2;
    font-weight: bold;
  }
  .search {
    flex: 1;
    background: #1d2021;
    color: #ebdbb2;
    border: 1px solid #504945;
    padding: 0.375rem 0.5rem;
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
  }
  .search:focus {
    border-color: #fabd2f;
    box-shadow: 0 0 0 1px #fabd2f;
  }
  .content {
    padding: 0.75rem 1rem;
    overflow: auto;
    flex: 1;
  }
  .group { margin-bottom: 0.75rem; }
  .group-title {
    color: #bdae93;
    font-weight: bold;
    margin-bottom: 0.25rem;
  }
  .rows { display: flex; flex-direction: column; gap: 0.25rem; }
  .row { display: flex; gap: 0.75rem; align-items: baseline; }
  .keys { flex-shrink: 0; min-width: 240px; display: flex; flex-wrap: wrap; align-items: center; }
  .keychip {
    background: #1d2021;
    border: 1px solid #504945;
    color: #ebdbb2;
    padding: 0.125rem 0.375rem;
    font-size: 0.8rem;
  }
  .sep { color: #665c54; margin: 0 0.25rem; }
  .desc { color: #d5c4a1; }
  .mode { color: #83a598; margin-left: 0.5rem; font-size: 0.8rem; }
  .planned { color: #fabd2f; margin-left: 0.5rem; font-size: 0.75rem; }
  .empty { color: #bdae93; padding: 1rem; text-align: center; }
  .footer {
    padding: 0.5rem 1rem;
    border-top: 1px solid #504945;
    background: #1d2021;
    color: #bdae93;
    text-align: right;
  }
</style>
