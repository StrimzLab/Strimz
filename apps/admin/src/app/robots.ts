import type { MetadataRoute } from 'next'

// Crawlable so search engines can read each page's noindex; nothing here belongs in results.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: '/api/' } }
}
