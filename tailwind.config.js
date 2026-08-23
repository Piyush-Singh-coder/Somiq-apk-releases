/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 preset required
  presets: [require("nativewind/preset")],
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,ts}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--primary) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        tertiary: "rgb(var(--tertiary) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        accentLavender: "rgb(var(--accent-lavender) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          container: "rgb(var(--surface) / <alpha-value>)",
          low: "rgb(var(--surface-low) / <alpha-value>)",
          high: "rgb(var(--surface-high) / <alpha-value>)",
          inner: "rgb(var(--surface-inner) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--text-primary) / <alpha-value>)",
          muted: "rgb(var(--text-secondary) / <alpha-value>)",
          outline: "rgb(var(--text-muted) / <alpha-value>)",
          disabled: "rgb(var(--text-disabled) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        error: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
        },
        gold: "rgb(var(--gold) / <alpha-value>)",
        "gold-soft": "rgb(var(--gold-soft) / <alpha-value>)",
      },
      fontFamily: {
        headline: ["System"],       // Fallback system typography
        body: ["System"],
        mono: ["System"],
      },
    },
  },
  plugins: [],
};
