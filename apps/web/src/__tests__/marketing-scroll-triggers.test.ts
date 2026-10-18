import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const MARKETING = fileURLToPath(new URL('../components/marketing', import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) ? [path] : []
  })
}

describe('marketing scroll triggers', () => {
  // A `once` trigger created after its start has passed (a reload that restores the scroll
  // position) kills itself inside ScrollTrigger's refresh loop and breaks every later trigger.
  it('never use once: true', () => {
    const offenders = files(MARKETING)
      .filter((file) => /scrollTrigger[\s\S]{0,200}?once:\s*true/u.test(readFileSync(file, 'utf8')))
      .map((file) => relative(MARKETING, file))
    expect(offenders).toEqual([])
  })
})
