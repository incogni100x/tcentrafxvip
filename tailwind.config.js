/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          900: '#111827',
        },
        blue: {
          400: '#60a5fa',
        }
      }
    },
  },
  plugins: [],
} 