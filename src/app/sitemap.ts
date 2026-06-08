import type { MetadataRoute } from 'next';
import { SITE, SECTIONS } from '@/lib/seo/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return SECTIONS.map((s) => ({
    url: `${SITE.url}${s.path === '/' ? '' : s.path}`,
    lastModified,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));
}
