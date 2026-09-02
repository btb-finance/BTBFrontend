import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    background_color: SITE.backgroundColor,
    theme_color: SITE.themeColor,
    categories: ['finance', 'defi'],
    // The 'any' icons are transparent outside the coin, so a browser tab or
    // launcher shows the logo rather than a white tile. 'maskable' needs its
    // own file: Android crops it to an arbitrary shape, so that one is opaque
    // and keeps the coin inside the 80% safe zone instead of being clipped.
    icons: [
      { src: '/icon.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
