export const themeConfig = {

  colors: {
    primary: '#8B0000',
    primaryDark: '#660000',
    primaryLight: '#A52A2A',
    secondary: '#1A1E23',
    accent: '#10B981',
    // OP Superchain colors - darkened for eye comfort
    opRed: '#8B0000',
    opRedDark: '#660000',
    opRedLight: '#A52A2A',
    opBlack: '#121212',
    opWhite: '#F8F8F8',
    opGray: '#8A8A97',
  },
  fonts: {
    heading: 'Montserrat, sans-serif',
    body: 'Roboto, sans-serif',
    // OP Superchain typography
    superchain: 'Montserrat, sans-serif',
  },
  gradients: {
    primary: 'linear-gradient(to right, #8B0000, #A52A2A)',
    dark: 'linear-gradient(to right, #660000, #8B0000)',
    // OP Superchain gradients
    superchain: 'linear-gradient(to right, #8B0000, #A52A2A)',
    superchainDark: 'linear-gradient(90deg, #8B0000 0%, #660000 100%)',
  },
  borderRadius: {
    small: '0.375rem',
    medium: '0.5rem',
    large: '1rem',
    full: '9999px',
  },
  shadows: {
    card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    hover: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  transitions: {
    default: '200ms ease-in-out',
    slow: '300ms ease-in-out',
    fast: '100ms ease-in-out',
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};
