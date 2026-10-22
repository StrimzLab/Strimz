import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '../..')
const NEVER = '0 0 0 1 1 *'

const cronDecorators = readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts'))
  .flatMap((f) => {
    const source = readFileSync(join(root, 'src', f), 'utf8')
    return [...source.matchAll(/@Cron\(([^,)]+)/g)].map(([, arg = '']) => ({
      file: f,
      arg: arg.trim(),
    }))
  })

const setup = readFileSync(join(root, 'test/setup/global-setup.ts'), 'utf8')

// e2e tests drive crons by hand; one firing on its own schedule mid-test makes them flaky (#340).
describe('scheduler crons in e2e tests', () => {
  it('finds the crons', () => {
    expect(cronDecorators.length).toBeGreaterThan(5)
  })

  it.each(cronDecorators)('$file reads its schedule from an env var', ({ arg }) => {
    expect(arg).toMatch(/^process\.env\.[A-Z_]+ \|\|/)
  })

  it.each(cronDecorators)('$file is switched off by the e2e setup', ({ arg }) => {
    const name = /process\.env\.([A-Z_]+)/.exec(arg)?.[1]
    expect(setup).toContain(`process.env.${name} = '${NEVER}'`)
  })
})
