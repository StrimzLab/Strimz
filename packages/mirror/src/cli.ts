import { readFileSync } from 'node:fs'

import { parseAllowlist, scanTree } from './guard.ts'

const [root, allowlistPath] = process.argv.slice(2)
if (!root || !allowlistPath) {
  console.error(
    'usage: node --experimental-strip-types packages/mirror/src/cli.ts <folder> <address-allowlist>',
  )
  process.exit(2)
}

const findings = scanTree(root, parseAllowlist(readFileSync(allowlistPath, 'utf8')))
for (const f of findings)
  console.error(`  ${f.file}${f.line ? `:${f.line}` : ''}  ${f.rule}: ${f.detail}`)
if (findings.length > 0) {
  console.error(`mirror guard: ${findings.length} problem(s); nothing was published.`)
  process.exit(1)
}
