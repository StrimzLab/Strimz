import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'

// Source-reading tests written against the single `apps/web` tree. After
// ADR-2026-11-14-split-web-into-workers each path lives in one of these roots.
export const REPO = join(__dirname, '..', '..', '..', '..')
const MARKETING = join(REPO, 'apps/web')
export const WEB_ROOTS = [
  'apps/web',
  'apps/dashboard',
  'apps/admin',
  'apps/checkout',
  'apps/docs',
  'packages/web-shared',
].map((r) => join(REPO, r))

export function webPath(path: string): string {
  const hits = WEB_ROOTS.map((r) => join(r, path)).filter((p) => existsSync(p))
  if (hits.length > 1) throw new Error(`${path} exists in several apps: ${hits.join(', ')}`)
  return hits[0] ?? join(MARKETING, path)
}

export const readWeb = (path: string) => readFileSync(webPath(path), 'utf8')
export const webExists = (path: string) => WEB_ROOTS.some((r) => existsSync(join(r, path)))

/** Every file under `dir` (a pre-split path such as `src/components`) in all roots. */
export function walkWeb(dir: string): string[] {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((name) => {
      const p = join(d, name)
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
  return WEB_ROOTS.map((r) => join(r, dir))
    .filter((d) => existsSync(d))
    .flatMap(walk)
}

let tree: string | undefined

/**
 * A temporary tree of symlinks laid out like the pre-split `apps/web`, so tests
 * that check the whole web surface still see every app. Where two apps have
 * the same path (root layouts, the CSP route), the earlier root in
 * `WEB_ROOTS` wins.
 */
export function webTree(): string {
  if (tree) return tree
  const root = mkdtempSync(join(tmpdir(), 'strimz-web-'))
  const link = (target: string, at: string) => {
    if (existsSync(at)) return
    mkdirSync(dirname(at), { recursive: true })
    symlinkSync(target, at)
  }
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((name) => {
      const p = join(d, name)
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
  for (const r of WEB_ROOTS) {
    for (const top of ['src', 'content', 'public']) {
      const dir = join(r, top)
      if (existsSync(dir)) for (const f of walk(dir)) link(f, join(root, relative(r, f)))
    }
  }
  for (const f of ['next.config.mjs', '.env.example', 'package.json']) {
    link(join(MARKETING, f), join(root, f))
  }
  link(join(REPO, 'apps/docs/node_modules'), join(root, 'node_modules'))
  tree = root
  return root
}
