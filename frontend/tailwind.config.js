/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        foreground: "#f8fafc",
        primary: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          muted: "rgba(99, 102, 241, 0.1)",
        },
        secondary: "#94a3b8",
        accent: "#f43f5e",
        card: {
          DEFAULT: "rgba(15, 23, 42, 0.6)",
          hover: "rgba(30, 41, 59, 0.8)",
        },
        border: "rgba(255, 255, 255, 0.08)",
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
