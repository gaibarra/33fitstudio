/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#D1DB92',
        primary: '#97A546',
        primaryDark: '#9FAD4E',
        accent: '#F9E791',
      },
      borderRadius: {
        xl: '18px',
      },
      fontFamily: {
        sans: ['"Montserrat"', '"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
