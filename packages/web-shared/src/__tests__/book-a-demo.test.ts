import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bookDemoUrl } from '../lib/site-urls'

// #566: Book a demo opens Zoho Bookings in a new tab, from the home hero, the closing
// section and the docs. Not from the nav.
const REPO = join(__dirname, '..', '..', '..', '..')
const read = (path: string) => readFileSync(join(REPO, path), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.next' || name === '.open-next') return []
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('Book a demo', () => {
  it('points at the Zoho Bookings page', () => {
    expect(bookDemoUrl).toBe('https://strimz.zohobookings.com/5025813000000039046')
  })

  it('the booking URL is written down once', () => {
    const files = ['apps/web', 'apps/docs', 'packages/web-shared/src'].flatMap((d) =>
      walk(join(REPO, d)).filter((f) => /\.(tsx?|mdx?)$/.test(f) && !f.includes('__tests__')),
    )
    const holders = files
      .filter((f) => readFileSync(f, 'utf8').includes('zohobookings.com'))
      .map((f) => relative(REPO, f))
    expect(holders).toEqual(['packages/web-shared/src/lib/site-urls.ts'])
  })

  it.each([
    'apps/web/src/components/marketing/book-demo-link.tsx',
    'apps/docs/src/components/book-demo.tsx',
  ])('%s opens it in a new tab without an opener', (path) => {
    const src = read(path)
    expect(src).toContain('href={bookDemoUrl}')
    expect(src).toContain('target="_blank"')
    expect(src).toContain('rel="noopener noreferrer"')
    expect(src).toContain('(opens in a new tab)')
  })

  it.each([
    'apps/web/src/components/marketing/home/hero.tsx',
    'apps/web/src/components/marketing/home/closing.tsx',
  ])('%s shows it', (path) => {
    expect(read(path)).toContain('<BookDemoLink')
  })

  it.each(['apps/docs/content/docs/index.mdx', 'apps/docs/content/docs/getting-started.mdx'])(
    '%s shows it',
    (path) => {
      expect(read(path)).toContain('<BookDemo />')
    },
  )

  it('the docs register the component', () => {
    expect(read('apps/docs/src/components/mdx-components.tsx')).toContain('BookDemo')
  })

  // Founder, 2026-11-27: no section has more than two buttons.
  it.each([
    'apps/web/src/components/marketing/home/hero.tsx',
    'apps/web/src/components/marketing/home/closing.tsx',
  ])('%s has Start free and Book a demo, and nothing else', (path) => {
    const src = read(path)
    expect(src.match(/<(PopLink|BookDemoLink)\b/g)).toHaveLength(2)
    expect(src).toContain('Start free')
    expect(src).not.toContain('See how it works')
    expect(src).not.toContain('Talk to us')
  })

  it('is not in the nav', () => {
    expect(read('apps/web/src/components/marketing/nav.tsx')).not.toContain('BookDemo')
  })
})
