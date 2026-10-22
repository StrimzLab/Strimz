import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url))

function mdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return mdxFiles(path)
    return name.endsWith('.mdx') ? [path] : []
  })
}

const DOCS = mdxFiles(join(WEB_ROOT, 'content/docs'))

const COMPARISONS = ['chargeback', 'three-day', 'stripe', 'decides a week later']

describe('the docs describe Strimz without comparing it to other processors', () => {
  it.each(COMPARISONS)('never says %s', (phrase) => {
    const hits = DOCS.filter((file) =>
      readFileSync(file, 'utf8').toLowerCase().includes(phrase),
    ).map((file) => relative(WEB_ROOT, file))
    expect(hits).toEqual([])
  })

  it('still explains idempotent charges and final settlement on the welcome page', () => {
    const welcome = readFileSync(join(WEB_ROOT, 'content/docs/index.mdx'), 'utf8')
    expect(welcome).toMatch(/cannot become a double charge/)
    expect(welcome).toMatch(/final/)
  })
})

// fumadocs-ui ships unlayered Tailwind v3 CSS whose `img` and `.hidden` rules beat
// our layered v4 `dark:` utilities, so the logo swap has to live in docs.css.
describe('the docs logo follows the theme', () => {
  const layout = readFileSync(join(WEB_ROOT, 'src/lib/layout.shared.tsx'), 'utf8')
  const css = readFileSync(join(WEB_ROOT, 'src/styles/docs.css'), 'utf8')

  it('does not rely on Tailwind display utilities for the swap', () => {
    expect(layout).not.toMatch(/dark:(hidden|block)/)
    expect(layout).not.toMatch(/['"\s]hidden\s/)
  })

  it('tags each logo and swaps them in docs.css', () => {
    expect(layout).toMatch(/src=\{blueLogo\}[\s\S]*?className="[^"]*docs-logo-light/)
    expect(layout).toMatch(/src=\{whiteLogo\}[\s\S]*?className="[^"]*docs-logo-dark/)
    expect(css).toMatch(/^\.docs-logo-dark\s*\{\s*display:\s*none;?\s*\}/m)
    expect(css).toMatch(/^\.dark \.docs-logo-light\s*\{\s*display:\s*none;?\s*\}/m)
    expect(css).toMatch(/^\.dark \.docs-logo-dark\s*\{\s*display:\s*block;?\s*\}/m)
  })
})

describe('inline code renders as a chip without backticks', () => {
  const globals = readFileSync(join(WEB_ROOT, 'src/styles/globals.css'), 'utf8')
  const docs = readFileSync(join(WEB_ROOT, 'src/styles/docs.css'), 'utf8')

  it.each(['before', 'after'])('drops the typography plugin backtick on ::%s', (pseudo) => {
    expect(globals).toMatch(
      new RegExp(`\\.prose :where\\(code\\)::${pseudo}[^{]*\\{[^}]*content:\\s*none`),
    )
  })

  it('styles the chip under the page id fumadocs renders', () => {
    const fumadocs = readFileSync(
      join(WEB_ROOT, 'node_modules/fumadocs-ui/dist/page.client.js'),
      'utf8',
    )
    expect(fumadocs).toContain('"nd-page"')
    expect(docs).not.toContain('[data-fd-content] code')
    expect(docs).toMatch(/^#nd-page \.prose code:not\(pre code\)\s*\{/m)
    expect(docs).toMatch(/^\.dark #nd-page \.prose code:not\(pre code\)\s*\{/m)
  })
})

describe('the docs sidebar', () => {
  const root = join(WEB_ROOT, 'content/docs')
  const meta = JSON.parse(readFileSync(join(root, 'meta.json'), 'utf8')) as { pages: string[] }

  function entryTitle(slug: string): string {
    const folder = join(root, slug, 'meta.json')
    const source = statSync(join(root, slug), { throwIfNoEntry: false })?.isDirectory()
      ? readFileSync(folder, 'utf8')
      : readFileSync(join(root, `${slug}.mdx`), 'utf8')
    const match = /"title":\s*"([^"]+)"|^title:\s*(.+)$/m.exec(source)
    return (match?.[1] ?? match?.[2] ?? slug).trim()
  }

  it('gives every top-level entry its own name', () => {
    const titles = meta.pages.filter((p) => !p.startsWith('---')).map(entryTitle)
    const repeated = titles.filter((t, i) => titles.indexOf(t) !== i)
    expect(repeated).toEqual([])
  })

  it('shows the endpoint list title once', () => {
    const page = readFileSync(join(root, 'api-reference.mdx'), 'utf8')
    expect(page).not.toMatch(/^# /m)
  })
})
