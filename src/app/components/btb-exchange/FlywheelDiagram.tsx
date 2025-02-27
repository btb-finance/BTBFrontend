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
  mobilePosition: {
    top: string;
    left: string;
  };
  active: boolean;
  isMobile: boolean;
}

const FlywheelStep: React.FC<StepProps> = ({ number, title, description, position, mobilePosition, active, isMobile }) => {
  const posToUse = isMobile ? mobilePosition : position;
  
  return (
    <div 
      className={`absolute ${isMobile ? 'w-32' : 'w-44'} p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 ${
        active ? 'border-btb-primary scale-110 z-20' : 'border-btb-primary-light'
      } transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-105 hover:z-10`}
      style={{ top: posToUse.top, left: posToUse.left }}
    >
      <div className="flex items-center mb-1">
        <div className={`${isMobile ? 'w-5 h-5' : 'w-7 h-7'} rounded-full ${
          active ? 'bg-btb-primary-dark' : 'bg-btb-primary'
        } text-white flex items-center justify-center font-bold mr-2 transition-colors duration-300 text-xs md:text-sm`}>
          {number}
        </div>
        <h4 className="font-semibold text-btb-primary-dark text-xs md:text-sm">{title}</h4>
      </div>
      <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-600 dark:text-gray-300`}>{description}</p>
    </div>
  );
};

const FlywheelDiagram: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const requestRef = useRef<number>();
  const rotationRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile(); // Check on initial render
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Define steps based on updated mechanics
  const steps = [
    {
      number: 1,
      title: "Lock BTB Tokens",
      description: "FIRST STEP: Users must lock BTB tokens to access BTBY/USDC trading",
      position: { top: "15%", left: "50%" },
      mobilePosition: { top: "7%", left: "50%" }
    },
    {
      number: 2,
      title: "Trade BTBY/USDC",
      description: "Trading generates 0.1% fees with our unique bonding curve",
      position: { top: "25%", left: "80%" },
      mobilePosition: { top: "16%", left: "86%" }
    },
    {
      number: 3,
      title: "Fees to LP",
      description: "All trading fees fund BTBY/ETH liquidity providers on Uniswap",
      position: { top: "50%", left: "90%" },
      mobilePosition: { top: "40%", left: "93%" }
    },
    {
      number: 4,
      title: "Price Always Rises",
      description: "BTBY price increases with BOTH buys AND sells",
      position: { top: "75%", left: "80%" },
      mobilePosition: { top: "62%", left: "86%" }
    },
    {
      number: 5,
      title: "Arbitrage Profit",
      description: "Traders keep 100% of arbitrage profits between platforms",
      position: { top: "85%", left: "50%" },
      mobilePosition: { top: "74%", left: "50%" }
    },
    {
      number: 6,
      title: "LP Growth",
      description: "Increased trading fees attract more LP providers to BTBY/ETH",
      position: { top: "75%", left: "20%" },
      mobilePosition: { top: "62%", left: "14%" }
    },
    {
      number: 7,
      title: "BTB Holder Rewards",
      description: "BTB token holders benefit from all arbitrage activity",
      position: { top: "50%", left: "10%" },
      mobilePosition: { top: "40%", left: "7%" }
    },
    {
      number: 8,
      title: "Growing Ecosystem",
      description: "Win-win system drives sustainable growth for all participants",
      position: { top: "25%", left: "20%" },
      mobilePosition: { top: "16%", left: "14%" }
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

  // Setup canvas dimensions and resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial canvas dimensions
    const updateCanvasDimensions = () => {
      // Get the display size
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      
      // For high DPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      
      ctx.scale(dpr, dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    };

    // Initial setup
    updateCanvasDimensions();
    
    // Add resize listener
    window.addEventListener('resize', updateCanvasDimensions);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Animation function
    const animate = () => {
      if (!ctx) return;
      
      // Get current canvas dimensions
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      
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
      const textSize = isMobile ? 20 : 24;
      const subTextSize = isMobile ? 14 : 16;
      ctx.font = `bold ${textSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BTB', centerX, centerY - (isMobile ? 10 : 12));
      ctx.font = `bold ${subTextSize}px Arial`;
      ctx.fillText('EXCHANGE', centerX, centerY + (isMobile ? 10 : 12));

      // Draw moving particles along the circle path to indicate flow
      const particleCount = 24;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * 2 * Math.PI + rotationRef.current * 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        const isNearActiveStep = Math.abs(((i / particleCount) * 8) % 8 - (activeStep - 1)) < 0.5 ||
                                Math.abs(((i / particleCount) * 8) % 8 - (activeStep - 1)) > 7.5;
        
        const particleSize = isMobile ? (isNearActiveStep ? 3 : 1.5) : (isNearActiveStep ? 4 : 2);
        
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, 2 * Math.PI);
        ctx.fillStyle = isNearActiveStep ? '#2563EB' : '#60A5FA';
        ctx.fill();
      }

      // Draw arrows along the circle
      const drawArrow = (angle: number, isActive: boolean) => {
        const arrowLength = isMobile ? 16 : 20;
        const arrowWidth = isMobile ? 6 : 8;
        
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
        ctx.lineWidth = isActive ? (isMobile ? 4 : 6) : (isMobile ? 3 : 4);
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

    // Start animation
    animate();

    // Cleanup animation on unmount
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [activeStep, isAnimating, isMobile]);

  return (
    <div className="relative w-full h-[400px] md:h-[500px] my-8" ref={containerRef}>
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
          mobilePosition={step.mobilePosition}
          active={step.number === activeStep}
          isMobile={isMobile}
        />
      ))}
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs md:text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
        Click the diagram to {isAnimating ? 'pause' : 'resume'} animation
      </div>
    </div>
  );
};

export default FlywheelDiagram;
