import type { MetadataRoute } from 'next'
import { DOCS_ORIGIN } from '@strimz/web-shared/lib/structured-data'
import { source } from '@/lib/source'

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${DOCS_ORIGIN}${page.url}`,
    changeFrequency: 'weekly',
    priority: page.url === '/docs' ? 1 : 0.7,
  }))
}
