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
          mint: "#00F5A0",
          "mint-dark": "#00CC80",
          "mint-light": "#33FFB5",
        },
        surface: {
          black: "#0C0C1D",
          dark: "#141428",
          card: "#1C1C36",
          "card-hover": "#252545",
          border: "#2A2A50",
        },
        text: {
          primary: "#E8E8F0",
          secondary: "#A0A0B8",
          muted: "#6B6B85",
          dark: "#0C0C1D",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 245, 160, 0.08)",
        "glow-lg": "0 0 40px rgba(0, 245, 160, 0.12)",
        card: "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)",
        "card-hover":
          "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 245, 160, 0.06)",
      },
    },
  },
  plugins: [],
};
