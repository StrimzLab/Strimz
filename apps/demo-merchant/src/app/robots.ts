import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/thanks', '/cancelled'] },
    sitemap: 'https://fanline.strimz.finance/sitemap.xml',
  }
}
