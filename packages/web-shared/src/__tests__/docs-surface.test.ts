import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss, { type AtRule, type Rule } from 'postcss'
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

function jsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsFiles(path)
    return name.endsWith('.js') ? [path] : []
  })
}

function cssRules(source: string): Rule[] {
  const rules: Rule[] = []
  postcss.parse(source).walkRules((rule) => {
    rules.push(rule)
  })
  return rules
}

const mediaOf = (rule: Rule) =>
  rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : undefined

// fumadocs' selectors that move an element with the v3 `transform`, mapped to their media query.
function fumadocsTransforms(): Map<string, string | undefined> {
  const css = readFileSync(join(WEB_ROOT, 'node_modules/fumadocs-ui/dist/style.css'), 'utf8')
  return new Map(
    cssRules(css)
      .filter((rule) =>
        rule.nodes.some(
          (node) =>
            node.type === 'decl' &&
            node.prop === 'transform' &&
            node.value.startsWith('translate(var(--tw-translate-x)'),
        ),
      )
      .flatMap((rule) => rule.selectors.map((selector) => [selector, mediaOf(rule)] as const))
      .filter(([selector]) => selector !== '.transform'),
  )
}

describe('docs.css styles what fumadocs renders', () => {
  const css = readFileSync(join(WEB_ROOT, 'src/styles/docs.css'), 'utf8')
  const layout = readFileSync(join(WEB_ROOT, 'src/app/docs/layout.tsx'), 'utf8')
  const fumadocs = ['fumadocs-ui', 'fumadocs-core']
    .flatMap((pkg) => jsFiles(join(WEB_ROOT, 'node_modules', pkg, 'dist')))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  const selectors = cssRules(css)
    .flatMap((rule) => rule.selectors)
    .filter((selector) => !fumadocsTransforms().has(selector))
  const OWN_CLASSES = ['dark', 'prose', 'docs-logo-light', 'docs-logo-dark']

  // Next puts a layout's CSS imports in its own order, so fumadocs' theme came after ours.
  it('loads the fumadocs stylesheet first, from docs.css', () => {
    expect(layout).not.toContain('fumadocs-ui/style.css')
    expect(css.replace(/^\/\*[\s\S]*?\*\/\s*/, '')).toMatch(/^@import 'fumadocs-ui\/style\.css';/)
  })

  it.each(selectors)('%s matches an id or attribute fumadocs renders', (selector) => {
    for (const [, id] of selector.matchAll(/#([\w-]+)/g)) {
      expect(fumadocs).toContain(`id: "${id}"`)
    }
    for (const [, attr] of selector.matchAll(/\[([\w-]+)/g)) {
      expect(fumadocs).toContain(`"${attr}"`)
    }
    for (const [, cls] of selector.matchAll(/\.([\w-]+)/g)) {
      expect(OWN_CLASSES).toContain(cls)
    }
  })

  it('draws a rule above each docs section and keeps the brand primary', () => {
    expect(css).toMatch(/^#nd-page \.prose h2\s*\{[^}]*border-top:/m)
    expect(css).toMatch(/^\.dark #nd-page \.prose h2\s*\{[^}]*border-top-color:/m)
    expect(css).toMatch(/^:root\s*\{[^}]*--fd-primary: 150 98% 40%;/m)
  })
})

// Our v4 utilities of the same name set `translate`, `rotate` and `scale` as well, which
// moved the search dialog off centre and turned the sidebar chevrons twice.
describe('fumadocs transforms are not applied twice', () => {
  const resets = cssRules(readFileSync(join(WEB_ROOT, 'src/styles/docs.css'), 'utf8')).filter(
    (rule) =>
      ['translate', 'rotate', 'scale'].every((prop) =>
        rule.nodes.some(
          (node) => node.type === 'decl' && node.prop === prop && node.value === 'none',
        ),
      ),
  )

  it('finds the transforms fumadocs ships', () => {
    expect([...fumadocsTransforms().keys()]).toContain('.-translate-x-1\\/2')
  })

  it.each([...fumadocsTransforms()])('%s keeps only the fumadocs transform', (selector, media) => {
    expect(
      resets.some((rule) => rule.selectors.includes(selector) && mediaOf(rule) === media),
    ).toBe(true)
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
})

// fumadocs renders the frontmatter title as the h1, so a `# ` heading in the body repeats it.
describe('docs pages show their title once', () => {
  const outsideCode = (source: string) => source.replace(/^```[\s\S]*?^```/gm, '')

  it.each(DOCS.map((file) => relative(WEB_ROOT, file)))('%s has no h1 of its own', (file) => {
    expect(outsideCode(readFileSync(join(WEB_ROOT, file), 'utf8'))).not.toMatch(/^# /m)
  })
})
