/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        // TUI-inspired color palette (Gruvbox-ish)
        terminal: {
          bg: '#1d2021',
          'bg-light': '#282828',
          'bg-lighter': '#3c3836',
          fg: '#ebdbb2',
          'fg-dim': '#a89984',
          'fg-dimmer': '#928374',
          border: '#504945',
          'border-bright': '#665c54',
          accent: '#fabd2f',
          'accent-dim': '#d79921',
          success: '#b8bb26',
          error: '#fb4934',
          warning: '#fe8019',
          info: '#83a598',
          selected: '#458588',
          'selected-bright': '#83a598',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      },
      fontSize: {
        'tui': '0.875rem',
        'tui-sm': '0.75rem'
      }
    },
  },
  plugins: [],
}