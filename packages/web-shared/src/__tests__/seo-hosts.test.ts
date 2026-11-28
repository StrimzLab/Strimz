import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  AREA_SERVED,
  faqPageLd,
  jsonLdScript,
  organizationLd,
  techArticleLd,
} from '../lib/structured-data'

const APPS = join(__dirname, '..', '..', '..', '..', 'apps')
const read = (path: string) => readFileSync(join(APPS, path), 'utf8')

describe('each host tells search engines what to index (#468)', () => {
  it.each([
    ['web', 'https://strimz.finance/sitemap.xml'],
    ['docs', 'https://docs.strimz.finance/sitemap.xml'],
  ])('%s is indexable and points at its own sitemap', (app, sitemap) => {
    expect(read(`${app}/src/app/robots.ts`)).toContain(sitemap)
    expect(existsSync(join(APPS, app, 'src/app/sitemap.ts'))).toBe(true)
  })

  it.each(['dashboard', 'admin', 'checkout'])(
    '%s stays crawlable so its noindex is seen, and has no sitemap',
    (app) => {
      const robots = read(`${app}/src/app/robots.ts`)
      expect(robots).toMatch(/allow: '\/'/u)
      expect(robots).not.toMatch(/sitemap/u)
      expect(read(`${app}/src/app/layout.tsx`)).toMatch(
        /robots: \{ index: false, follow: false \}/u,
      )
    },
  )

  it('lists every marketing page in the sitemap', () => {
    const sitemap = read('web/src/app/sitemap.ts')
    for (const page of ['/pricing', '/use-cases', '/about', '/contact', '/legal/privacy']) {
      expect(sitemap).toContain(`'${page}'`)
    }
  })

  it('gives each docs page a canonical URL and article data', () => {
    const page = read('docs/src/app/docs/[[...slug]]/page.tsx')
    expect(page).toMatch(/canonical: page\.url/u)
    expect(page).toMatch(/techArticleLd/u)
    expect(page).toMatch(/breadcrumbLd/u)
  })
})

describe('structured data', () => {
  it('names the organisation, its profiles and the African markets it serves', () => {
    const org = organizationLd()
    expect(org.sameAs).toContain('https://x.com/Strimz_HQ')
    expect(AREA_SERVED).toEqual(expect.arrayContaining(['Nigeria', 'Kenya', 'Ghana']))
    expect(org.areaServed).toHaveLength(AREA_SERVED.length)
  })

  it('turns FAQs into questions with accepted answers', () => {
    const faq = faqPageLd([{ q: 'Is it custodial?', a: 'No.' }])
    expect(faq.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'Is it custodial?',
        acceptedAnswer: { '@type': 'Answer', text: 'No.' },
      },
    ])
  })

  it('cannot close its script tag from page text', () => {
    const out = jsonLdScript(techArticleLd({ title: '</script><script>x()', url: 'https://x' }))
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out).headline).toBe('</script><script>x()')
  })

  it('wraps several things in one graph', () => {
    const out = JSON.parse(jsonLdScript(organizationLd(), techArticleLd({ title: 't', url: 'u' })))
    expect(out['@context']).toBe('https://schema.org')
    expect(out['@graph']).toHaveLength(2)
  })
})
