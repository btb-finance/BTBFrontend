'use client';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export const Providers = dynamic(() => import('./Providers').then(m => m.Providers), { ssr: false });
export const MiniApp = dynamic(() => import('./MiniApp').then(m => m.MiniApp), { ssr: false });
