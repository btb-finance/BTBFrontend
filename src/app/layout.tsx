import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTB Finance",
  description: "Swap, stake, and mint NFTs — BTB Finance mini app",
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
