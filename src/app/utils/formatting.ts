/**
 * Utility functions for formatting values
 */

/**
 * Format a number as USD currency
 */
export const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined) return '$0.00';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  if (amount >= 1_000_000_000) {
    return formatter.format(amount / 1_000_000_000) + 'B';
  } else if (amount >= 1_000_000) {
    return formatter.format(amount / 1_000_000) + 'M';
  } else if (amount >= 1_000) {
    return formatter.format(amount / 1_000) + 'K';
  }
  
  return formatter.format(amount);
};

/**
 * Format a number as a percentage
 */
export const formatPercent = (percent: number | undefined): string => {
  if (percent === undefined) return '0%';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(percent / 100);
};

/**
 * Format an Ethereum address for display
 */
export const formatAddress = (address: string | undefined): string => {
  if (!address) return '';
  
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Format a token amount based on decimals
 */
export const formatTokenAmount = (amount: string | number, decimals: number = 18): string => {
  if (!amount) return '0';
  
  const amountNumber = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formattedAmount = amountNumber / Math.pow(10, decimals);
  
  if (formattedAmount < 0.001) {
    return '< 0.001';
  }
  
  return formattedAmount.toLocaleString('en-US', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  });
};

/**
 * Format a timestamp as a date string
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format a time period (in seconds) as a readable string
 */
export const formatTimePeriod = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} sec`;
  }
  
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min`;
  }
  
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hr`;
  }
  
  return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) !== 1 ? 's' : ''}`;
};
