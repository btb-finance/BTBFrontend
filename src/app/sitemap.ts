import { PROTOCOLS } from '@/lib/mcp/registryData';
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
    { url: `${SITE.url}/agents`, lastModified, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${SITE.url}/agents/docs`, lastModified, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE.url}/agents/protocols`, lastModified, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE.url}/agents/playground`, lastModified, changeFrequency: 'monthly' as const, priority: 0.6 },
    ...PROTOCOLS.map((p) => ({ url: `${SITE.url}/agents/protocols/${p.slug}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.6 })),
    { url: `${SITE.url}/terms`, lastModified, changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${SITE.url}/risk`, lastModified, changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${SITE.url}/privacy`, lastModified, changeFrequency: 'monthly' as const, priority: 0.3 },
    ...COMPETITORS.map((c) => ({ url: `${SITE.url}/${c.slug}-alternative`, lastModified, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
