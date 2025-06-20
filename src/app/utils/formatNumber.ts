export function formatNumber(value: string | number, decimals?: number): string {
  // Convert string to number if needed
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Handle invalid numbers
  if (isNaN(numValue)) {
    return '0';
  }

  // Use provided decimals or default behavior
  if (decimals !== undefined) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(numValue);
  }

  // For numbers less than 1, show up to 6 decimal places
  if (Math.abs(numValue) < 1) {
    return numValue.toFixed(6).replace(/\.?0+$/, '');
  }
  
  // For numbers greater than 1, use comma separators and show up to 2 decimal places
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numValue);
}
