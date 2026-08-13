// Paleta confirmada en el PID, sección 3.6 — identidad "Planet Fitness".
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F3ECFB', 100: '#EDE4F7', 200: '#D8C2EF',
          300: '#BB94E2', 400: '#9A63D1', 500: '#7E3FF2',
          600: '#6B21A8', 700: '#561496', 800: '#4A1680',
          900: '#3D1166', 950: '#2E0A4D',
        },
        accent: {
          100: '#FFF9CC', 400: '#FFEE4D', 500: '#FFE600',
          600: '#E6CF00', 700: '#B8A600',
        },
        danger: { 500: '#E8384F' },
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: { xl: '1rem', '2xl': '1.25rem' },
      boxShadow: { card: '0 4px 16px rgba(46,10,77,0.12)' },
    },
  },
  plugins: [],
};
