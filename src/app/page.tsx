'use client';

import React, { Suspense } from 'react';
import HeroSection from './components/home/bolder/HeroSection';
import EcosystemShowcase from './components/home/bolder/EcosystemShowcase';
import FloatingDock from './components/home/bolder/FloatingDock';
import CommunitySection from './components/home/bolder/CommunitySection';
import DataMonolith from './components/home/bolder/DataMonolith';
import CoreNarrative from './components/home/bolder/CoreNarrative';
import GrainOverlay from './components/home/bolder/GrainOverlay';

export default function Home() {
    return (
        <main className="bg-black min-h-screen selection:bg-white selection:text-black">
            <GrainOverlay />
            <Suspense fallback={<div className="min-h-screen bg-black" />}>
                <HeroSection />
                <CoreNarrative />
                <EcosystemShowcase />
                <CommunitySection />
                <FloatingDock />
            </Suspense>
        </main>
    );
}
