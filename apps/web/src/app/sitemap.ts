import type { MetadataRoute } from 'next'

const PAGES: Array<[path: string, priority: number]> = [
  ['', 1],
  ['/pricing', 0.9],
  ['/use-cases', 0.8],
  ['/about', 0.6],
  ['/contact', 0.6],
  ['/legal/terms', 0.3],
  ['/legal/privacy', 0.3],
  ['/legal/acceptable-use', 0.3],
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, priority]) => ({
    url: `https://strimz.finance${path}`,
    changeFrequency: path.startsWith('/legal') ? 'yearly' : 'monthly',
    priority,
  }))
}
