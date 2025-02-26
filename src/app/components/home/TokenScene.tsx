'use client';

import { useState, useEffect } from 'react';

export default function TokenScene() {
  const [coins, setCoins] = useState<{id: number, x: number, y: number, size: number, speed: number, delay: number}[]>([]);
  
  useEffect(() => {
    // Generate random coins
    const newCoins = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 30 + 20,
      speed: Math.random() * 10 + 5,
      delay: Math.random() * 5
    }));
    
    setCoins(newCoins);
  }, []);
  
  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-gradient-to-br from-btb-primary-dark/10 via-btb-primary/5 to-btb-primary-light/10">
      {/* Background elements */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-3/4 h-3/4 bg-btb-primary/5 rounded-full animate-pulse"></div>
        <div className="absolute w-1/2 h-1/2 bg-btb-primary/10 rounded-full animate-pulse animation-delay-2000"></div>
      </div>
      
      {/* Animated grid */}
      <div className="absolute inset-0 grid-bg"></div>
      
      {/* Animated coins */}
      {coins.map((coin) => (
        <div 
          key={coin.id}
          className="absolute coin-animation"
          style={{
            left: `${coin.x}%`,
            top: `${coin.y}%`,
            width: `${coin.size}px`,
            height: `${coin.size}px`,
            animationDuration: `${coin.speed}s`,
            animationDelay: `${coin.delay}s`
          }}
        >
          <svg 
            viewBox="0 0 100 100" 
            className="w-full h-full animate-spin"
            style={{ animationDuration: `${coin.speed * 2}s` }}
          >
            <circle cx="50" cy="50" r="45" fill="#E30613" />
            <text
              x="50"
              y="60"
              textAnchor="middle"
              fontSize="30"
              fontWeight="bold"
              fill="white"
            >
              BTB
            </text>
          </svg>
        </div>
      ))}
      
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center z-10 px-6 py-8 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 shadow-xl">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">BTB Finance</h2>
          <p className="text-white/80 mb-4">The Future of Decentralized Trading</p>
          <div className="glow-button">
            <button className="bg-gradient-to-r from-btb-primary to-btb-primary-light text-white px-6 py-2 rounded-full font-medium hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              Explore Platform
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
