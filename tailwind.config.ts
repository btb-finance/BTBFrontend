import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-mesh": "radial-gradient(at 40% 20%, rgb(99, 102, 241) 0px, transparent 50%), radial-gradient(at 80% 0%, rgb(236, 72, 153) 0px, transparent 50%), radial-gradient(at 0% 50%, rgb(67, 56, 202) 0px, transparent 50%), radial-gradient(at 80% 50%, rgb(52, 211, 153) 0px, transparent 50%), radial-gradient(at 0% 100%, rgb(99, 102, 241) 0px, transparent 50%), radial-gradient(at 80% 100%, rgb(168, 85, 247) 0px, transparent 50%), radial-gradient(at 0% 0%, rgb(236, 72, 153) 0px, transparent 50%)",
        "hero-pattern": "linear-gradient(to right bottom, rgba(99, 102, 241, 0.8), rgba(79, 70, 229, 0.8))"
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)' },
          '100%': { boxShadow: '0 0 10px rgba(99, 102, 241, 0.8), 0 0 40px rgba(99, 102, 241, 0.5)' }
        }
      },
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          dark: "var(--primary-dark)",
          light: "var(--primary-light)"
        },
        background: {
          dark: "var(--background-dark)",
          light: "var(--background-light)",
          card: "var(--background-card)"
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)"
        },
        accent: {
          success: "var(--accent-success)",
          warning: "var(--accent-warning)",
          error: "var(--accent-error)"
        }
      },
      borderColor: {
        DEFAULT: "var(--border-color)"
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        lg: "var(--shadow-lg)"
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        DEFAULT: "var(--transition-normal)",
        slow: "var(--transition-slow)"
      },
      transitionTimingFunction: {
        DEFAULT: "var(--ease-in-out)"
      }
    },
  },
  plugins: [],
};
export default config;
