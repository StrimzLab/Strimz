import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO, readWeb, webTree } from './web-source'

const WEB_ROOT = webTree()

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) ? [path] : []
  })
}

const PROSE = /['"`\s]prose(?=[\s'"`])/u
const users = files(join(WEB_ROOT, 'src'))
  .filter((file) => !file.includes('__tests__'))
  .filter((file) => PROSE.test(readFileSync(file, 'utf8')))

// `prose` classes do nothing unless the typography plugin is installed and registered.
describe('prose styling', () => {
  it('is used somewhere, so these checks guard something real', () => {
    expect(users.length).toBeGreaterThan(0)
  })

  it('has the typography plugin installed and registered', () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO, 'packages/web-shared/package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['@tailwindcss/typography']).toBeDefined()
    const css = readWeb('src/styles/globals.css')
    expect(css).toMatch(/@plugin\s+['"]@tailwindcss\/typography['"]/u)
    expect(css).toMatch(/@utility\s+prose-strimz\s*\{/u)
  })

  it.each(users.map((file) => relative(WEB_ROOT, file)))(
    '%s uses the Strimz prose theme',
    (file) => {
      const source = readWeb(file)
      expect(source).toContain('prose-strimz')
      expect(source).not.toMatch(/prose-(neutral|gray|slate|zinc|stone)\b/u)
    },
  )
})
