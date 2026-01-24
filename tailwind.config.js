/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#071D49",  // Azul oscuro
        accent: "#0EBEFF",
        teal: "#14BF96",
        soft: "#F5F5F5"
      }
    }
  },
  plugins: []
}
