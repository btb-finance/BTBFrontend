'use client';

import React from 'react';

export default function GrainOverlay({ opacity = 0.03 }: { opacity?: number }) {
    return (
        <div
            className="fixed inset-0 pointer-events-none z-50 mix-blend-overlay"
            style={{ opacity }}
        >
            <svg className="w-full h-full">
                <filter id="noiseFilter">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.8"
                        numOctaves="3"
                        stitchTiles="stitch"
                    />
                </filter>
                <rect width="100%" height="100%" filter="url(#noiseFilter)" />
            </svg>
        </div>
    );
}
