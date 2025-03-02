'use client';

import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 40, showText = true, className = '' }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center space-x-3 ${className}`}>
      <div className="rounded-full overflow-hidden shadow-md" style={{ height: `${size}px`, width: `${size}px` }}>
        <Image 
          src="/images/btblogo.jpg" 
          width={size} 
          height={size} 
          alt="BTB Finance Logo"
          priority
          className="h-full w-full"
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="self-center text-xl font-bold whitespace-nowrap text-white">
            BTBFinance
          </span>
        </div>
      )}
    </Link>
  );
}
