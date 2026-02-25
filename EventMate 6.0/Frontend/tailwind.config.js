/** @type {import('"'"'tailwindcss'"'"').Config} */
const config = {
  content: ["./src/**/*.{jsx,ts,tsx}", "./index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#818cf8",
          600: "#6366f1",
          700: "#4f46e5",
          800: "#4338ca",
          900: "#3730a3",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
