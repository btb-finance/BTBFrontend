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
        'btb-primary': '#8B0000',
        'btb-primary-dark': '#660000',
        'btb-primary-light': '#A52A2A',
        secondary: '#1A1E23',
        accent: '#10B981',
        // OP Superchain colors - darkened for eye comfort
        opRed: '#8B0000',
        opRedDark: '#660000',
        opRedLight: '#A52A2A',
        opBlack: '#121212',
        opWhite: '#F8F8F8',
        opGray: '#8A8A97',
        // Optimism colors (for classes like optimism-red)
        optimism: {
          red: '#8B0000',
          'red-dark': '#660000',
          'red-light': '#A52A2A',
          black: '#121212',
          white: '#F8F8F8',
          gray: '#898989',
          'gray-light': '#E1E1E1'
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
        superchain: ['Montserrat', 'sans-serif'],
      },
      backgroundImage: {
        'btb-gradient': 'linear-gradient(to right, #8B0000, #A52A2A)',
        'btb-gradient-dark': 'linear-gradient(to right, #660000, #8B0000)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
