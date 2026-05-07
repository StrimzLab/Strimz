#!/usr/bin/env node
/**
 * Post-`prisma generate` step.
 *
 * Prisma 7's generator emits every `.ts` file under `generated/` with
 *   // @ts-nocheck
 * at the top. That's a defensive choice from Prisma (it immunises
 * against TS-version / strict-flag drift between their generator and
 * any given consumer's tsconfig), but the side effect is that *every*
 * downstream file that touches a model accessor — `prisma.user`,
 * `prisma.refund.findMany(...)`, etc. — sees `any` instead of the
 * generated typed shape. That nukes type safety across api / scheduler
 * / agent / web for no good reason; the generator's output compiles
 * cleanly under our tsconfig.
 *
 * This script removes the directive so consumers get real types.
 *
 * Idempotent: safe to re-run on already-stripped files.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GENERATED_ROOT = join(__dirname, '..', 'generated')

// Matches the directive line and its trailing newline. The Prisma
// emitter writes it as `// @ts-nocheck ` (note the trailing space)
// followed by a newline; allow either with-or-without trailing
// whitespace and either LF or CRLF.
const DIRECTIVE_LINE = /^\/\/\s*@ts-nocheck.*\r?\n/m

let stripped = 0
let scanned = 0

/** @param {string} dir */
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (!full.endsWith('.ts')) continue
    scanned++
    const src = readFileSync(full, 'utf8')
    if (!DIRECTIVE_LINE.test(src)) continue
    writeFileSync(full, src.replace(DIRECTIVE_LINE, ''))
    stripped++
  }
}

try {
  walk(GENERATED_ROOT)
} catch (err) {
  if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
    // generated/ doesn't exist yet — `prisma generate` hasn't run.
    // Silent exit so this script is safe to invoke standalone.
    console.warn(`[strip-ts-nocheck] ${GENERATED_ROOT} not found — nothing to strip`)
    process.exit(0)
  }
  throw err
}

console.log(
  `[strip-ts-nocheck] scanned ${scanned} .ts file(s), stripped @ts-nocheck from ${stripped}`,
)
