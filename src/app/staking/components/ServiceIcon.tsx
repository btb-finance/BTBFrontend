import React from 'react';

interface ServiceIconProps {
  name: string;
  color: string;
  size?: number;
}

export default function ServiceIcon({ name, color, size = 40 }: ServiceIconProps) {
  // Extract initials for the icon
  const initials = name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
  
  // Extract colors from the gradient class
  const getColors = (colorClass: string) => {
    try {
      const parts = colorClass.split(' ');
      if (parts.length >= 2) {
        const fromPart = parts.find(p => p.startsWith('from-'));
        const toPart = parts.find(p => p.startsWith('to-'));
        
        if (fromPart && toPart) {
          const fromColor = fromPart.replace('from-', '');
          const toColor = toPart.replace('to-', '');
          return { fromColor, toColor };
        }
      }
    } catch (error) {
      console.error('Error parsing color class:', error);
    }
    
    // Default colors if parsing fails
    return { fromColor: 'blue-500', toColor: 'blue-700' };
  };
  
  const { fromColor, toColor } = getColors(color);
  
  // Generate a unique ID for the gradient
  const gradientId = `gradient-${name.replace(/\s+/g, '-').toLowerCase()}`;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', overflow: 'hidden' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: `var(--${fromColor}, #3b82f6)` }} />
          <stop offset="100%" style={{ stopColor: `var(--${toColor}, #1d4ed8)` }} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradientId})`} />
      <text 
        x="50" 
        y="50" 
        dominantBaseline="middle" 
        textAnchor="middle" 
        fill="white" 
        fontFamily="sans-serif" 
        fontWeight="bold" 
        fontSize="40"
      >
        {initials}
      </text>
    </svg>
  );
}
