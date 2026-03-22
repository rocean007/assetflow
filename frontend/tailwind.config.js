/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#080a0f',
        surface: '#0f1218',
        panel: '#131820',
        border: '#1c2333',
        accent: '#00c8ff',
        up: '#00e676',
        down: '#ff3d5a',
        warn: '#ffd740',
        muted: '#4a5568',
        dim: '#2d3748',
      },
    },
  },
  plugins: [],
};
