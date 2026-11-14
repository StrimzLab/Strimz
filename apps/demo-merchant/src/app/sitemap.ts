import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://fanline.strimz.finance/', changeFrequency: 'monthly', priority: 1 }]
}
