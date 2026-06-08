import type { Metadata, Viewport } from 'next';
import { SITE } from './config';

/**
 * Root metadata applied to the whole app. `opengraph-image.tsx` /
 * `apple-icon.tsx` (app conventions) auto-populate the image tags, and
 * `manifest.ts` / `robots.ts` / `sitemap.ts` are picked up by their file names.
 */
export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: SITE.titleTemplate },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: 'finance',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    url: SITE.url,
    locale: SITE.locale,
    title: SITE.title,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE.twitter,
    creator: SITE.twitter,
    title: SITE.title,
    description: SITE.description,
  },
  appleWebApp: {
    capable: true,
    title: SITE.shortName,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const baseViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: SITE.themeColor,
};

/**
 * Per-section metadata builder — use from a route's `generateMetadata`/
 * `metadata` export if/when the tabs become their own pages.
 */
export function buildMetadata(opts: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
}): Metadata {
  const description = opts.description ?? SITE.description;
  const canonical = opts.path ?? '/';
  const fullTitle = `${opts.title} · ${SITE.name}`;
  return {
    title: opts.title,
    description,
    keywords: opts.keywords ? [...SITE.keywords, ...opts.keywords] : undefined,
    alternates: { canonical },
    openGraph: { title: fullTitle, description, url: canonical },
    twitter: { title: fullTitle, description },
  };
}
