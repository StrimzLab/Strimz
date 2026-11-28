import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { checkContent, checkFileName, parseAllowlist, scanTree } from '../src/guard.ts'

const PUBLIC = '0x3600000000000000000000000000000000000000'
const PRIVATE = '0x1111111111111111111111111111111111111111'
const allow = parseAllowlist(`# public only\n${PUBLIC.toUpperCase()}  # USDC\n\n`)
const rules = (file: string, text: string) => checkContent(file, text, allow).map((f) => f.rule)

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'mirror-guard-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

describe('file names', () => {
  it.each([
    '.env',
    'apps/web/.env.local',
    'packages/contracts/.env.production',
    'keys/deployer.pem',
    'id_ed25519',
    'deployments/5042.json',
    'packages/contracts/broadcast/DeployCore.s.sol/5042/run-latest.json',
    'out/Payments.sol/Payments.json',
    'apps/web/.next/server/app.js',
    'node_modules/x/index.js',
  ])('refuses %s', (file) => {
    expect(checkFileName(file)).not.toBeNull()
  })

  it.each([
    '.env.example',
    'apps/web/.env.example',
    'deployments/5042002.json',
    'src/Outbox.ts',
    'README.md',
  ])('allows %s', (file) => {
    expect(checkFileName(file)).toBeNull()
  })
})

describe('content', () => {
  it('refuses full-length API keys and webhook secrets, not short placeholders', () => {
    expect(rules('a.ts', `const k = 'sk_live_${'a1B2'.repeat(10)}'`)).toEqual(['api-key'])
    expect(rules('a.ts', `const k = 'pk_test_${'Zx9_'.repeat(10)}'`)).toEqual(['api-key'])
    expect(rules('a.ts', `const s = 'whsec_${'q'.repeat(32)}'`)).toEqual(['webhook-secret'])
    expect(rules('a.md', 'STRIMZ_SECRET_KEY=sk_test_xxx')).toEqual([])
  })

  it('refuses private keys', () => {
    expect(rules('k.txt', '-----BEGIN OPENSSH PRIVATE KEY-----')).toEqual(['private-key'])
    expect(rules('.env.example', `PRIVATE_KEY=0x${'ab'.repeat(32)}`)).toEqual(['private-key'])
    expect(rules('a.ts', `const deployerKey = "${'cd'.repeat(32)}"`)).toEqual(['private-key'])
  })

  it('allows a 32-byte value with no key nearby, such as a transaction hash', () => {
    expect(rules('a.ts', `const txHash = '0x${'ef'.repeat(32)}'`)).toEqual([])
  })

  it('allows a listed 32-byte value', () => {
    const value = `0x${'ab'.repeat(32)}`
    const withKey = parseAllowlist(`${value} # a well-known public test key`)
    expect(checkContent('a.ts', `PRIVATE_KEY=${value}`, withKey)).toEqual([])
  })

  it('refuses an address that is not on the allowlist, in any case', () => {
    expect(rules('a.json', `{"treasury":"${PRIVATE}"}`)).toEqual(['address'])
    expect(rules('a.json', `{"usdc":"${PUBLIC}"}`)).toEqual([])
    expect(rules('a.json', `{"usdc":"${PUBLIC.replace('36', '3A')}"}`)).toEqual(['address'])
  })

  it('does not read part of a longer hex value as an address', () => {
    expect(rules('a.ts', `hash: 0x${'9'.repeat(64)}`)).toEqual([])
  })

  it('skips binary files', () => {
    expect(rules('logo.png', `\0PNG ${PRIVATE}`)).toEqual([])
  })
})

describe('scanTree', () => {
  it('passes a clean tree', () => {
    const root = tree({ 'README.md': `USDC is ${PUBLIC}.`, 'src/index.ts': 'export const x = 1\n' })
    expect(scanTree(root, allow)).toEqual([])
  })

  it('reports every problem with its file', () => {
    const root = tree({
      '.env': 'X=1',
      'src/config.ts': `export const treasury = '${PRIVATE}'`,
    })
    expect(
      scanTree(root, allow)
        .map((f) => `${f.file}:${f.rule}`)
        .sort(),
    ).toEqual(['.env:file-name', 'src/config.ts:address'])
  })

  it('never prints the matched value, only where it is', () => {
    const root = tree({ 'a.ts': `const k = 'sk_live_${'a1B2'.repeat(10)}'` })
    const [finding] = scanTree(root, allow)
    expect(JSON.stringify(finding)).not.toContain('a1B2a1B2')
    expect(finding?.line).toBe(1)
  })
})
