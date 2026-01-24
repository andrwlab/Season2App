/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--brand)",
        accent: "var(--accent)",
        teal: "var(--success)",
        soft: "var(--surface)"
      }
    }
  },
  plugins: []
}
