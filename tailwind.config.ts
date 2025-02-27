import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'btb-primary': '#3B82F6',
        'btb-primary-dark': '#2563EB',
        'btb-primary-light': '#60A5FA',
        secondary: '#1A1B1F',
        accent: '#00A3FF',
      },
    },
  },
  plugins: [],
}
export default config
