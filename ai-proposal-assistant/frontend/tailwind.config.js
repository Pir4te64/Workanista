/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Variable", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          purple: "#7C3AED",
          "purple-dark": "#5B21B6",
          "purple-light": "#A855F7",
          mint: "#4AEAAA",
          "mint-dark": "#38C890",
          "mint-light": "#6CF0BE",
        },
        surface: {
          black: "#111118",
          dark: "#1A1A2E",
          card: "#222240",
          "card-hover": "#2C2C52",
          border: "#363660",
        },
        text: {
          primary: "#EDEDF4",
          secondary: "#B0B0C8",
          muted: "#8888A8",
          dark: "#111118",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(74, 234, 170, 0.1)",
        "glow-lg": "0 0 40px rgba(74, 234, 170, 0.14)",
        card: "0 1px 3px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15)",
        "card-hover":
          "0 4px 20px rgba(0, 0, 0, 0.35), 0 0 20px rgba(74, 234, 170, 0.08)",
      },
    },
  },
  plugins: [],
};
