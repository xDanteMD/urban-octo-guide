/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0d0d0f',
        surface: '#141418',
        border: '#2a2a35',
        accent: '#7c6af7',
        coral: '#f76a6a',
        'text-body': '#c8c8d4',
        'text-heading': '#f0f0f8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
