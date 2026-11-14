import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CODE_TABS, DEV_LINKS, KEYBOARD_SCRIPT } from '@/components/marketing/home/developers-data'
import { FOOTER_COLUMNS } from '@/components/marketing/footer-data'
import { NAV_GROUPS } from '@/components/marketing/nav-data'
import { appLink, dashboardRouteExists, docExists } from './app-links'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
function resolves(href: string) {
  const link = appLink(href)
  if (link.app === 'external') return true
  if (link.app === 'docs') return docExists(link.path)
  if (link.app === 'dashboard') return dashboardRouteExists(link.path)
  const path = link.path.split('#')[0] || '/'
  const route = path === '/' ? 'page.tsx' : `${path.slice(1)}/page.tsx`
  return existsSync(join(WEB_ROOT, `src/app/(marketing)/${route}`))
}

describe('compact developer band (#279)', () => {
  const source = read('src/components/marketing/home/developers.tsx')

  it('drops the install commands', () => {
    expect(source).not.toMatch(/pnpm add|curl /u)
  })

  it('types a terminal script on the keyboard above the code card (#467)', () => {
    expect(source).toMatch(/<TypingKeyboard script=\{KEYBOARD_SCRIPT\}/u)
    expect(source.indexOf('<TypingKeyboard')).toBeLessThan(source.indexOf('<Tabs'))
    expect(KEYBOARD_SCRIPT).toMatch(/payment\.completed/u)
  })

  it('keeps the keyboard styles out of the shared stylesheet', () => {
    expect(read('src/components/marketing/fx/typing-keyboard.tsx')).toMatch(
      /import '\.\/typing-keyboard\.css'/u,
    )
    expect(
      readFileSync(join(WEB_ROOT, '../../packages/web-shared/src/styles/globals.css'), 'utf8'),
    ).not.toMatch(/--tk-|\.tk-/u)
  })

  it('keeps each code tab short', () => {
    expect(CODE_TABS.length).toBeGreaterThan(0)
    for (const tab of CODE_TABS)
      expect(tab.code.split('\n').length, tab.file).toBeLessThanOrEqual(8)
  })

  it('links the three ways in to docs pages that exist', () => {
    expect(DEV_LINKS).toHaveLength(3)
    for (const l of DEV_LINKS) {
      const link = appLink(l.href)
      expect(link.app, l.href).toBe('docs')
      expect(docExists(link.path), l.href).toBe(true)
    }
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
