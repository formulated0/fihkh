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
  { id: 'up', keys: ['j', 'ArrowDown'], desc: 'move down', category: 'Navigation', mode: 'NORMAL', implemented: true },
  { id: 'down', keys: ['k', 'ArrowUp'], desc: 'move up', category: 'Navigation', mode: 'NORMAL', implemented: true },
  { id: 'open', keys: ['l', 'Enter', 'ArrowRight'], desc: 'open / enter', category: 'Navigation', mode: 'NORMAL', implemented: true },
  { id: 'parent', keys: ['h', 'ArrowLeft'], desc: 'go to parent', category: 'Navigation', mode: 'NORMAL', implemented: true },
  { id: 'bottom', keys: ['G'], desc: 'jump to bottom', category: 'Navigation', mode: 'NORMAL', implemented: true },

  // File operations
  { id: 'copy', keys: ['c', 'C-c'], desc: 'copy', category: 'File operations', mode: 'NORMAL', implemented: true },
  { id: 'cut', keys: ['x', 'C-x'], desc: 'cut', category: 'File operations', mode: 'NORMAL', implemented: true },
  { id: 'paste', keys: ['p', 'C-v'], desc: 'paste', category: 'File operations', mode: 'NORMAL', implemented: true },
  { id: 'delete', keys: ['d', 'Delete'], desc: 'delete', category: 'File operations', mode: 'NORMAL', implemented: true },

  // Modes / Actions
  { id: 'rename', keys: ['i', 'F2'], desc: 'rename (INSERT mode)', category: 'Modes', mode: 'NORMAL', implemented: true },
  { id: 'esc-insert', keys: ['Esc'], desc: 'cancel rename (back to NORMAL)', category: 'Modes', mode: 'INSERT', implemented: true },
  { id: 'esc-cut-cancel', keys: ['Esc'], desc: 'cancel pending cut', category: 'Modes', mode: 'NORMAL', implemented: true },

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
