/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'biolab-green': '#A9D08E',
        'biolab-purple': '#D9E1F2',
        'biolab-orange': '#F4B084',
        'biolab-blue': '#5D8AA8',
        'biolab-dark': '#2C3E50',
        'biolab-light': '#ECF0F1',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}