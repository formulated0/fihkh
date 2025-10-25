// Centralized keybinds dataset for Help modal and Keybinds bar
// Each entry: { id, keys: string[], desc, category, mode: 'NORMAL'|'INSERT'|'ALL', implemented: boolean }

export const categories = [
  'Navigation',
  'File operations',
  'Modes',
  'Misc'
];

export function isMac(platform) {
  return platform === 'darwin';
}

export function normalizeKeyLabel(k, platform) {
  // Convert 'C-x' to Ctrl/⌘ form for display
  if (!k) return k;
  if (k.startsWith('C-')) {
    const base = k.slice(2).toUpperCase();
    return isMac(platform) ? `⌘+${base}` : `Ctrl+${base}`;
  }
  return k;
}

export const keybinds = [
  // Navigation
  { id: 'up', keys: ['j', 'down'], desc: 'move down', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'down', keys: ['k', 'up'], desc: 'move up', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'open', keys: ['l', 'enter', 'right'], desc: 'open', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'parent', keys: ['h', 'left'], desc: 'go to parent', category: 'navigation', mode: 'NORMAL', implemented: true },
  { id: 'bottom', keys: ['G'], desc: 'jump to bottom', category: 'navigation', mode: 'NORMAL', implemented: true },

  // File operations
  { id: 'copy', keys: ['c', 'C-c'], desc: 'copy', category: 'File operations', mode: 'ALL', implemented: true },
  { id: 'cut', keys: ['x', 'C-x'], desc: 'cut', category: 'File operations', mode: 'ALL', implemented: true },
  { id: 'paste', keys: ['p', 'C-v'], desc: 'paste', category: 'File operations', mode: 'ALL', implemented: true },
  { id: 'delete', keys: ['d', 'Delete'], desc: 'delete', category: 'File operations', mode: 'ALL', implemented: true },

  // Modes / Actions
  { id: 'visual-toggle', keys: ['v'], desc: 'toggle visual (multi-select)', category: 'Modes', mode: 'NORMAL', implemented: true },
  { id: 'rename', keys: ['i', 'F2'], desc: 'rename (INSERT mode)', category: 'Modes', mode: 'NORMAL', implemented: true },
  { id: 'esc-insert', keys: ['Esc'], desc: 'cancel rename (back to NORMAL)', category: 'Modes', mode: 'INSERT', implemented: true },
  { id: 'esc-visual', keys: ['Esc'], desc: 'exit visual (clear multi-select)', category: 'Modes', mode: 'VISUAL', implemented: true },
  { id: 'esc-cut-cancel', keys: ['Esc'], desc: 'cancel pending cut', category: 'Modes', mode: 'NORMAL', implemented: true },

  // Filter mode specific labels (subset of functionality allowed while typing)
  { id: 'filter-nav-down', keys: ['ArrowDown'], desc: 'move down (filtered)', category: 'Navigation', mode: 'FILTER', implemented: true },
  { id: 'filter-nav-up', keys: ['ArrowUp'], desc: 'move up (filtered)', category: 'Navigation', mode: 'FILTER', implemented: true },
  { id: 'filter-open', keys: ['Enter'], desc: 'open / enter (filtered)', category: 'Navigation', mode: 'FILTER', implemented: true },
  { id: 'esc-filter', keys: ['Esc'], desc: 'exit filter', category: 'Modes', mode: 'FILTER', implemented: true },
  // show only modifier-based ops in FILTER (KeybindsBar filters to Ctrl variants)
  { id: 'copy-filter', keys: ['C-c'], desc: 'copy (while filtering)', category: 'File operations', mode: 'FILTER', implemented: true },
  { id: 'cut-filter', keys: ['C-x'], desc: 'cut (while filtering)', category: 'File operations', mode: 'FILTER', implemented: true },
  { id: 'paste-filter', keys: ['C-v'], desc: 'paste (while filtering)', category: 'File operations', mode: 'FILTER', implemented: true },
  { id: 'delete-filter', keys: ['Delete'], desc: 'delete (while filtering)', category: 'File operations', mode: 'FILTER', implemented: true },

  // Misc
  { id: 'filter', keys: ['/'], desc: 'filter (live)', category: 'Misc', mode: 'NORMAL', implemented: true },
  { id: 'help', keys: ['?'], desc: 'open help', category: 'Misc', mode: 'NORMAL', implemented: true },
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
