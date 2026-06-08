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
    icons: [
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon', sizes: '512x512', type: 'image/png' },
    ],
  };
}
