<script>
  import { onDestroy } from 'svelte';

  export let item = null; // { path, name, isDirectory, size, modified }
  export let multiCount = 0; // if >1 show a summary instead of single preview

  let loading = false;
  let error = '';
  let text = null; // string | null
  let truncated = false;
  let isImage = false;
  let imageSrc = '';
  let imageDims = null; // { w, h }
  let imageLoading = false;

  const TEXT_MAX_BYTES = 200 * 1024; // 200 KB

  let currentLoadToken = 0;
  onDestroy(() => { currentLoadToken++; });

  // refresh only when input props change to avoid loops on internal state updates
  $: { item; multiCount; refreshPreview(); }

  function resetState() {
    loading = false;
    error = '';
    text = null;
    truncated = false;
    isImage = false;
    imageSrc = '';
    imageDims = null;
  }

  function getExt(name) {
    if (!name) return '';
    const idx = name.lastIndexOf('.');
    if (idx <= 0 || idx === name.length - 1) return '';
    return name.slice(idx + 1).toLowerCase();
  }

  function isTextLike(name) {
    if (!name) return false;
    const ext = getExt(name);
    const textExts = new Set(['txt','md','markdown','json','js','ts','tsx','jsx','css','scss','less','html','htm','xml','yml','yaml','toml','ini','conf','cfg','log','sh','bash','zsh','py','rb','go','rs','java','c','h','cpp','hpp','cs','gradle','make','cmake','dockerfile','env','tmp']);
    if (textExts.has(ext)) return true;
    // Heuristic: files without extension often text; skip obvious binaries
    const binExts = new Set(['png','jpg','jpeg','gif','webp','bmp','svg','pdf','zip','gz','tar','xz','7z','mp3','mp4','mkv','avi','mov','flac','ogg','iso']);
    if (binExts.has(ext)) return false;
    return true;
  }

  function isImageLike(name) {
    if (!name) return false;
    const ext = getExt(name);
    return ['png','jpg','jpeg','gif','webp','bmp','svg', 'ico'].includes(ext);
  }

  async function refreshPreview() {
    resetState();
    const token = ++currentLoadToken;

    if (!item || multiCount > 1) return; // nothing or multi-select summary

    if (item.isDirectory) {
      // For now, just metadata — no async needed
      return; 
    }

    // Images
    if (isImageLike(item.name)) {
      isImage = true;
      loading = true;
      try {
        // Prefer loading as a data URL to avoid file:// encoding/CORS quirks
        const ext = getExt(item.name);
        const mimeMap = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          bmp: 'image/bmp',
          svg: 'image/svg+xml'
        };
        const mime = mimeMap[ext] || 'image/*';
        const res = await window.electronAPI.readFile(item.path, 'base64');
        if (token !== currentLoadToken) return; // aborted
        if (res && res.success && res.content) {
          imageSrc = `data:${mime};base64,${res.content}`;
        } else {
          // Fallback to a properly encoded file:// URL
          imageSrc = encodeURI(`file://${item.path}`);
        }
      } catch (e) {
        // Final fallback to file:// and let on:error handle message
        imageSrc = encodeURI(`file://${item.path}`);
      } finally {
        if (token === currentLoadToken) loading = false;
      }
      return; // resolution gathered via on:load handler
    }

    // Text files
    if (isTextLike(item.name)) {
      loading = true;
      try {
        // If very large, read only first chunk via backend? We only have readFile; so read fully then slice.
        const res = await window.electronAPI.readFile(item.path, 'utf8');
        if (token !== currentLoadToken) return; // aborted
        if (res && res.success) {
          let content = res.content ?? '';
          if (content.length > TEXT_MAX_BYTES) {
            content = content.slice(0, TEXT_MAX_BYTES);
            truncated = true;
          }
          text = content;
        } else {
          error = res?.error || 'Failed to read file';
        }
      } catch (e) {
        error = e.message || String(e);
      } finally {
        if (token === currentLoadToken) loading = false;
      }
      return;
    }

    // Unknown/binary
    // Leave as metadata only
  }

  function onImageLoad(e) {
    const img = e.target;
    imageDims = { w: img.naturalWidth, h: img.naturalHeight };
  }
  function onImageError() {
    error = 'could not load image';
  }

  function formatSize(bytes) {
    if (bytes === 0) return '0 b';
    if (!bytes && bytes !== 0) return '---';
    const k = 1024;
    const sizes = ['b','kb','mb','gb','tb'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  function formatDate(date) {
    if (!date) return '---';
    const d = new Date(date);
    return d.toLocaleString().toLowerCase();
  }
  function kindLabel(it) {
    if (!it) return '';
    if (it.isDirectory) return 'directory';
    const ext = getExt(it.name);
    if (isImageLike(it.name)) return (ext ? `${ext} ` : '') + 'image';
    if (isTextLike(it.name)) return (ext ? `${ext} ` : '') + 'text';
    return (ext ? `${ext} ` : '') + 'file';
  }
  // resizable metadata height
  let metaHeight = 130; // default similar to current block
  let dragging = false;
  let startY = 0;
  let startH = 0;

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function startMetaResize(e) {
    dragging = true;
    startY = e.clientY;
    startH = metaHeight;
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
    e.preventDefault();
  }
  function onDrag(e) {
    if (!dragging) return;
    const dy =  startY - e.clientY; // moving up increases meta height
    metaHeight = clamp(startH + dy, 80, 400);
  }
  function stopDrag() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
  }
</script>

<div class="flex flex-col h-full bg-terminal-bg-light">
  {#if !item}
    <div class="flex-1 flex items-center justify-center text-terminal-fg-dimmer">
      no selection
    </div>
  {:else if multiCount > 1}
    <div class="flex-1 flex items-center justify-center text-terminal-fg-dimmer text-center px-4">
      <div>
        <div class="text-4xl mb-2"></div>
        <div>{multiCount} items selected</div>
        <div class="text-tui-sm mt-1">(preview shows when a single item is selected)</div>
      </div>
    </div>
  {:else}
    <!-- Preview area on top (height adjusts with metaHeight) -->
    <div class="tui-border-b bg-terminal-bg" style="height: calc(100% - {metaHeight + 6}px); min-height: 0;">
      {#if item.isDirectory}
        <div class="h-full flex items-center justify-center text-terminal-fg-dimmer">
          <div class="text-center">
            <div class="text-4xl mb-2">📁</div>
            <div>folder</div>
          </div>
        </div>
      {:else if loading}
        <div class="h-full flex items-center justify-center text-terminal-fg-dim">loading preview…</div>
      {:else if error}
        <div class="h-full flex items-center justify-center text-terminal-error px-4 text-center">{error}</div>
      {:else if isImage}
        <div class="h-full w-full flex items-center justify-center overflow-hidden p-2">
          <img src={imageSrc} alt="" class="max-h-full max-w-full object-contain" on:load={onImageLoad} on:error={onImageError} />
        </div>
      {:else if text !== null}
        <div class="h-full overflow-auto custom-scrollbar p-3">
          <pre class="whitespace-pre-wrap text-terminal-fg text-tui-sm select-text">{text}</pre>
          {#if truncated}
            <div class="mt-2 text-terminal-fg-dimmer text-tui-sm">(truncated to {Math.floor(TEXT_MAX_BYTES/1024)} kb)</div>
          {/if}
        </div>
      {:else}
        <div class="h-full flex items-center justify-center text-terminal-fg-dimmer px-4 text-center">
          no preview available
        </div>
      {/if}
    </div>

    <!-- Metadata area (resizable) -->
    <div class="meta-resizer" on:mousedown={startMetaResize} title="drag to resize"></div>
    <div class="px-3 py-2 text-tui-sm space-y-1 overflow-auto custom-scrollbar" style="height: {metaHeight}px;">
      <div class="flex justify-between gap-2"><span class="text-terminal-fg-dim">name</span><span class="text-terminal-fg truncate max-w-[70%]" title={item.name}>{item.name}</span></div>
      <div class="flex justify-between gap-2"><span class="text-terminal-fg-dim">type</span><span class="text-terminal-fg">{kindLabel(item)}</span></div>
      <div class="flex justify-between gap-2"><span class="text-terminal-fg-dim">size</span><span class="text-terminal-fg">{item.isDirectory ? '---' : formatSize(item.size)}</span></div>
      <div class="flex justify-between gap-2"><span class="text-terminal-fg-dim">modified</span><span class="text-terminal-fg">{formatDate(item.modified)}</span></div>
      {#if isImage && imageDims}
        <div class="flex justify-between gap-2"><span class="text-terminal-fg-dim">resolution</span><span class="text-terminal-fg">{imageDims.w} × {imageDims.h}</span></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .select-text { user-select: text; }
  .tui-border-b { border-bottom: 1px solid var(--tw-border-terminal-border); }
  .meta-resizer { height: 6px; cursor: row-resize; background: #1d2021; border-bottom: 1px solid var(--tw-border-terminal-border); border-top: 1px solid var(--tw-border-terminal-border); }
  .meta-resizer:hover { background: #3c3836; }
</style>
