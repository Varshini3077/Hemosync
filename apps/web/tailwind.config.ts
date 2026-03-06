import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "hemosync-red": "#C8102E",
        "hemosync-navy": "#1B3A6B",
        "hemosync-gold": "#F5A623",
      },
      animation: {
        "pulse-urgent": "pulse-urgent 1s ease-in-out infinite",
        "waveform": "waveform 1.2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-urgent": {
          "0%, 100%": {
            opacity: "1",
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(200, 16, 46, 0.7)",
          },
          "50%": {
            opacity: "0.8",
            transform: "scale(1.02)",
            boxShadow: "0 0 0 8px rgba(200, 16, 46, 0)",
          },
        },
        waveform: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
