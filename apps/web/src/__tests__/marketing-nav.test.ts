import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { NAV_GROUPS, NAV_LINKS } from '@/components/marketing/nav-data'
import { USE_CASES } from '@/components/marketing/use-cases/data'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const HOME = 'src/components/marketing/home'

const homeSource = readdirSync(join(WEB_ROOT, HOME))
  .map((file) => read(`${HOME}/${file}`))
  .join('\n')

const allItems = [
  ...NAV_GROUPS.flatMap((g) => [...g.items, ...(g.feature ? [g.feature] : [])]),
  ...NAV_LINKS,
]

function resolves(href: string): boolean {
  const [path = '', hash] = href.split('#')
  if (path === '/' && hash) {
    const sheet = /^sheet-(.+)$/u.exec(hash)
    if (sheet) return read(`${HOME}/billing-tools.tsx`).includes(`key: '${sheet[1]}'`)
    return homeSource.includes(`id="${hash}"`)
  }
  if (path === '/use-cases' && hash) return USE_CASES.some((u) => u.id === hash)
  if (path.startsWith('/docs')) {
    const rest = path.replace(/^\/docs\/?/u, '')
    const base = join(WEB_ROOT, 'content/docs', rest)
    return rest === ''
      ? existsSync(join(base, 'index.mdx'))
      : existsSync(`${base}.mdx`) || existsSync(join(base, 'index.mdx'))
  }
  return existsSync(join(WEB_ROOT, 'src/app/(marketing)', path, 'page.tsx'))
}

describe('marketing nav', () => {
  it('has Product, Solutions, Developers and Company menus and a Pricing link', () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      'Product',
      'Solutions',
      'Developers',
      'Company',
    ])
    expect(NAV_LINKS.map((l) => l.label)).toEqual(['Pricing'])
  })

  it.each(allItems.map((i) => [i.label, i.href]))('%s links somewhere real (%s)', (_l, href) => {
    expect(resolves(href)).toBe(true)
  })

  it('lists every use case under Solutions', () => {
    const solutions = NAV_GROUPS.find((g) => g.label === 'Solutions')
    for (const useCase of USE_CASES) {
      expect(solutions?.items.some((i) => i.href === `/use-cases#${useCase.id}`)).toBe(true)
    }
  })

  it('gives every item a one-line description', () => {
    for (const item of allItems) expect(item.description?.length ?? 0).toBeGreaterThan(10)
  })

  it('names no hidden feature and no network', () => {
    const text = JSON.stringify(allItems.map((i) => [i.label, i.description, i.href]))
    expect(text).not.toMatch(/\bArc\b|escrow|cctp|cross-chain|other chains/iu)
  })

  it('builds the desktop menus on NavigationMenu and the phone menu on Accordion', () => {
    const nav = read('src/components/marketing/nav.tsx')
    expect(nav).toMatch(/<NavigationMenu\b/u)
    expect(nav).toMatch(/<NavigationMenuViewport\b/u)
    expect(nav).toMatch(/<Accordion\b/u)
  })

  it('offers Sign in and Start free, not Get started', () => {
    const nav = read('src/components/marketing/nav.tsx')
    expect(nav).toContain('Sign in')
    expect(nav).toContain('Start free')
    expect(nav).not.toContain('Get started')
  })

  it('marks the current page', () => {
    expect(read('src/components/marketing/nav.tsx')).toMatch(/aria-current/u)
  })

  it('lands menu jumps below the sticky nav', () => {
    expect(read(`${HOME}/billing-tools.tsx`)).toMatch(
      /id=\{`sheet-\$\{s\.key\}`\}\s+className="[^"]*\bscroll-mt-/u,
    )
  })
})
