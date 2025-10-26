// Centralized keybinds dataset for Help modal and Keybinds bar
// Each entry: { id, keys: string[], desc, category, mode: 'NORMAL'|'INSERT'|'ALL', implemented: boolean }

export const categories = [
  'navigation',
  'file operations',
  'modes',
  'misc'
];

export function isMac(platform) {
  return platform === 'darwin';
}

export function normalizeKeyLabel(k, platform) {
  // Convert 'C-x' to Ctrl/⌘ form for display
  if (!k) return k;
  if (k.startsWith('C-')) {
    const base = k.slice(2).toUpperCase();
    return isMac(platform) ? `⌘+${base}` : `C-${base}`;
  }
  return k;
}

export const keybinds = [
  // Navigation (kept for Help, hidden in KeybindsBar)
  { id: 'up', keys: ['j', 'down'], desc: 'move down', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'down', keys: ['k', 'up'], desc: 'move up', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'open', keys: ['l', 'enter', 'right'], desc: 'open', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'parent', keys: ['h', 'left'], desc: 'go to parent', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'bottom', keys: ['G'], desc: 'jump to bottom', category: 'navigation', mode: 'NORMAL', implemented: true },

  // File operations
  { id: 'copy', keys: ['c', 'C-c'], desc: 'copy', category: 'file operations', mode: 'ALL', implemented: true },
  { id: 'cut', keys: ['x', 'C-x'], desc: 'cut', category: 'file operations', mode: 'ALL', implemented: true },
  { id: 'paste', keys: ['p', 'C-v'], desc: 'paste', category: 'file operations', mode: 'ALL', implemented: true },
  { id: 'delete', keys: ['d', 'del'], desc: 'delete', category: 'file operations', mode: 'ALL', implemented: true },

  // Modes / Actions
  { id: 'visual-toggle', keys: ['v'], desc: 'visual', category: 'modes', mode: 'NORMAL', implemented: true },
  { id: 'rename', keys: ['i', 'F2'], desc: 'rename', category: 'modes', mode: 'NORMAL', implemented: true },
  { id: 'esc-insert', keys: ['esc'], desc: 'cancel', category: 'modes', mode: 'INSERT', implemented: true },
  { id: 'esc-visual', keys: ['esc'], desc: 'clear', category: 'modes', mode: 'VISUAL', implemented: true },
  { id: 'esc-cut-cancel', keys: ['esc'], desc: 'cancel cut', category: 'modes', mode: 'NORMAL', implemented: true },

  // Filter mode specific labels (subset of functionality allowed while typing)
  { id: 'filter-nav-down', keys: ['down'], desc: 'move down', category: 'navigation', mode: 'FILTER', implemented: true },
  { id: 'filter-nav-up', keys: ['up'], desc: 'move up', category: 'navigation', mode: 'FILTER', implemented: true },
  { id: 'filter-open', keys: ['enter'], desc: 'open / enter', category: 'navigation', mode: 'FILTER', implemented: true },
  { id: 'esc-filter', keys: ['esc'], desc: 'exit filter', category: 'modes', mode: 'FILTER', implemented: true },
  // show only modifier-based ops in FILTER (KeybindsBar filters to Ctrl variants)
  { id: 'copy-filter', keys: ['C-c'], desc: 'copy', category: 'file operations', mode: 'FILTER', implemented: true },
  { id: 'cut-filter', keys: ['C-x'], desc: 'cut', category: 'file operations', mode: 'FILTER', implemented: true },
  { id: 'paste-filter', keys: ['C-v'], desc: 'paste', category: 'file operations', mode: 'FILTER', implemented: true },
  { id: 'delete-filter', keys: ['delete'], desc: 'delete', category: 'file operations', mode: 'FILTER', implemented: true },

  // Search (recursive)
  { id: 'search-open', keys: ['C-f'], desc: 'search (recursive)', category: 'misc', mode: 'NORMAL', implemented: true },
  { id: 'search-nav-down', keys: ['down'], desc: 'move down', category: 'navigation', mode: 'SEARCH', implemented: true },
  { id: 'search-nav-up', keys: ['up'], desc: 'move up', category: 'navigation', mode: 'SEARCH', implemented: true },
  { id: 'search-open-enter', keys: ['enter'], desc: 'reveal', category: 'navigation', mode: 'SEARCH', implemented: true },
  { id: 'esc-search', keys: ['esc'], desc: 'exit search', category: 'modes', mode: 'SEARCH', implemented: true },

  // Misc
  { id: 'filter', keys: ['/'], desc: 'filter', category: 'misc', mode: 'NORMAL', implemented: true },
  // { id: 'help', keys: ['?'], desc: 'open help', category: 'Misc', mode: 'NORMAL', implemented: true },
];

export function groupKeybinds(binds = keybinds) {
  const map = new Map();
  for (const cat of categories) map.set(cat, []);
  for (const b of binds) {
    const list = map.get(b.category) || [];
    list.push(b);
    map.set(b.category, list);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}
