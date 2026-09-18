/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tactical: {
          950: '#0b0d13',
          900: '#161922',
          850: '#1c202b',
          800: '#242936',
          700: '#32394a',
          600: '#475166',
          100: '#f1f3f7',
          50: '#f8fafc',
        },
        brand: {
          lime: '#c8f135',
          limeBright: '#d8ff3f',
          limeHover: '#b5dd2c',
          limeLight: '#f3fde0',
          limeBorder: '#aee322',
        },
        slate: {
          canvas: '#eceff4',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'tactical-sm': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        'tactical-md': '0 4px 12px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.02)',
        'tactical-active': '0 0 0 1px #c8f135, 0 4px 16px rgba(200, 241, 53, 0.25)',
      }
    },
  },
  plugins: [],
}
