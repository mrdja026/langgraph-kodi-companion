import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#1F3A52",
        card: "#2A4A62",
        border: "#3A5A72",
        primary: "#6BA3FF",
        "text-primary": "#EAF0F8",
        "text-muted": "#9FAAB8",
      },
      borderRadius: {
        DEFAULT: "0.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
