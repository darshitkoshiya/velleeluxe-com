import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './context/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '4px',
      full: '9999px',
    },
    extend: {
      colors: {
        linen: '#F6F1E8',
        ink: '#1C2230',
        'ink-muted': '#6F6A62',
        accent: '#C8623D',
        oxford: '#7D98B3',
        sand: '#E4DACB',
        pebble: '#B8B0A4',
        surface: '#EDE7DA',
        persimmon: '#C8623D',
        slateGrey: '#6F6A62',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-newsreader)', 'Georgia', 'serif'],
      },
      letterSpacing: {
        widest: '0.2em',
        label: '0.16em',
        wordmark: '0.15em',
      },
      aspectRatio: {
        product: '3 / 4',
      },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 300ms ease-out',
        'slide-in-left': 'slide-in-left 300ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
