import type { MetadataRoute } from 'next';
import { SITE, SECTIONS } from '@/lib/seo/config';
import { COMPETITORS } from '@/lib/seo/competitors';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    ...SECTIONS.map((s) => ({
      url: `${SITE.url}${s.path === '/' ? '' : s.path}`,
      lastModified,
      changeFrequency: s.changeFrequency,
      priority: s.priority,
    })),
    { url: `${SITE.url}/vs`, lastModified, changeFrequency: 'weekly' as const, priority: 0.8 },
    ...COMPETITORS.map((c) => ({ url: `${SITE.url}/${c.slug}-alternative`, lastModified, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
