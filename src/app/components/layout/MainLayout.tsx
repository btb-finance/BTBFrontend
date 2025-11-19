'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import QuickAccess from './QuickAccess';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isHomePage = pathname === '/';

    return (
        <main className={`${isHomePage ? '' : 'pt-14'} text-gray-900 dark:text-white min-h-screen`}>
            {children}
            <QuickAccess />
        </main>
    );
}
