/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#edfcff',
          100: '#d1f7fe',
          200: '#a8f1fd',
          300: '#5be5fb',
          400: '#13cff2',
          500: '#00b3d8',
          600: '#0092b4',
          700: '#077491',
          800: '#0e5f77',
          900: '#104f63',
          950: '#053445',
        },
        surface: {
          base:    '#0D1117',
          raised:  '#161C26',
          overlay: '#1E2736',
          border:  '#2A3548',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 8px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5)',
        glow: '0 0 20px rgba(0,179,216,0.25)',
      },
      animation: {
        'slide-up': 'slideUp 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
