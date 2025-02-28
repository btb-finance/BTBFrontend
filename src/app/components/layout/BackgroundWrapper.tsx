"use client";

import { ReactNode } from 'react';
import { BackgroundPaths } from '@/components/ui/background-paths';

interface BackgroundWrapperProps {
  children: ReactNode;
}

export default function BackgroundWrapper({ children }: BackgroundWrapperProps) {
  return (
    <div className="relative min-h-screen w-full">
      {/* Background paths with reduced opacity and z-index to stay behind content */}
      <div className="fixed inset-0 -z-10 opacity-30">
        <BackgroundPaths title="" />
      </div>
      
      {/* Main content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}