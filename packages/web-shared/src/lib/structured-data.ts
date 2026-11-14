export const SITE_ORIGIN = 'https://strimz.finance'
export const DOCS_ORIGIN = 'https://docs.strimz.finance'

const ORG_ID = `${SITE_ORIGIN}/#organization`

export const SOCIAL_PROFILES = [
  'https://x.com/Strimz_HQ',
  'https://www.linkedin.com/company/strimzhq/',
  'https://github.com/StrimzLab/strimz',
] as const

// Markets Strimz serves first; shown to search engines as areaServed.
export const AREA_SERVED = ['Nigeria', 'Ghana', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda'] as const

type Thing = Record<string, unknown>

const countries = () => AREA_SERVED.map((name) => ({ '@type': 'Country', name }))

export function organizationLd(): Thing {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Strimz',
    url: SITE_ORIGIN,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_ORIGIN}/favicon-512x512.png`,
      width: 512,
      height: 512,
    },
    description:
      'Stablecoin payments and subscription billing for businesses in East and West Africa and beyond. Customers pay in USDC or EURC and the money lands in your own wallet.',
    email: 'support@strimz.finance',
    sameAs: [...SOCIAL_PROFILES],
    areaServed: countries(),
  }
}

export function websiteLd(): Thing {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    name: 'Strimz',
    url: SITE_ORIGIN,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en',
  }
}

export function softwareApplicationLd(): Thing {
  return {
    '@type': 'SoftwareApplication',
    name: 'Strimz',
    url: SITE_ORIGIN,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description:
      'Take one-time and subscription payments in USDC and EURC. Hosted checkout, payment links, invoices, webhooks and SDKs. Every payment settles in your own wallet in seconds.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: '0% on your first $1,000, then a small fee per transaction.',
    },
    publisher: { '@id': ORG_ID },
    areaServed: countries(),
  }
}

export function faqPageLd(items: ReadonlyArray<{ q: string; a: string }>): Thing {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

export function breadcrumbLd(trail: ReadonlyArray<{ name: string; url: string }>): Thing {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function techArticleLd(page: { title: string; description?: string; url: string }): Thing {
  return {
    '@type': 'TechArticle',
    headline: page.title,
    ...(page.description ? { description: page.description } : {}),
    url: page.url,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Strimz Docs', url: DOCS_ORIGIN },
    publisher: { '@id': ORG_ID, '@type': 'Organization', name: 'Strimz', url: SITE_ORIGIN },
  }
}

// `<` is escaped so page text can never close the script tag.
export function jsonLdScript(...things: Thing[]): string {
  const body =
    things.length === 1
      ? { '@context': 'https://schema.org', ...things[0] }
      : { '@context': 'https://schema.org', '@graph': things }
  return JSON.stringify(body).replace(/</gu, '\\u003c')
}
