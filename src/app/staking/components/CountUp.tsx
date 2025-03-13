import { useState, useEffect, useRef } from 'react';

interface CountUpProps {
  start: number;
  end: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  decimals?: number;
}

export default function CountUp({
  start,
  end,
  duration = 2000,
  delay = 0,
  prefix = '',
  suffix = '',
  separator = '',
  decimals = 0
}: CountUpProps) {
  const [count, setCount] = useState(start);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const updateCounter = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsedTime = timestamp - startTimeRef.current;
      
      if (elapsedTime < duration) {
        const progress = elapsedTime / duration;
        const currentValue = start + (end - start) * progress;
        setCount(currentValue);
        animationRef.current = requestAnimationFrame(updateCounter);
      } else {
        setCount(end);
      }
    };
    
    timeout = setTimeout(() => {
      animationRef.current = requestAnimationFrame(updateCounter);
    }, delay);
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      clearTimeout(timeout);
    };
  }, [start, end, duration, delay]);
  
  const formatNumber = (num: number) => {
    const fixed = num.toFixed(decimals);
    const parts = fixed.toString().split('.');
    
    if (separator) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    }
    
    return `${prefix}${parts.join('.')}${suffix}`;
  };
  
  return <>{formatNumber(count)}</>;
}
