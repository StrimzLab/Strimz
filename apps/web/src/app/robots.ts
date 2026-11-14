import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://strimz.finance/sitemap.xml',
    host: 'https://strimz.finance',
  }
}
