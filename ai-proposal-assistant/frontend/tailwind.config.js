/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7C3AED",
          "purple-dark": "#5B21B6",
          "purple-light": "#A855F7",
          mint: "#00F5A0",
          "mint-dark": "#00CC80",
          "mint-light": "#33FFB5",
        },
        surface: {
          black: "#1A1A2E",
          dark: "#222240",
          card: "#2A2A4A",
          "card-hover": "#333360",
          border: "#3D3D6B",
        },
        text: {
          primary: "#F0F0F5",
          secondary: "#C0C0D0",
          muted: "#8888A0",
          dark: "#1A1A2E",
        },
      },
    },
  },
  plugins: [],
};
