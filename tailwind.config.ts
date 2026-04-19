import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#060816",
        panel: "#0b1022",
        line: "rgba(255,255,255,0.08)",
        accent: {
          DEFAULT: "#7dd3fc",
          strong: "#38bdf8",
          soft: "rgba(125,211,252,0.18)"
        },
        signal: "#a3e635"
      },
      boxShadow: {
        glow: "0 18px 60px rgba(56,189,248,0.12)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top, rgba(125,211,252,0.16), transparent 40%), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)"
      },
      backgroundSize: {
        "hero-grid": "100% 100%, 42px 42px, 42px 42px"
      }
    }
  },
  plugins: []
};

export default config;
