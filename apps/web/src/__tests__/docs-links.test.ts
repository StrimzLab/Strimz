import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DOCS = join(WEB_ROOT, 'content/docs')

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path, pattern)
    return pattern.test(name) ? [path] : []
  })
}

const SOURCES = [
  ...files(DOCS, /\.mdx$/u),
  ...files(join(WEB_ROOT, 'src/app/(marketing)'), /\.tsx?$/u),
  ...files(join(WEB_ROOT, 'src/components/marketing'), /\.tsx?$/u),
]

function pageExists(slug: string): boolean {
  if (slug === '') return true
  return existsSync(join(DOCS, `${slug}.mdx`)) || existsSync(join(DOCS, slug, 'index.mdx'))
}

function brokenLinks(): string[] {
  return SOURCES.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/\/docs(?:\/([\w\-/]+))?(?=[)#"'`\s]|$)/gu)]
      .map((m) => (m[1] ?? '').replace(/\/$/u, ''))
      .filter((slug) => !pageExists(slug))
      .map((slug) => `${relative(WEB_ROOT, file)} → /docs/${slug}`)
  })
}

describe('docs links', () => {
  it('every /docs link points at a page that exists', () => {
    expect(brokenLinks()).toEqual([])
  })
})
