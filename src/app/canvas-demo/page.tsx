'use client';

import { useEffect } from 'react';
import { renderCanvas } from '@/components/ui/canvas';

export default function CanvasDemo() {
  useEffect(() => {
    // Initialize the canvas when the component mounts
    renderCanvas();
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Canvas element that will be used by the renderCanvas function */}
      <canvas
        id="canvas"
        className="absolute inset-0 w-full h-full z-0"
      ></canvas>
      
      {/* Overlay content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white p-6">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-opRed to-opRedLight bg-clip-text text-transparent">
            Interactive Canvas Demo
          </h1>
          <p className="text-xl mb-8">
            Move your mouse or touch the screen to interact with the flowing lines.
            This canvas component can be integrated into any part of your BTB Finance interface.
          </p>
          <div className="inline-block px-4 py-1 mb-4 rounded-full bg-opRed/10 border border-opRed/20">
            <p className="text-sm font-medium text-opRed">Powered by designali-in/canvas</p>
          </div>
        </div>
      </div>
    </div>
  );
}