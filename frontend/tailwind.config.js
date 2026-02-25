/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#f8f3e6', // Existing light mode base
        baseDark: '#0f110b', // Elegant dark mode base (off-black with slight olive tint)
        primary: '#97A546',
        primaryDark: '#9FAD4E',
        accent: '#F9E791',
        glassBorder: 'rgba(255, 255, 255, 0.2)',
        glassBg: 'rgba(255, 255, 255, 0.65)',
      },
      borderRadius: {
        xl: '18px',
      },
      fontFamily: {
        sans: ['"Inter"', '"Montserrat"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-hover': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
      }
    },
  },
  plugins: [],
};
