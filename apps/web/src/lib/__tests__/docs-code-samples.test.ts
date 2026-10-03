import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as sdk from '@strimz/sdk'
import * as sdkBrowser from '@strimz/sdk/browser'
import * as sdkWebhooks from '@strimz/sdk/webhooks'
import * as sdkReact from '@strimz/sdk-react'

const DOCS_DIR = fileURLToPath(new URL('../../../content/docs', import.meta.url))

const MODULES: Record<string, Record<string, unknown>> = {
  '@strimz/sdk': sdk,
  '@strimz/sdk/browser': sdkBrowser,
  '@strimz/sdk/webhooks': sdkWebhooks,
  '@strimz/sdk-react': sdkReact,
}

function listMdx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return listMdx(path)
    return path.endsWith('.mdx') ? [path] : []
  })
}

interface DocFile {
  name: string
  text: string
  lines: string[]
}

const docs: DocFile[] = listMdx(DOCS_DIR).map((path) => {
  const text = readFileSync(path, 'utf8')
  return { name: relative(DOCS_DIR, path), text, lines: text.split('\n') }
})

function codeLineViolations(test: (line: string) => boolean): string[] {
  const violations: string[] = []
  for (const doc of docs) {
    let inFence = false
    doc.lines.forEach((line, i) => {
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence
        return
      }
      if (inFence && test(line)) violations.push(`${doc.name}:${i + 1}: ${line.trim()}`)
    })
  }
  return violations
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

describe('docs code samples', () => {
  it('finds the docs', () => {
    expect(docs.length).toBeGreaterThan(0)
  })

  it('awaits verifyWebhookSignature, which returns a Promise', () => {
    const violations = codeLineViolations(
      (line) =>
        line.includes('verifyWebhookSignature(') && !/await\s+verifyWebhookSignature\(/.test(line),
    )
    expect(violations).toEqual([])
  })

  it('constructs StrimzClient, not a nonexistent Strimz class', () => {
    expect(codeLineViolations((line) => /\bnew Strimz\(/.test(line))).toEqual([])
  })

  it('keeps every code fence inside a <Tab> on a line of its own', () => {
    const violations: string[] = []
    for (const doc of docs) {
      let inTab = false
      doc.lines.forEach((line, i) => {
        const opensTab = /<Tab\b/.test(line)
        if ((inTab || opensTab) && line.includes('```') && !/^\s*```[^`]*$/.test(line)) {
          violations.push(`${doc.name}:${i + 1}: ${line.trim()}`)
        }
        if (opensTab) inTab = true
        if (line.includes('</Tab>')) inTab = false
      })
    }
    expect(violations).toEqual([])
  })

  it('imports only names the Strimz SDK packages export', () => {
    const violations: string[] = []
    const importPattern =
      /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"](@strimz\/sdk(?:-react)?(?:\/[a-z-]+)?)['"]/g
    for (const doc of docs) {
      for (const match of doc.text.matchAll(importPattern)) {
        if (match[1]) continue
        const specifier = match[3] ?? ''
        const where = `${doc.name}:${lineOf(doc.text, match.index ?? 0)}`
        const mod = MODULES[specifier]
        if (!mod) {
          violations.push(`${where}: unknown module ${specifier}`)
          continue
        }
        const names = (match[2] ?? '')
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part !== '' && !part.startsWith('type '))
          .map((part) => part.split(/\s+as\s+/)[0] ?? part)
        for (const name of names) {
          if (!(name in mod)) violations.push(`${where}: ${specifier} has no export ${name}`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
