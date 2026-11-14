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

const PAYER_FILES = [
  ...files(join(WEB_ROOT, 'src/app/(checkout)')),
  ...files(join(WEB_ROOT, 'src/components/checkout')),
  ...files(join(WEB_ROOT, 'src/app/store')),
  join(WEB_ROOT, 'src/components/store/buy-button.tsx'),
  join(WEB_ROOT, 'src/lib/subscription-trial.ts'),
  join(WEB_ROOT, 'src/lib/checkout-copy.ts'),
  join(WEB_ROOT, 'src/lib/payer-errors.ts'),
]

// What a payer can read: source without comments or imports.
function visible(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '')
    .replace(/^import .*$/gmu, '')
}

const SOURCES = PAYER_FILES.map((path) => [relative(WEB_ROOT, path), visible(path)] as const)

function hits(pattern: RegExp) {
  return SOURCES.filter(([, source]) => pattern.test(source)).map(([path]) => path)
}

describe('checkout and storefront speak to payers, not engineers', () => {
  it.each([
    ['signature', /signature/iu],
    ['on-chain', /on-chain/iu],
    ['signed authorization', /signed authorization/iu],
    ['an EIP number', /EIP-\d/u],
    ['Reown AppKit', /Reown AppKit/u],
    ['gas-free', /gas-free/iu],
    ['the ~13s settle time', /~13s/u],
    ['Sign once', /Sign once/u],
    ['a bare Transaction label', />\s*Transaction\s*</u],
    ['Subscribe. with a full stop', /Subscribe\. /u],
  ])('never says %s', (_name, pattern) => {
    expect(hits(pattern)).toEqual([])
  })

  it('builds interval words from one helper', () => {
    expect(hits(/replace\('ly'/u)).toEqual([])
  })

  it('never prints a hash or price in monospace', () => {
    expect(hits(/font-mono/u)).toEqual([])
  })

  it('has no white overlays that glow in dark mode', () => {
    expect(hits(/bg-white\//u)).toEqual([])
  })

  it('gives every red or amber notice a dark-mode colour', () => {
    const bare = SOURCES.flatMap(([path, source]) =>
      source
        .split('\n')
        .filter((line) => /text-(red|amber)-[67]00/u.test(line) && !/dark:text-/u.test(line))
        .map(() => path),
    )
    expect(bare).toEqual([])
  })
})

describe('receipt panel', () => {
  const RECEIPT = visible(join(WEB_ROOT, 'src/components/checkout/receipt-panel.tsx'))
  const PAY = visible(join(WEB_ROOT, 'src/app/(checkout)/pay/[sessionId]/page.tsx'))
  const SUB = visible(join(WEB_ROOT, 'src/app/(checkout)/sub/[planId]/page.tsx'))

  it('links to the explorer from shared config', () => {
    expect(RECEIPT).toContain('arcExplorerTxUrl(')
    expect(RECEIPT).toContain('View receipt on Arc explorer')
  })

  it.each([
    ['pay', PAY],
    ['sub', SUB],
  ])('%s shows the receipt only once confirmed', (_name, source) => {
    expect(source).toMatch(/phase === 'confirmed' && \(\s*<ReceiptPanel/u)
    expect(source.match(/<ReceiptPanel/gu)).toHaveLength(1)
  })

  it.each([
    ['pay', PAY],
    ['sub', SUB],
  ])('%s routes every failure through the payer error mapper', (_name, source) => {
    expect(source).toContain('payerError(')
    expect(source).not.toMatch(/message=\{(loadError|pay\.error|subscribe\.error)/u)
  })
})
