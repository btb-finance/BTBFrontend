import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { BottomNav } from '@/components/BottomNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'BTB Finance',
  description: 'BTB Finance - DeFi Innovation on Ethereum',
  icons: { icon: '/newbtb32x32.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#06060b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh pb-20">
        <Providers>
          <div className="page-glow relative">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
