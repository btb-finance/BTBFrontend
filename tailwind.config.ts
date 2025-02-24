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
        primary: '#FF0420',
        'primary-dark': '#E50019',
        'primary-light': '#FF3B52',
        secondary: '#1A1B1F',
        accent: '#00A3FF',
      },
    },
  },
  plugins: [],
}
export default config
