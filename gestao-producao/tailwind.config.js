/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1C2632',
        blue: '#2C3B4E',
        terra: '#9F5234',
        yellow: '#FEC761',
        beige: '#CCC1A9',
        warm: '#FFFCF4',
        bg: '#F5F3EE',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        sm2: '7px',
      },
    },
  },
  plugins: [],
}
