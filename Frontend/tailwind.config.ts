import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1A103D", light: "#37306B" },
        secondary: "#37306B",
        accent: "#00C9DB",
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
        info: "#7C3AED",
        background: "#F4F3FB",
        surface: "#FFFFFF",
        "text-primary": "#1A103D",
        "text-secondary": "#6B7280",
        border: "#E5E7EB",
      },
      borderRadius: {
        card: "14px",
        button: "12px",
        input: "10px",
      },
      fontFamily: {
        cairo: ["Cairo", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
