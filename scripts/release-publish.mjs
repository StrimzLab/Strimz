// Wrapper around `changeset publish` for the Release workflow.
//
// Why this exists: in CI we publish via npm OIDC trusted publishing (no
// NPM_TOKEN). In that setup `changeset publish`'s "is this version already on
// npm?" pre-check returns false negatives, so it tries to re-publish packages
// that did NOT change (e.g. shared-config@0.1.1). npm then correctly refuses
// with "You cannot publish over the previously published versions", and the
// whole command exits non-zero — even though every package that actually had
// a new version published fine.
//
// This wrapper runs the publish, then inspects the per-package failures:
//   - only "already published" failures  -> benign, exit 0
//   - any other failure                  -> real problem, exit 1
//
// Genuine publish failures still fail the job; a no-op release does not.

import { spawnSync } from 'node:child_process'

const res = spawnSync('pnpm', ['exec', 'changeset', 'publish'], {
  encoding: 'utf8',
  env: process.env,
})

const output = `${res.stdout ?? ''}${res.stderr ?? ''}`
process.stdout.write(output)

if (res.status === 0) {
  process.exit(0)
}

// changeset prints one line per failed package:
//   "an error occurred while publishing <pkg>: <message>"
const failures = [...output.matchAll(/an error occurred while publishing (\S+): (.*)/g)]
const isAlreadyPublished = (msg) => /previously published versions|already published/i.test(msg)
const realFailures = failures.filter(([, , msg]) => !isAlreadyPublished(msg))

if (failures.length === 0 || realFailures.length > 0) {
  // Either an unparseable failure, or a genuine publish error — fail loudly.
  console.error(
    `\nRelease failed: ${realFailures.length || 'unrecognised'} package(s) failed to publish for a real reason.`,
  )
  process.exit(1)
}

console.error(
  `\nAll ${failures.length} publish error(s) were "already published" (unchanged packages). ` +
    `New versions published fine — treating release as successful.`,
)
process.exit(0)
