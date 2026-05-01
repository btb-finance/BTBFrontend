import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { BottomNav } from '@/components/BottomNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'BTB Finance',
  description: 'BTB Finance on Ethereum. Wrap BTB, trade FLIP, mint Bears, and stake for protocol rewards.',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/newbtb32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/newbtb32x32.png',
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
      <body className="min-h-dvh pb-24" suppressHydrationWarning>
        <Providers>
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
