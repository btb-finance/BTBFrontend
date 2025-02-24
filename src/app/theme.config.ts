export const themeConfig = {

  colors: {
    primary: '#FF0420',
    primaryDark: '#E50019',
    primaryLight: '#FF3B52',
    secondary: '#1A1B1F',
    accent: '#00A3FF',
  },
  fonts: {
    heading: 'Montserrat, sans-serif',
    body: 'Roboto, sans-serif',
  },
  gradients: {
    primary: 'linear-gradient(to right, #FF0420, #FF3B52)',
    dark: 'linear-gradient(to right, #E50019, #FF0420)',
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
