import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { BottomNav } from '@/components/BottomNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'BTB Finance',
  description: 'BTB Finance - DeFi Innovation on Ethereum',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/newbtb32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/icon.svg',
  },
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh pb-20" suppressHydrationWarning>
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
