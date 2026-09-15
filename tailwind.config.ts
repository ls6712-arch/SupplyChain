import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF8",
        paperDim: "#F1EFE7",
        ink: "#1C1F26",
        inkSoft: "#5B5F6B",
        hairline: "#DDD8CC",
        denim: "#2B3A67",
        denimSoft: "#E7EAF3",
        green: "#3F6B4F",
        greenSoft: "#E5EEE8",
        amber: "#B4772B",
        amberSoft: "#F5E9D8",
        clay: "#A63D40",
        claySoft: "#F5E1E1",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
