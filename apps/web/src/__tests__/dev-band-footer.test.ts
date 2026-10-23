import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CODE_TABS, DEV_LINKS } from '@/components/marketing/home/developers-data'
import { FOOTER_COLUMNS } from '@/components/marketing/footer-data'
import { NAV_GROUPS } from '@/components/marketing/nav-data'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const DOCS = join(WEB_ROOT, 'content/docs')

function docExists(href: string) {
  const rest = href.replace(/^\/docs\/?/u, '').split('#')[0] ?? ''
  if (!rest) return existsSync(join(DOCS, 'index.mdx'))
  return existsSync(join(DOCS, `${rest}.mdx`)) || existsSync(join(DOCS, rest, 'index.mdx'))
}

function resolves(href: string) {
  if (href.startsWith('http')) return true
  if (href.startsWith('/docs')) return docExists(href)
  const path = href.split('#')[0] || '/'
  const route = path === '/' ? 'page.tsx' : `${path.slice(1)}/page.tsx`
  return [`src/app/(marketing)/${route}`, `src/app/(auth)/${route}`].some((p) =>
    existsSync(join(WEB_ROOT, p)),
  )
}

describe('compact developer band (#279)', () => {
  const source = read('src/components/marketing/home/developers.tsx')

  it('drops install commands and the keyboard', () => {
    expect(source).not.toMatch(/pnpm add|curl /u)
    expect(source).not.toMatch(/TypingKeyboard/u)
    expect(existsSync(join(WEB_ROOT, 'src/components/marketing/fx/typing-keyboard.tsx'))).toBe(
      false,
    )
    expect(read('src/styles/globals.css')).not.toMatch(/--tk-|\.tk-/u)
  })

  it('keeps each code tab short', () => {
    expect(CODE_TABS.length).toBeGreaterThan(0)
    for (const tab of CODE_TABS)
      expect(tab.code.split('\n').length, tab.file).toBeLessThanOrEqual(8)
  })

  it('links the three ways in to docs pages that exist', () => {
    expect(DEV_LINKS).toHaveLength(3)
    for (const l of DEV_LINKS) expect(docExists(l.href), l.href).toBe(true)
  })
})

describe('closing CTA speaks to the business buyer (#279)', () => {
  it('has no developer-only words', () => {
    const text = read('src/components/marketing/home/closing.tsx').replace(
      /^\s*(\/\/|\*|\/\*).*$/gmu,
      '',
    )
    expect(text).not.toMatch(/webhook|\bAPI\b|\bSDK\b|\bcode\b/iu)
  })
})

describe('footer columns (#279)', () => {
  it('has Product, Solutions, Developers, Company and Legal', () => {
    expect(FOOTER_COLUMNS.map((c) => c.label)).toEqual([
      'Product',
      'Solutions',
      'Developers',
      'Company',
      'Legal',
    ])
  })

  it('carries every nav item under the same heading', () => {
    for (const group of NAV_GROUPS) {
      const column = FOOTER_COLUMNS.find((c) => c.label === group.label)
      expect(column, group.label).toBeDefined()
      for (const item of group.items)
        expect(
          column?.links.map((l) => l.href),
          item.label,
        ).toContain(item.href)
    }
  })

  it('links only to pages that exist', () => {
    for (const link of FOOTER_COLUMNS.flatMap((c) => c.links))
      expect(resolves(link.href), link.href).toBe(true)
  })
})
