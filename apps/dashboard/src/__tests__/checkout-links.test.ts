import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === '__tests__') return []
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) ? [path] : []
  })
}

// /pay, /sub and /store pages live on the checkout app, not the dashboard (#485).
describe('checkout links point at the checkout app', () => {
  it('never builds a checkout route from the dashboard origin', () => {
    const offenders = files(SRC).filter((f) =>
      /(origin|location\.origin)\}?\/(pay|sub|store)\//u.test(readFileSync(f, 'utf8')),
    )
    expect(offenders.map((f) => relative(SRC, f))).toEqual([])
  })

  it.each([
    ['app/(dashboard)/app/plans/[id]/page.tsx', '/sub/'],
    ['app/(dashboard)/app/invoices/[id]/page.tsx', '/pay/'],
  ])('%s uses the checkout of the selected mode', (path, route) => {
    expect(readFileSync(join(SRC, path), 'utf8')).toContain('`${network.checkoutUrl}' + route)
  })
})
