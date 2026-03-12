/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base:           '#09090e',
        surface:        '#0f0f16',
        elevated:       '#14141d',
        hover:          '#1a1a26',
        'border-faint': '#161622',
        'border-soft':  '#1e1e2e',
        'border-mid':   '#28283c',
        accent:         '#7c6af7',
        coral:          '#f06a6a',
        emerald:        '#45d483',
        'text-hi':      '#eaeaf4',
        'text-mid':     '#7a7a9e',
        'text-lo':      '#38384f',
      },
      fontFamily: {
        sans:    ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'accent-sm': '0 0 0 1px rgba(124,106,247,0.12), 0 4px 24px rgba(124,106,247,0.10)',
        'accent-md': '0 0 0 1px rgba(124,106,247,0.18), 0 4px 32px rgba(124,106,247,0.16)',
      },
    },
  },
  plugins: [],
};
