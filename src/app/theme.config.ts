export const themeConfig = {

  colors: {
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    primaryLight: '#60A5FA',
    secondary: '#1A1B1F',
    accent: '#00A3FF',
  },
  fonts: {
    heading: 'Montserrat, sans-serif',
    body: 'Roboto, sans-serif',
  },
  gradients: {
    primary: 'linear-gradient(to right, #3B82F6, #60A5FA)',
    dark: 'linear-gradient(to right, #2563EB, #3B82F6)',
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
