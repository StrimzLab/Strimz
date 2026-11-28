import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isDocsUrl, siteUrls } from '@strimz/web-shared/lib/site-urls'

// #585: links to the docs open in a new tab, so visitors keep their place on the site.
const SRC = join(__dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

// A computed href may point at the docs, so it must go through SiteLink.
const SAFE_HREF =
  /^(`(\$\{siteUrls\.(dashboard|site)|#|\/|mailto:)|mailto\(|bookDemoUrl$|startHref$)/u

describe('docs links', () => {
  it('knows a docs URL', () => {
    expect(isDocsUrl(`${siteUrls.docs}/docs/quickstart`)).toBe(true)
    expect(isDocsUrl(siteUrls.docs)).toBe(true)
    expect(isDocsUrl(`${siteUrls.docs}.evil.example/docs`)).toBe(false)
    expect(isDocsUrl(`${siteUrls.dashboard}/signup`)).toBe(false)
    expect(isDocsUrl('/pricing')).toBe(false)
  })

  it('opens docs links in a new tab and says so to screen readers', () => {
    const link = readFileSync(join(SRC, 'components/marketing/site-link.tsx'), 'utf8')
    expect(link).toMatch(/target="_blank"/u)
    expect(link).toMatch(/rel="noopener noreferrer"/u)
    expect(link).toMatch(/\(opens in a new tab\)/u)
  })

  it('renders every computed href through SiteLink', () => {
    const offenders: string[] = []
    for (const file of sources(SRC)) {
      const rel = relative(SRC, file)
      if (rel.endsWith('site-link.tsx')) continue
      const source = readFileSync(file, 'utf8')
      for (const [, tag, raw = ''] of source.matchAll(/<(Link|a)\b[^>]*?\bhref=\{([^}]+)\}/gsu)) {
        const href = raw.trim()
        if (!SAFE_HREF.test(href)) offenders.push(`${rel}: <${tag} href={${href}}>`)
      }
    }
    expect(offenders).toEqual([])
  })
})
