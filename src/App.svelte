<script>
  import { onMount } from 'svelte';
  import path from 'path-browserify';
  import Sidebar from './components/Sidebar.svelte';
  import FileList from './components/FileList.svelte';
  import PaneResizer from './components/PaneResizer.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import KeybindsBar from './components/KeybindsBar.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import HelpModal from './components/HelpModal.svelte';
  
  let currentPath = '';
  let baseItems = [];
  let items = [];
  let selectedIndex = 0;
  // Multi-selection (VISUAL mode) — track by path for stability across sorts
  let selectedPaths = new Set(); // Set<string>
  let visualAnchorPath = null; // string | null
  let lastFocusedPath = null; // string | null, for Shift+click anchor in NORMAL

  let loading = true;
  let error = null;
  let mode = 'NORMAL';
  let showHelp = false;
  let platform = 'linux';

  // Filter (live, in-directory)
  let filterQuery = '';
  let filterInputEl;
  let viewCursor = 0; // selection index within filtered view when in FILTER mode

  // Derived filtered view and index mapping
  $: viewIndexMap = !filterQuery
    ? items.map((_, idx) => idx)
    : items
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.name.toLowerCase().includes(filterQuery.toLowerCase()))
        .map(({ idx }) => idx);
  $: viewItems = viewIndexMap.map(i => items[i]);

  // Navigation history
  let history = [];
  let historyIndex = -1;
  let rememberIndex = {}; // Remember selected index for each directory

  // Sorting state (tri-state per column). When null → default (name asc, folders first)
  let sortState = null; // { key: 'name' | 'size' | 'modified', dir: 'asc' | 'desc' } | null

  function compareItems(a, b, key, dir) {
    // Folders first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    const mul = dir === 'desc' ? -1 : 1;
    let av, bv;
    switch (key) {
      case 'size':
        av = a.size ?? 0;
        bv = b.size ?? 0;
        if (av !== bv) return (av < bv ? -1 : 1) * mul;
        break;
      case 'modified':
        av = a.modified ? new Date(a.modified).getTime() : 0;
        bv = b.modified ? new Date(b.modified).getTime() : 0;
        if (av !== bv) return (av < bv ? -1 : 1) * mul;
        break;
      case 'name':
      default:
        av = a.name || '';
        bv = b.name || '';
        if (av !== bv) return av.localeCompare(bv) * mul;
        break;
    }
    // Fallback to name asc for stability
    return a.name.localeCompare(b.name);
  }

  function sortItems(list, state) {
    const key = state?.key || 'name';
    const dir = state?.dir || 'asc';
    const copy = [...list];
    copy.sort((a, b) => compareItems(a, b, key, dir));
    return copy;
  }

  // Handle header click to cycle sort: null → asc → desc → null
  function handleSortClick(key) {
    // Preserve current selection by path
    const currentPathSel = items[selectedIndex]?.path;

    if (!sortState || sortState.key !== key) {
      sortState = { key, dir: 'asc' };
    } else if (sortState.dir === 'asc') {
      sortState = { key, dir: 'desc' };
    } else {
      sortState = null; // back to default name asc
    }

    // After sortState changes, Svelte will recompute `items`
    // Schedule selection restoration in next microtask
    Promise.resolve().then(() => {
      if (!currentPathSel) return;
      const idx = items.findIndex(i => i.path === currentPathSel);
      if (idx !== -1) {
        selectedIndex = idx;
        rememberIndex[currentPath] = idx;
      }
    });
  }

  // Derived sorted items
  $: items = sortItems(baseItems, sortState);

  // View binding for FileList depending on mode
  $: listItems = mode === 'FILTER' ? viewItems : items;
  $: selectedIndexForList = mode === 'FILTER' ? viewCursor : selectedIndex;
  // Build a selected index Set in the coordinates of listItems from selectedPaths
  $: selectedSetForList = (() => {
    if (!selectedPaths || selectedPaths.size === 0) return new Set();
    const set = new Set();
    for (let i = 0; i < listItems.length; i++) {
      const p = listItems[i]?.path;
      if (p && selectedPaths.has(p)) set.add(i);
    }
    return set;
  })();


  // Rename state
  let renamingIndex = -1;
  let renameValue = '';
  let originalName = '';

  // Delete confirmation (supports multi)
  let showDeleteDialog = false;
  let deleteTargets = []; // Array<{ path, name, isDirectory }>

  // Pane widths (in pixels)
  let sidebarWidth = 200;
  let previewWidth = 400;

  // Clipboard state for Cut/Copy/Paste (multi supported)
  // { op: 'copy'|'cut', entries: Array<{ path, name, isDirectory }>, sourceDir: string }
  let clipboard = null;
  let cutMarkedPaths = new Set();

  // One-shot centering control for FileList
  let centerToken = 0;

  // Minimal status feedback (shown in StatusBar)
  let statusMessage = '';
  let statusTimer = null;
  function setStatus(message, ms = 2000) {
    statusMessage = message;
    if (statusTimer) {
      clearTimeout(statusTimer);
    }
    if (ms > 0) {
      statusTimer = setTimeout(() => {
        statusMessage = '';
        statusTimer = null;
      }, ms);
    }
  }

  // Overwrite confirmation dialog (reuses ConfirmDialog)
  let showOverwriteDialog = false;
  let overwriteMessage = '';
  let pendingPaste = null; // function to run on confirm

  onMount(async () => {
    // Platform info (for help modal key glyphs)
    try { platform = window.electronAPI?.platform || platform; } catch {}

    // Get home directory on startup
    const homeResult = await window.electronAPI.getHomeDir();
    if (homeResult.success) {
      currentPath = homeResult.path;
      await loadDirectory(currentPath, true);
    } else {
      error = 'Failed to get home directory';
      loading = false;
    }
  });

  async function loadDirectory(dirPath, addToHistory = true) {
    loading = true;
    error = null;
    // Leaving current directory clears multi-selection and VISUAL mode
    selectedPaths = new Set();
    visualAnchorPath = null;
    if (mode === 'VISUAL') mode = 'NORMAL';

    const result = await window.electronAPI.readDir(dirPath);

    if (result.success) {
      // Keep raw items; sorting is applied via derived `items` using `sortState`
      baseItems = result.items;

      // Restore remembered position or default to 0 (bounds check after sort applied)
      selectedIndex = rememberIndex[dirPath] ?? 0;
      if (selectedIndex >= baseItems.length) selectedIndex = 0;

      const oldPath = currentPath;
      currentPath = dirPath;

      // Update history
      if (addToHistory) {
        // Remove any forward history
        history = history.slice(0, historyIndex + 1);
        history.push(dirPath);
        historyIndex = history.length - 1;
      }
    } else {
      error = result.error;
      baseItems = [];
    }

    loading = false;
  }

  function handleKeyDown(event) {
    const isQuestion = event.key === '?' || (event.key === '/' && event.shiftKey);
    // Filter mode: only Esc handled here; input handles the rest
    if (mode === 'FILTER') {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelFilter();
      }
      return;
    }
    // If Help modal is open, only handle closing keys and swallow the rest
    if (showHelp) {
      if (event.key === 'Escape' || isQuestion) {
        event.preventDefault();
        showHelp = false;
      }
      return;
    }

    // In INSERT mode, only handle Escape
    if (mode === 'INSERT') {
      if (event.key === 'Escape') {
        cancelRename();
      }
      return;
    }

    // VISUAL mode keyboard handling
    if (mode === 'VISUAL') {
      // Esc exits VISUAL and clears multi-selection
      if (event.key === 'Escape') {
        event.preventDefault();
        clearMultiSelection();
        return;
      }

      // CCP/Delete are active in VISUAL and operate on the multi-selection
      const isCtrlC = (event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey);
      const isCtrlX = (event.key === 'x' || event.key === 'X') && (event.ctrlKey || event.metaKey);
      const isCtrlV = (event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey);

      if (event.key === 'c' || event.key === 'C' || isCtrlC) {
        event.preventDefault();
        startCopy();
        return;
      }
      if (event.key === 'x' || event.key === 'X' || isCtrlX) {
        event.preventDefault();
        startCut();
        return;
      }
      if (event.key === 'p' || event.key === 'P' || isCtrlV) {
        event.preventDefault();
        pasteClipboard();
        return;
      }
      if (event.key === 'd' || event.key === 'Delete') {
        event.preventDefault();
        startDelete();
        return;
      }

      // Movement extends selection from anchor
      const prevIndex = selectedIndex;
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (selectedIndex < items.length - 1) {
          selectedIndex++;
          rememberIndex[currentPath] = selectedIndex;
        }
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (selectedIndex > 0) {
          selectedIndex--;
          rememberIndex[currentPath] = selectedIndex;
        }
      } else if (event.key === 'G') {
        event.preventDefault();
        selectedIndex = items.length - 1;
        rememberIndex[currentPath] = selectedIndex;
      } else if (event.key === 'g') {
        // simple 'gg' not implemented yet; using single 'g' no-op for now
      } else if (event.key === 'l' || event.key === 'ArrowRight' || event.key === 'Enter') {
        // Disable open in VISUAL for now
        event.preventDefault();
        return;
      } else {
        // Unhandled key in VISUAL → ignore
        return;
      }
      // After moving, extend selection based on anchor
      if (prevIndex !== selectedIndex) {
        if (!visualAnchorPath) visualAnchorPath = items[prevIndex]?.path || items[selectedIndex]?.path || null;
        extendSelectionTo(selectedIndex);
      }
      return;
    }

    // '?' opens Help in NORMAL mode
    if (isQuestion) {
      event.preventDefault();
      showHelp = true;
      return;
    }

    // '/' starts live in-directory filter (also clears VISUAL)
    if (event.key === '/') {
      event.preventDefault();
      clearMultiSelection();
      startFilter();
      return;
    }

    // Toggle VISUAL mode
    if (event.key === 'v' || event.key === 'V') {
      event.preventDefault();
      if (mode !== 'VISUAL') {
        enterVisualMode();
      } else {
        clearMultiSelection();
      }
      return;
    }

    // Escape in NORMAL mode: cancel pending cut, if any
    if (event.key === 'Escape') {
      if (clipboard && clipboard.op === 'cut') {
        event.preventDefault();
        clipboard = null;
        cutMarkedPaths = new Set();
        setStatus('Cut cancelled');
        return;
      }
      // If no pending cut, let Esc fall through (currently no other action in NORMAL)
    }

    // Normalize ctrl combinations for CCP
    const isCtrlC = (event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey);
    const isCtrlX = (event.key === 'x' || event.key === 'X') && (event.ctrlKey || event.metaKey);
    const isCtrlV = (event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey);

    // CCP keybinds (both single keys and Ctrl variants)
    if (event.key === 'c' || event.key === 'C' || isCtrlC) {
      event.preventDefault();
      startCopy();
      return;
    }
    if (event.key === 'x' || event.key === 'X' || isCtrlX) {
      event.preventDefault();
      startCut();
      return;
    }
    if (event.key === 'p' || event.key === 'P' || isCtrlV) {
      event.preventDefault();
      pasteClipboard();
      return;
    }

    // In NORMAL mode
    switch(event.key) {
      // Navigation: j/k or Arrow keys
      case 'j':
      case 'ArrowDown':
        event.preventDefault();
        if (selectedIndex < items.length - 1) {
          selectedIndex++;
          rememberIndex[currentPath] = selectedIndex;
          lastFocusedPath = items[selectedIndex]?.path || null;
        }
        break;
      
      case 'k':
      case 'ArrowUp':
        event.preventDefault();
        if (selectedIndex > 0) {
          selectedIndex--;
          rememberIndex[currentPath] = selectedIndex;
          lastFocusedPath = items[selectedIndex]?.path || null;
        }
        break;
      
      // Enter directory or go up: l/h or Arrow keys
      case 'l':
      case 'ArrowRight':
      case 'Enter':
        event.preventDefault();
        if (items[selectedIndex]) {
          if (items[selectedIndex].isDirectory) {
            loadDirectory(items[selectedIndex].path, true);
          } else {
            // TODO: Open file
            console.log('Open file:', items[selectedIndex].path);
          }
        }
        break;
      
      case 'h':
      case 'ArrowLeft':
        event.preventDefault();
        goToParentDirectory();
        break;
      
      // Jump to bottom
      case 'G':
        event.preventDefault();
        selectedIndex = items.length - 1;
        rememberIndex[currentPath] = selectedIndex;
        lastFocusedPath = items[selectedIndex]?.path || null;
        break;
      
      // Rename
      case 'i':
        event.preventDefault();
        startRename();
        break;
      
      case 'F2':
        event.preventDefault();
        startRename();
        break;
      
      // Delete
      case 'd':
      case 'Delete':
        event.preventDefault();
        startDelete();
        break;
    }
  }

  // ======== Filter (in-directory) ========
  function startFilter() {
    mode = 'FILTER';
    filterQuery = '';
    // Position view cursor on current selection if it matches, else first match
    const idxInView = viewIndexMap.indexOf(selectedIndex);
    viewCursor = idxInView >= 0 ? idxInView : 0;
    setTimeout(() => filterInputEl && filterInputEl.focus(), 0);
  }
  function cancelFilter() {
    mode = 'NORMAL';
    filterQuery = '';
  }
  function acceptFilter() {
    // Keep current selection (mapped), just exit filter and clear query
    mode = 'NORMAL';
    filterQuery = '';
  }
  function handleFilterKeydown(event) {
    // Navigation within filtered results and accept/cancel
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelFilter();
      return;
    }

    // Enter opens selected item (like NORMAL 'Enter'), then exits FILTER
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const realIndex = viewIndexMap[viewCursor] ?? selectedIndex;
      if (typeof realIndex === 'number' && items[realIndex]) {
        selectedIndex = realIndex;
        rememberIndex[currentPath] = selectedIndex;
        const it = items[realIndex];
        if (it.isDirectory) {
          loadDirectory(it.path, true);
        } else {
          console.log('Open file:', it.path);
        }
      }
      acceptFilter();
      return;
    }

    // Arrow navigation moves within filtered list
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      if (viewCursor < viewItems.length - 1) viewCursor++;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (viewCursor > 0) viewCursor--;
      return;
    }

    // Modifier-based operations allowed in FILTER (letters must remain typeable)
    const isCtrlC = (event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey);
    const isCtrlX = (event.key === 'x' || event.key === 'X') && (event.ctrlKey || event.metaKey);
    const isCtrlV = (event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey);

    if (isCtrlC) {
      event.preventDefault();
      event.stopPropagation();
      const realIndex = viewIndexMap[viewCursor] ?? selectedIndex;
      if (typeof realIndex === 'number') {
        selectedIndex = realIndex;
        rememberIndex[currentPath] = selectedIndex;
      }
      startCopy();
      return;
    }
    if (isCtrlX) {
      event.preventDefault();
      event.stopPropagation();
      const realIndex = viewIndexMap[viewCursor] ?? selectedIndex;
      if (typeof realIndex === 'number') {
        selectedIndex = realIndex;
        rememberIndex[currentPath] = selectedIndex;
      }
      startCut();
      return;
    }
    if (isCtrlV) {
      event.preventDefault();
      event.stopPropagation();
      pasteClipboard();
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      event.stopPropagation();
      const realIndex = viewIndexMap[viewCursor] ?? selectedIndex;
      if (typeof realIndex === 'number') {
        selectedIndex = realIndex;
        rememberIndex[currentPath] = selectedIndex;
      }
      startDelete();
      return;
    }
  }
  $: if (mode === 'FILTER') {
    // Keep view cursor aligned when items or query change
    const idx = viewIndexMap.indexOf(selectedIndex);
    viewCursor = idx >= 0 ? idx : 0;
  }

  // ======== CCP Helpers & Actions ========
  function parseNameParts(name) {
    const lastDot = name.lastIndexOf('.');
    if (lastDot > 0 && lastDot !== name.length - 1) {
      return { base: name.slice(0, lastDot), ext: name.slice(lastDot) };
    }
    return { base: name, ext: '' };
  }

  async function uniqueCopyName(dir, originalName) {
    // Always start with "name 1" as per spec
    const { base, ext } = parseNameParts(originalName);
    let n = 1;
    while (true) {
      const candidate = `${base} ${n}${ext}`;
      const candidatePath = path.join(dir, candidate);
      const existsRes = await window.electronAPI.exists(candidatePath);
      if (!existsRes.success || !existsRes.exists) return candidate;
      n++;
    }
  }

  function startCopy() {
    // Determine entries: multi-selection or single
    let entries = [];
    if (selectedPaths && selectedPaths.size > 1) {
      entries = items.filter(it => selectedPaths.has(it.path));
    } else if (items[selectedIndex]) {
      entries = [items[selectedIndex]];
    }
    if (entries.length === 0) return;
    clipboard = { op: 'copy', entries: entries.map(e => ({ path: e.path, name: e.name, isDirectory: e.isDirectory })), sourceDir: currentPath };
    // Clear visual cut marks if switching op
    cutMarkedPaths = new Set();
    setStatus(entries.length === 1 ? `Copied: ${entries[0].name}` : `Copied: ${entries.length} items`);
  }

  function startCut() {
    // Determine entries: multi-selection or single
    let entries = [];
    if (selectedPaths && selectedPaths.size > 1) {
      entries = items.filter(it => selectedPaths.has(it.path));
    } else if (items[selectedIndex]) {
      entries = [items[selectedIndex]];
    }
    if (entries.length === 0) return;
    clipboard = { op: 'cut', entries: entries.map(e => ({ path: e.path, name: e.name, isDirectory: e.isDirectory })), sourceDir: currentPath };
    cutMarkedPaths = new Set(entries.map(e => e.path));
    setStatus(entries.length === 1 ? `Cut: ${entries[0].name} (Esc to cancel)` : `Cut: ${entries.length} items (Esc to cancel)`);
  }

  // Multi-paste support
  let pasteQueue = [];
  let pasteIndex = 0;

  async function pasteClipboard() {
    if (!clipboard) return;
    const destDir = currentPath;

    // Same-dir cut to same name(s) is a no-op
    if (clipboard.op === 'cut' && destDir === clipboard.sourceDir) {
      clipboard = null;
      cutMarkedPaths = new Set();
      setStatus('Cut cancelled (same directory)');
      return;
    }

    // Build entries to paste
    const entries = clipboard.entries && clipboard.entries.length ? clipboard.entries : (clipboard.entry ? [clipboard.entry] : []);
    if (!entries.length) return;

    pasteQueue = [];
    for (const entry of entries) {
      let targetName = entry.name;
      if (clipboard.op === 'copy' && destDir === clipboard.sourceDir) {
        // Same-dir copy: generate unique name per entry
        targetName = await uniqueCopyName(destDir, entry.name);
      }
      const destPath = path.join(destDir, targetName);
      pasteQueue.push({ entry, destPath, overwrite: false });
    }
    pasteIndex = 0;
    await processNextPasteItem();
  }

  async function processNextPasteItem() {
    if (pasteIndex >= pasteQueue.length) {
      // Done: reload dir, select last item, clear clipboard/marks
      await loadDirectory(currentPath, false);
      const last = pasteQueue[pasteQueue.length - 1];
      if (last) {
        const idx = items.findIndex(i => i.path === last.destPath);
        if (idx !== -1) {
          selectedIndex = idx;
          rememberIndex[currentPath] = idx;
        }
      }
      clipboard = null;
      cutMarkedPaths = new Set();
      // Clear multi-selection after paste to avoid confusion
      clearMultiSelection();
      setStatus(pasteQueue.length === 1 ? `Pasted: ${path.basename(pasteQueue[0].destPath)}` : `Pasted: ${pasteQueue.length} items`);
      return;
    }

    const item = pasteQueue[pasteIndex];
    const { entry, destPath } = item;

    // For copy into same dir we already generated unique names, so no conflict. For others, check existence.
    const existsRes = await window.electronAPI.exists(destPath);
    if (existsRes.success && existsRes.exists) {
      // Ask to overwrite for this item
      overwriteMessage = `An item named "${path.basename(destPath)}" already exists here. Overwrite?`;
      pendingPaste = async () => {
        item.overwrite = true;
        await doPasteOne(item);
        pasteIndex++;
        await processNextPasteItem();
      };
      showOverwriteDialog = true;
      return;
    }

    await doPasteOne(item);
    pasteIndex++;
    await processNextPasteItem();
  }

  async function doPasteOne({ entry, destPath, overwrite }) {
    try {
      const api = window.electronAPI || {};
      if (clipboard?.op === 'cut') {
        let res;
        if (typeof api.moveItems === 'function') {
          res = await api.moveItems([{ src: entry.path, dest: destPath, overwrite }]);
        } else if (typeof api.pasteItems === 'function') {
          res = await api.pasteItems([{ src: entry.path, dest: destPath, overwrite }], 'cut');
        } else {
          throw new Error('Paste failed: backend move API not available');
        }
        if (!res?.success) throw new Error(res?.results?.[0]?.error || 'Move failed');
      } else {
        let res;
        if (typeof api.copyItems === 'function') {
          res = await api.copyItems([{ src: entry.path, dest: destPath, overwrite }]);
        } else if (typeof api.pasteItems === 'function') {
          res = await api.pasteItems([{ src: entry.path, dest: destPath, overwrite }], 'copy');
        } else {
          throw new Error('Paste failed: backend copy API not available');
        }
        if (!res?.success) throw new Error(res?.results?.[0]?.error || 'Copy failed');
      }
    } catch (e) {
      console.error('Paste failed for', entry.path, e);
      alert(`Paste failed for ${entry.name}: ${e.message}`);
    }
  }

  function goToParentDirectory() {
    if (currentPath === '/') return; // Already at root
    
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    const currentFolderName = currentPath.split('/').pop();
    
    // Remember to highlight the folder we just came from
    loadDirectory(parentPath, true).then(() => {
      // Find the folder we just exited and select it
      const folderIndex = items.findIndex(item => item.name === currentFolderName);
      if (folderIndex !== -1) {
        selectedIndex = folderIndex;
        rememberIndex[parentPath] = folderIndex;
        // Center the selected parent folder in view on return
        centerToken++;
      }
    });
  }

  function handleSelect(index) {
    // Plain selection clears multi-select and VISUAL mode
    selectedIndex = index;
    rememberIndex[currentPath] = index;
    lastFocusedPath = items[index]?.path || null;
    if (selectedPaths.size > 0 || mode === 'VISUAL') {
      selectedPaths = new Set();
      visualAnchorPath = null;
      mode = 'NORMAL';
    }
  }

  function handleNavigate(newPath) {
    loadDirectory(newPath, true);
  }

  function navigateBack() {
    if (historyIndex > 0) {
      const prevDir = currentPath; // we are currently inside this dir
      historyIndex--;
      const targetDir = history[historyIndex];
      loadDirectory(targetDir, false).then(() => {
        // If we are going back to a directory that contains the previous dir, select that child
        const childName = prevDir.split('/').pop();
        const idx = items.findIndex(item => item.name === childName && item.isDirectory);
        if (idx !== -1) {
          selectedIndex = idx;
          rememberIndex[targetDir] = idx;
          // Center the selected child folder in the parent view
          centerToken++;
        }
      });
    }
  }

  function navigateForward() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      loadDirectory(history[historyIndex], false);
    }
  }

  // ======== VISUAL / Multi-selection helpers ========
  function findIndexByPath(p) {
    if (!p) return -1;
    return items.findIndex(i => i.path === p);
  }

  function clearMultiSelection() {
    selectedPaths = new Set();
    visualAnchorPath = null;
    if (mode === 'VISUAL') mode = 'NORMAL';
  }

  function enterVisualMode() {
    const curPath = items[selectedIndex]?.path;
    if (!curPath) return;
    mode = 'VISUAL';
    visualAnchorPath = visualAnchorPath || curPath;
    extendSelectionTo(selectedIndex);
  }

  function extendSelectionTo(targetIndex) {
    const anchorIdx = findIndexByPath(visualAnchorPath) ?? selectedIndex;
    const a = Math.max(0, Math.min(anchorIdx, targetIndex));
    const b = Math.min(items.length - 1, Math.max(anchorIdx, targetIndex));
    const next = new Set();
    for (let i = a; i <= b; i++) {
      const p = items[i]?.path;
      if (p) next.add(p);
    }
    selectedPaths = next;
  }

  function handleToggleSelect(listIndex) {
    const item = listItems[listIndex];
    if (!item) return;
    const p = item.path;
    const next = new Set(selectedPaths);

    // If this is the first Ctrl/Cmd-click and we currently have a single primary selection,
    // seed the multi-select with the currently focused item so X + Y are both selected.
    const primaryPath = items[selectedIndex]?.path || null;
    if (next.size === 0 && primaryPath && primaryPath !== p) {
      next.add(primaryPath);
      if (!visualAnchorPath) visualAnchorPath = primaryPath;
    }

    if (next.has(p)) next.delete(p); else next.add(p);

    selectedPaths = next;
    lastFocusedPath = p;

    // Auto-enter/exit VISUAL
    if (selectedPaths.size >= 2) {
      mode = 'VISUAL';
    } else if (selectedPaths.size <= 1 && mode === 'VISUAL') {
      // Keep cursor on the focused item and drop back to NORMAL
      mode = 'NORMAL';
    }

    // Ensure primary cursor follows focus
    const idx = findIndexByPath(p);
    if (idx !== -1) {
      selectedIndex = idx;
      rememberIndex[currentPath] = idx;
    }
  }

  function handleRangeSelect(listIndex) {
    const item = listItems[listIndex];
    if (!item) return;
    const targetPath = item.path;
    const anchorPath = (mode === 'VISUAL' && visualAnchorPath) || lastFocusedPath || items[selectedIndex]?.path || targetPath;
    const anchorIdx = findIndexByPath(anchorPath);
    const targetIdx = findIndexByPath(targetPath);
    if (anchorIdx === -1 || targetIdx === -1) return;
    visualAnchorPath = anchorPath;
    mode = 'VISUAL';
    extendSelectionTo(targetIdx);
    selectedIndex = targetIdx;
    rememberIndex[currentPath] = selectedIndex;
    lastFocusedPath = targetPath;
  }

  // Rename functions
  function startRename() {
    // Disable rename while in VISUAL (multi-selection)
    if (mode === 'VISUAL' || (selectedPaths && selectedPaths.size > 1)) return;
    if (items[selectedIndex]) {
      renamingIndex = selectedIndex;
      originalName = items[selectedIndex].name;
      renameValue = originalName;
      mode = 'INSERT';
    }
  }

  function handleRenameChange(newValue) {
    renameValue = newValue;
  }

  async function submitRename() {
    if (!renameValue || renameValue === originalName) {
      cancelRename();
      return;
    }

    const item = items[renamingIndex];
    const result = await window.electronAPI.rename(item.path, renameValue);

    if (result.success) {
      // Reload directory to show changes
      await loadDirectory(currentPath, false);
      // Find and select the renamed item
      const newIndex = items.findIndex(i => i.path === result.newPath);
      if (newIndex !== -1) {
        selectedIndex = newIndex;
        rememberIndex[currentPath] = newIndex;
      }
    } else {
      // Show error (for now, just log it)
      console.error('Rename failed:', result.error);
      alert(`Failed to rename: ${result.error}`);
    }

    cancelRename();
  }

  function cancelRename() {
    renamingIndex = -1;
    renameValue = '';
    originalName = '';
    mode = 'NORMAL';
  }

  // Delete functions (single or multi)
  function startDelete() {
    // Build targets from multi-selection if present, otherwise single selected
    let targets = [];
    if (selectedPaths && selectedPaths.size > 1) {
      targets = items.filter(it => selectedPaths.has(it.path)).map(it => ({ path: it.path, name: it.name, isDirectory: it.isDirectory }));
    } else if (items[selectedIndex]) {
      const it = items[selectedIndex];
      targets = [{ path: it.path, name: it.name, isDirectory: it.isDirectory }];
    }
    if (targets.length === 0) return;
    deleteTargets = targets;
    showDeleteDialog = true;
  }

  async function confirmDelete() {
    if (!deleteTargets || deleteTargets.length === 0) return;

    try {
      let ok = true;
      let failed = 0;
      if (deleteTargets.length === 1) {
        const t = deleteTargets[0];
        const res = await window.electronAPI.delete(t.path, t.isDirectory);
        ok = !!res?.success;
        if (!ok) failed = 1;
      } else if (typeof window.electronAPI.deleteMany === 'function') {
        const res = await window.electronAPI.deleteMany(deleteTargets.map(t => ({ path: t.path, isDirectory: t.isDirectory })));
        ok = !!res?.success;
        failed = (res?.results || []).filter(r => !r.success).length;
      } else {
        // Fallback: sequential single deletes
        for (const t of deleteTargets) {
          const res = await window.electronAPI.delete(t.path, t.isDirectory);
          if (!res?.success) failed++;
        }
        ok = failed === 0;
      }

      // Reload directory
      await loadDirectory(currentPath, false);
      // Clear multi-selection after delete
      clearMultiSelection();

      // Adjust selection bounds
      if (selectedIndex >= items.length) selectedIndex = Math.max(0, items.length - 1);
      rememberIndex[currentPath] = selectedIndex;

      if (failed > 0) {
        alert(`Deleted ${deleteTargets.length - failed} of ${deleteTargets.length} items. ${failed} failed.`);
      } else {
        setStatus(deleteTargets.length === 1 ? `Deleted: ${deleteTargets[0].name}` : `Deleted ${deleteTargets.length} items`);
      }
    } catch (e) {
      console.error('Delete failed:', e);
      alert(`Failed to delete: ${e.message}`);
    }

    cancelDelete();
  }

  function cancelDelete() {
    showDeleteDialog = false;
    deleteTargets = [];
  }

  // Overwrite dialog handlers
  async function confirmOverwrite() {
    showOverwriteDialog = false;
    if (pendingPaste) {
      const fn = pendingPaste;
      pendingPaste = null;
      await fn();
    }
  }

  function cancelOverwrite() {
    showOverwriteDialog = false;
    if (pendingPaste) {
      // If we are in a paste sequence and user cancels overwrite, skip this item and continue
      pendingPaste = null;
      if (pasteQueue && pasteIndex < pasteQueue.length) {
        pasteIndex++;
        processNextPasteItem();
        return;
      }
    }
    pendingPaste = null;
  }

  function handleSidebarResize(event) {
    const newWidth = event.detail.clientX;
    if (newWidth >= 150 && newWidth <= 400) {
      sidebarWidth = newWidth;
    }
  }

  function handlePreviewResize(event) {
    const containerWidth = window.innerWidth;
    const newWidth = containerWidth - event.detail.clientX;
    if (newWidth >= 250 && newWidth <= 800) {
      previewWidth = newWidth;
    }
  }

  $: canGoBack = historyIndex > 0;
  $: canGoForward = historyIndex < history.length - 1;
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="flex flex-col h-screen w-screen">
  <!-- Header / Breadcrumb -->
  <div class="tui-border-bright bg-terminal-bg-light px-4 py-2 flex items-center justify-between no-select">
    <div class="flex items-center gap-3">
      <!-- Navigation arrows -->
      <div class="flex items-center gap-1">
        <button
          class="nav-arrow"
          class:disabled={!canGoBack}
          on:click={navigateBack}
          disabled={!canGoBack}
          title="Back"
          tabindex="-1"
        >
          ◀
        </button>
        <button
          class="nav-arrow"
          class:disabled={!canGoForward}
          on:click={navigateForward}
          disabled={!canGoForward}
          title="Forward"
          tabindex="-1"
        >
          ▶
        </button>
      </div>
      
      <!-- Separator -->
      <div class="text-terminal-border">│</div>
      
      <!-- Path -->
      <div class="text-terminal-accent font-bold">
        <span class="text-terminal-fg-dim">❯</span> {currentPath || 'Loading...'}
      </div>
    </div>
    
    <div class="text-terminal-fg-dim text-tui-sm">
      🔍 Search
    </div>
  </div>

  <!-- Main Content Area -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Sidebar (Shortcuts & Devices) -->
    <div style="width: {sidebarWidth}px;" class="tui-border-bright flex-shrink-0">
      <Sidebar onNavigate={handleNavigate} {currentPath} />
    </div>

    <!-- Resizer between sidebar and file list -->
    <PaneResizer on:resize={handleSidebarResize} />

    <!-- File List Pane -->
    <div class="flex-1 flex flex-col tui-border-bright min-w-0">
      {#if loading}
        <div class="flex-1 flex items-center justify-center text-terminal-fg-dim">
          Loading...
        </div>
      {:else if error}
        <div class="flex-1 flex items-center justify-center text-terminal-error">
          Error: {error}
        </div>
      {:else}
        {#if mode === 'FILTER'}
          <div class="bg-terminal-bg-light px-4 py-1 border-b border-terminal-border text-terminal-fg-dim text-tui-sm flex items-center gap-2">
            <span class="text-terminal-accent">/</span>
            <input
              bind:this={filterInputEl}
              class="flex-1 bg-terminal-bg text-terminal-fg border border-terminal-border px-2 py-1 outline-none"
              placeholder="filter…"
              bind:value={filterQuery}
              on:keydown={handleFilterKeydown}
              on:click|stopPropagation
            />
          </div>
        {/if}
        <FileList 
          items={listItems}
          selectedIndex={selectedIndexForList}
          {renamingIndex}
          {renameValue}
          onNavigate={handleNavigate}
          onSelect={(i) => handleSelect(mode === 'FILTER' ? viewIndexMap[i] : i)}
          onToggleSelect={(i) => handleToggleSelect(i)}
          onRangeSelect={(i) => handleRangeSelect(i)}
          onRenameChange={handleRenameChange}
          onRenameSubmit={submitRename}
          onRenameCancel={cancelRename}
          {cutMarkedPaths}
          centerToken={centerToken}
          sortState={sortState}
          onSort={handleSortClick}
          selectedSet={selectedSetForList}
        />
      {/if}
    </div>

    <!-- Resizer between file list and preview -->
    <PaneResizer on:resize={handlePreviewResize} />

    <!-- Preview Pane -->
    <div style="width: {previewWidth}px;" class="tui-border-bright bg-terminal-bg-light flex items-center justify-center text-terminal-fg-dimmer flex-shrink-0">
      <div class="text-center">
        <div class="text-4xl mb-2">📄</div>
        <div>Preview pane</div>
        <div class="text-tui-sm mt-1">(Phase 3)</div>
      </div>
    </div>
  </div>

  <!-- Status Bar -->
  <StatusBar 
    {mode}
    selectedFile={items[selectedIndex]?.name || ''} 
    itemCount={items.length}
    statusMessage={statusMessage}
  />

  <!-- Keybinds Bar -->
  <KeybindsBar on:openHelp={() => showHelp = true} {mode} {platform} />
</div>

<!-- Help Modal -->
<HelpModal visible={showHelp} platform={platform} on:close={() => showHelp = false} />

<!-- Delete Confirmation Dialog -->
{#if showDeleteDialog && deleteTargets && deleteTargets.length > 0}
  <ConfirmDialog
    title={deleteTargets.length === 1 ? `Delete ${deleteTargets[0].isDirectory ? 'Folder' : 'File'}` : `Delete ${deleteTargets.length} items`}
    message={deleteTargets.length === 1
      ? `Are you sure you want to delete '${deleteTargets[0].name}'?${deleteTargets[0].isDirectory ? ' This will delete all contents.' : ''}`
      : `Are you sure you want to delete ${deleteTargets.length} items? This cannot be undone.`}
    confirmText="Delete"
    cancelText="Cancel"
    danger={true}
    on:confirm={confirmDelete}
    on:cancel={cancelDelete}
  />
{/if}

<!-- Overwrite Confirmation Dialog -->
{#if showOverwriteDialog}
  <ConfirmDialog
    title="Overwrite"
    message={overwriteMessage}
    confirmText="Overwrite"
    cancelText="Cancel"
    danger={false}
    on:confirm={confirmOverwrite}
    on:cancel={cancelOverwrite}
  />
{/if}

<style>
  .nav-arrow {
    background: transparent;
    border: none;
    color: var(--tw-text-terminal-accent);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    transition: opacity 0.15s;
  }

  .nav-arrow:hover:not(:disabled) {
    opacity: 0.7;
  }

  .nav-arrow:disabled {
    color: var(--tw-text-terminal-fg-dimmer);
    cursor: not-allowed;
    opacity: 0.3;
  }

  .nav-arrow.disabled {
    color: #504945;
    cursor: not-allowed;
  }
</style>