'use client';

import React, { useEffect, useRef, useState } from 'react';

interface StepProps {
  number: number;
  title: string;
  description: string;
  position: {
    top: string;
    left: string;
  };
  active: boolean;
}

const FlywheelStep: React.FC<StepProps> = ({ number, title, description, position, active }) => {
  return (
    <div 
      className={`absolute w-44 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 ${
        active ? 'border-btb-primary scale-110 z-20' : 'border-btb-primary-light'
      } transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-105 hover:z-10`}
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center mb-2">
        <div className={`w-7 h-7 rounded-full ${
          active ? 'bg-btb-primary-dark' : 'bg-btb-primary'
        } text-white flex items-center justify-center font-bold mr-2 transition-colors duration-300`}>
          {number}
        </div>
        <h4 className="font-semibold text-btb-primary-dark text-sm">{title}</h4>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
};

const FlywheelDiagram: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);
  const requestRef = useRef<number>();
  const rotationRef = useRef(0);

  // Define steps based on updated mechanics
  const steps = [
    {
      number: 1,
      title: "Lock BTB Tokens",
      description: "FIRST STEP: Users must lock BTB tokens to access BTBY/USDC trading",
      position: { top: "15%", left: "50%" }
    },
    {
      number: 2,
      title: "Trade BTBY/USDC",
      description: "Trading generates 0.1% fees with our unique bonding curve",
      position: { top: "25%", left: "80%" }
    },
    {
      number: 3,
      title: "Fees to LP",
      description: "All trading fees fund BTBY/ETH liquidity providers on Uniswap",
      position: { top: "50%", left: "90%" }
    },
    {
      number: 4,
      title: "Price Always Rises",
      description: "BTBY price increases with BOTH buys AND sells",
      position: { top: "75%", left: "80%" }
    },
    {
      number: 5,
      title: "Arbitrage Profit",
      description: "Traders keep 100% of arbitrage profits between platforms",
      position: { top: "85%", left: "50%" }
    },
    {
      number: 6,
      title: "LP Growth",
      description: "Increased trading fees attract more LP providers to BTBY/ETH",
      position: { top: "75%", left: "20%" }
    },
    {
      number: 7,
      title: "BTB Holder Rewards",
      description: "BTB token holders benefit from all arbitrage activity",
      position: { top: "50%", left: "10%" }
    },
    {
      number: 8,
      title: "Growing Ecosystem",
      description: "Win-win system drives sustainable growth for all participants",
      position: { top: "25%", left: "20%" }
    },
  ];

  useEffect(() => {
    // Set up animation cycle for active step
    const intervalId = setInterval(() => {
      if (isAnimating) {
        setActiveStep(prev => (prev % steps.length) + 1);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isAnimating, steps.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions and handle high DPI displays
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // For high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Animation function
    const animate = () => {
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Center points
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;
      const radius = Math.min(centerX, centerY) - 40;

      // Draw flywheel (circle)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#3B82F6'; // btb-primary
      ctx.lineWidth = 8;
      ctx.stroke();

      // Draw second circle - inner mechanism
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.7, 0, 2 * Math.PI);
      ctx.strokeStyle = '#60A5FA'; // btb-primary-light
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw spokes connecting inner and outer circles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * 2 * Math.PI + rotationRef.current;
        const innerX = centerX + radius * 0.7 * Math.cos(angle);
        const innerY = centerY + radius * 0.7 * Math.sin(angle);
        const outerX = centerX + radius * Math.cos(angle);
        const outerY = centerY + radius * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.strokeStyle = '#60A5FA'; // btb-primary-light
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw BTB logo/text in center
      ctx.fillStyle = '#3B82F6';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BTB', centerX, centerY - 12);
      ctx.font = 'bold 16px Arial';
      ctx.fillText('EXCHANGE', centerX, centerY + 12);

      // Draw moving particles along the circle path to indicate flow
      const particleCount = 24;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * 2 * Math.PI + rotationRef.current * 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        const isNearActiveStep = Math.abs(((i / particleCount) * 8) % 8 - (activeStep - 1)) < 0.5 ||
                                Math.abs(((i / particleCount) * 8) % 8 - (activeStep - 1)) > 7.5;
        
        ctx.beginPath();
        ctx.arc(x, y, isNearActiveStep ? 4 : 2, 0, 2 * Math.PI);
        ctx.fillStyle = isNearActiveStep ? '#2563EB' : '#60A5FA';
        ctx.fill();
      }

      // Draw arrows along the circle
      const drawArrow = (angle: number, isActive: boolean) => {
        const arrowLength = 20;
        const arrowWidth = 8;
        
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        // Calculate direction tangent to the circle
        const dirX = -Math.sin(angle);
        const dirY = Math.cos(angle);
        
        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(x - dirX * arrowLength / 2, y - dirY * arrowLength / 2);
        ctx.lineTo(x + dirX * arrowLength / 2, y + dirY * arrowLength / 2);
        ctx.strokeStyle = isActive ? '#2563EB' : '#3B82F6'; // btb-primary-dark or btb-primary
        ctx.lineWidth = isActive ? 6 : 4;
        ctx.stroke();
        
        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(x + dirX * arrowLength / 2, y + dirY * arrowLength / 2);
        ctx.lineTo(
          x + dirX * arrowLength / 2 - dirX * arrowWidth - dirY * arrowWidth,
          y + dirY * arrowLength / 2 - dirY * arrowWidth + dirX * arrowWidth
        );
        ctx.lineTo(
          x + dirX * arrowLength / 2 - dirX * arrowWidth + dirY * arrowWidth,
          y + dirY * arrowLength / 2 - dirY * arrowWidth - dirX * arrowWidth
        );
        ctx.closePath();
        ctx.fillStyle = isActive ? '#2563EB' : '#3B82F6';
        ctx.fill();
      };
      
      // Draw 8 arrows evenly spaced around the circle, with the active one highlighted
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * 2 * Math.PI + rotationRef.current;
        drawArrow(angle, i === activeStep - 1);
      }

      // Update rotation for animation
      rotationRef.current += isAnimating ? 0.002 : 0;
      
      requestRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [activeStep, isAnimating]);

  return (
    <div className="relative w-full h-[500px] my-8">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full cursor-pointer" 
        onClick={() => setIsAnimating(!isAnimating)}
      ></canvas>
      
      {steps.map((step) => (
        <FlywheelStep
          key={step.number}
          number={step.number}
          title={step.title}
          description={step.description}
          position={step.position}
          active={step.number === activeStep}
        />
      ))}
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
        Click the diagram to {isAnimating ? 'pause' : 'resume'} animation
      </div>
    </div>
  );
};

export default FlywheelDiagram;
