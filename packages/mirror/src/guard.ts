import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export type Finding = { file: string; line?: number; rule: string; detail: string }

const BLOCKED_NAMES: readonly [RegExp, string][] = [
  [/(^|\/)\.env(\.(?!example$)[^/]+)?$/u, 'environment file'],
  [/\.(pem|key|p12|pfx|keystore)$/iu, 'key file'],
  [/(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/u, 'SSH key'],
  [/(^|\/)deployments\/5042\.json$/u, 'mainnet deployment'],
  [
    /(^|\/)(broadcast|out|cache|node_modules|\.next|\.open-next|\.turbo|\.wrangler)\//u,
    'build or run output',
  ],
]

/** Why a path may not be published, or null when it may. */
export function checkFileName(file: string): string | null {
  const path = file.split(sep).join('/')
  for (const [re, why] of BLOCKED_NAMES) if (re.test(path)) return why
  return null
}

/** Lower-cased hex values from an allowlist file; `#` starts a comment. */
export function parseAllowlist(text: string): Set<string> {
  const out = new Set<string>()
  for (const line of text.split('\n')) {
    const value = line.split('#')[0]?.trim().toLowerCase()
    if (value) out.add(value)
  }
  return out
}

const API_KEY = /\b(sk|pk)_(live|test)_[A-Za-z0-9_-]{20,}/gu
const WEBHOOK_SECRET = /\bwhsec_[A-Za-z0-9+/=_-]{16,}/gu
const PEM_PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu
// A 32-byte value next to the word "key" is treated as a private key; on its own it's usually a hash.
const KEYED_32_BYTES = /key[^\n]{0,40}?(?<![0-9a-fA-F])((?:0x)?[0-9a-fA-F]{64})(?![0-9a-fA-F])/giu
const ADDRESS = /(?<![0-9a-zA-Z])0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/gu

function lineOf(text: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

/** Problems in one file's text. Findings never include the matched value. */
export function checkContent(file: string, text: string, allowlist: Set<string>): Finding[] {
  if (text.includes('\0')) return []
  const found: Finding[] = []
  const add = (rule: string, detail: string, index: number) =>
    found.push({ file, line: lineOf(text, index), rule, detail })

  for (const m of text.matchAll(API_KEY)) add('api-key', 'a full-length Strimz API key', m.index)
  for (const m of text.matchAll(WEBHOOK_SECRET))
    add('webhook-secret', 'a webhook signing secret', m.index)
  for (const m of text.matchAll(PEM_PRIVATE_KEY)) add('private-key', 'a PEM private key', m.index)
  for (const m of text.matchAll(KEYED_32_BYTES)) {
    const value = m[1] ?? ''
    const normalised = (value.startsWith('0x') ? value : `0x${value}`).toLowerCase()
    if (!allowlist.has(normalised)) add('private-key', 'a 32-byte value next to "key"', m.index)
  }
  for (const m of text.matchAll(ADDRESS)) {
    if (!allowlist.has(m[0].toLowerCase()))
      add('address', 'an address not in the allowlist', m.index)
  }
  return found
}

/** Every problem in a folder about to be published. */
export function scanTree(root: string, allowlist: Set<string>): Finding[] {
  const found: Finding[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const file = relative(root, path).split(sep).join('/')
      if (statSync(path).isDirectory()) {
        if (name !== '.git') walk(path)
        continue
      }
      const why = checkFileName(file)
      if (why) found.push({ file, rule: 'file-name', detail: why })
      found.push(...checkContent(file, readFileSync(path, 'utf8'), allowlist))
    }
  }
  walk(root)
  return found
}
