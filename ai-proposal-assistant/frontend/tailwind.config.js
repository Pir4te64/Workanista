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
          orange: "#E85002",
          "orange-dark": "#C10801",
          "orange-light": "#F16001",
          cream: "#D9C3AB",
        },
        surface: {
          black: "#000000",
          dark: "#0A0A0A",
          card: "#141414",
          "card-hover": "#1A1A1A",
          border: "#222222",
        },
        text: {
          primary: "#F9F9F9",
          secondary: "#A7A7A7",
          muted: "#646464",
          dark: "#333333",
        },
      },
    },
  },
  plugins: [],
};
