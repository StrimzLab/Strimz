import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : []
  })
}

// The maintainer doesn't want mocks labelled as samples or as live (#356).
const LABEL = /\bSample\b|[Ss]ample (data|figures)|code sample|\} sample`|>\s*Live\s*<|'Live'/u
const COMMENT = /^\s*(\/\/|\*|\/\*)/u

const SURFACES = [
  'src/components/marketing',
  'src/components/auth',
  'src/app/(marketing)',
  'src/app/(auth)',
]

describe('marketing and sign-in pages show no sample or live labels', () => {
  it('has none in user-facing text', () => {
    const hits = SURFACES.flatMap((dir) => files(join(WEB_ROOT, dir))).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${relative(WEB_ROOT, file)}:${i + 1}` }))
        .filter(({ line }) => !COMMENT.test(line) && LABEL.test(line))
        .map(({ at }) => at),
    )
    expect(hits).toEqual([])
  })
})
