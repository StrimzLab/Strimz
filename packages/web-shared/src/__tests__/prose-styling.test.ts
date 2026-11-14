import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url))

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
    const pkg = JSON.parse(readFileSync(join(WEB_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['@tailwindcss/typography']).toBeDefined()
    const css = readFileSync(join(WEB_ROOT, 'src/styles/globals.css'), 'utf8')
    expect(css).toMatch(/@plugin\s+['"]@tailwindcss\/typography['"]/u)
    expect(css).toMatch(/@utility\s+prose-strimz\s*\{/u)
  })

  it.each(users.map((file) => relative(WEB_ROOT, file)))(
    '%s uses the Strimz prose theme',
    (file) => {
      const source = readFileSync(join(WEB_ROOT, file), 'utf8')
      expect(source).toContain('prose-strimz')
      expect(source).not.toMatch(/prose-(neutral|gray|slate|zinc|stone)\b/u)
    },
  )
})
