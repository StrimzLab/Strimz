import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const REPO_ROOT = join(WEB_ROOT, '../..')
const UI_ROOT = join(REPO_ROOT, 'packages/ui')

const SCANNED_DIRS = [
  join(WEB_ROOT, 'src/app'),
  join(WEB_ROOT, 'src/components'),
  join(UI_ROOT, 'src/components'),
]

const COLOUR_UTILITY =
  /(?<![\w-])((?:[\w-]+(?:\[[^\]]*\])?:)*)!?(bg|text|border(?:-[trblxy])?|from|via|to|ring|ring-offset|fill|stroke|divide|outline|placeholder|decoration|caret)-(\[#[0-9a-fA-F]{3,8}\]|white|black|(?:gray|slate|zinc|neutral|stone)-\d{2,3})(\/[\d.]+|\/\[[^\]]+\])?(?![\w-])/g

interface LightOnlyColour {
  file: string
  line: number
  utility: string
}

function findLightOnlyColours(source: string, file: string): LightOnlyColour[] {
  const found: LightOnlyColour[] = []
  source.split('\n').forEach((text, index) => {
    for (const match of text.matchAll(COLOUR_UTILITY)) {
      const [utility, variants = '', property, value, opacity] = match
      if (variants.split(':').includes('dark')) continue
      if (property === 'text' && value === 'white') continue
      if ((value === 'white' || value === 'black') && opacity) continue
      found.push({ file, line: index + 1, utility })
    }
  })
  return found
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function cssBlock(css: string, selector: string): string | null {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) return null
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    if (depth === 0) return css.slice(start, i + 1)
  }
  return null
}

function customProperties(block: string): string[] {
  return [...block.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] ?? '').sort()
}

describe('findLightOnlyColours', () => {
  it('flags hex, white, black and grey colour utilities', () => {
    const hits = findLightOnlyColours(
      `<div className="bg-white text-[#050020] border-[#E5E7EB] hover:bg-gray-100 !bg-[#F9FAFB]" />`,
      'x.tsx',
    )
    expect(hits.map((h) => h.utility)).toEqual([
      'bg-white',
      'text-[#050020]',
      'border-[#E5E7EB]',
      'hover:bg-gray-100',
      '!bg-[#F9FAFB]',
    ])
  })

  it('ignores dark variants, token utilities, white text and translucent overlays', () => {
    const hits = findLightOnlyColours(
      `<div className="dark:bg-[#0B0B14] bg-background text-foreground text-white bg-black/50 border-white/10 bg-accent text-muted-foreground" />`,
      'x.tsx',
    )
    expect(hits).toEqual([])
  })

  it('keeps variants on the reported utility so the reviewer can find it', () => {
    const hits = findLightOnlyColours(
      `'data-[state=active]:bg-white group-hover:border-[#02C76A]/60'`,
      'x.tsx',
    )
    expect(hits.map((h) => h.utility)).toEqual([
      'data-[state=active]:bg-white',
      'group-hover:border-[#02C76A]/60',
    ])
  })
})

describe('dark palette', () => {
  const uiCss = read(join(UI_ROOT, 'src/styles/globals.css'))

  it('declares a class-based dark variant', () => {
    expect(uiCss).toMatch(/@custom-variant\s+dark\s+\(&:where\(\.dark, \.dark \*\)\);/)
  })

  it('defines every :root token again under .dark', () => {
    const root = cssBlock(uiCss, ':root')
    const dark = cssBlock(uiCss, '.dark')
    expect(root, ':root block').not.toBeNull()
    expect(dark, '.dark block').not.toBeNull()
    const rootTokens = customProperties(root ?? '').filter((t) => t !== '--radius')
    expect(customProperties(dark ?? '')).toEqual(rootTokens)
  })

  it('does not paint the web body with a fixed colour', () => {
    const body = cssBlock(read(join(WEB_ROOT, 'src/styles/globals.css')), '  body')
    expect(body).not.toBeNull()
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('surfaces use theme tokens', () => {
  it('has no light-only colour utilities in web routes, web components or ui primitives', () => {
    const hits = SCANNED_DIRS.flatMap((dir) =>
      sourceFiles(dir).flatMap((file) =>
        findLightOnlyColours(read(file), relative(REPO_ROOT, file)),
      ),
    )
    const report = hits.map((h) => `${h.file}:${h.line} ${h.utility}`)
    expect(report).toEqual([])
  })
})

describe('every surface renders the theme toggle', () => {
  const CHROME = {
    marketing: 'src/components/marketing/nav.tsx',
    auth: 'src/app/(auth)/layout.tsx',
    dashboard: 'src/components/dashboard/topbar.tsx',
    admin: 'src/components/admin/admin-shell.tsx',
    checkout: 'src/app/(checkout)/layout.tsx',
    store: 'src/app/store/[slug]/layout.tsx',
  } as const

  it.each(Object.entries(CHROME))('%s chrome renders <ThemeToggle', (_surface, path) => {
    const file = join(WEB_ROOT, path)
    expect(existsSync(file), `${path} exists`).toBe(true)
    expect(read(file)).toMatch(/<ThemeToggle\b/)
  })

  it('docs keep the fumadocs theme switch enabled', () => {
    const docs = read(join(WEB_ROOT, 'src/app/docs/layout.tsx'))
    expect(docs).not.toMatch(/theme=\{\{\s*enabled:\s*false\s*\}\}/)
  })

  it('the root layout mounts the theme provider with the shared storage key', () => {
    const layout = read(join(WEB_ROOT, 'src/app/layout.tsx'))
    expect(layout).toMatch(/<ThemeProvider\b/)
    expect(layout).toMatch(/storageKey=\{THEME_STORAGE_KEY\}/)
  })
})

describe('third-party widgets follow the active theme', () => {
  it.each([
    ['Privy', 'src/components/providers.tsx', /theme:\s*'light'/],
    ['Reown AppKit', 'src/components/checkout-providers.tsx', /themeMode:\s*'light'/],
    ['Turnstile', 'src/app/(auth)/signup/page.tsx', /theme:\s*'light'/],
    ['Turnstile (contact)', 'src/components/turnstile-widget.tsx', /theme:\s*'light'/],
  ])('%s is not pinned to light', (_widget, path, pinned) => {
    expect(read(join(WEB_ROOT, path))).not.toMatch(pinned)
  })

  it('the shared Toaster is not pinned to light', () => {
    expect(read(join(UI_ROOT, 'src/components/sonner.tsx'))).not.toMatch(/^\s+theme="light"$/m)
  })
})
