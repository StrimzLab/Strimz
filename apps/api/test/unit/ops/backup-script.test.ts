import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = fileURLToPath(
  new URL('../../../../../infra/backup/strimz-backup.sh', import.meta.url),
)

const STUBS: Record<string, string> = {
  docker: `#!/usr/bin/env bash
echo "docker $*" >>"$STUB_LOG"
case "$*" in
  *pg_dump*)
    [ -n "\${STUB_DUMP_FAIL:-}" ] && { printf partial; exit 1; }
    [ -n "\${STUB_DUMP_EXIT_FAIL:-}" ] && { printf 'PGDMP-fake-archive'; exit 1; }
    printf 'PGDMP-fake-archive'
    ;;
  *pg_restore*)
    data="$(cat)"
    [ "$data" = 'PGDMP-fake-archive' ] || exit 1
    echo '1; 0 1 TABLE DATA public _prisma_migrations postgres'
    [ -n "\${STUB_NO_MERCHANT:-}" ] || echo '2; 0 2 TABLE DATA public Merchant postgres'
    ;;
  *) exit 2 ;;
esac
`,
  age: `#!/usr/bin/env bash
out=""
while [ $# -gt 0 ]; do [ "$1" = -o ] && out="$2"; shift; done
{ printf 'age-encrypted:'; cat; } >"$out"
`,
  rclone: `#!/usr/bin/env bash
echo "rclone $*" >>"$STUB_LOG"
case "$1" in
  copyto)
    [ -n "\${STUB_UPLOAD_FAIL:-}" ] && exit 1
    wc -c <"$2" | tr -d ' ' >"$STUB_DIR/uploaded-size"
    ;;
  size)
    bytes="$(cat "$STUB_DIR/uploaded-size")"
    [ -n "\${STUB_SIZE_MISMATCH:-}" ] && bytes=1
    echo "{\\"count\\":1,\\"bytes\\":$bytes}"
    ;;
esac
`,
  curl: `#!/usr/bin/env bash
for last; do :; done
echo "ping $last" >>"$STUB_LOG"
`,
}

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function run(env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'strimz-backup-test-'))
  dirs.push(dir)
  const bin = join(dir, 'bin')
  const work = join(dir, 'work')
  spawnSync('mkdir', ['-p', bin, work])
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(join(bin, name), body)
    chmodSync(join(bin, name), 0o755)
  }
  const log = join(dir, 'log')
  writeFileSync(log, '')
  const res = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      STUB_LOG: log,
      STUB_DIR: dir,
      BACKUP_TMP_DIR: work,
      AGE_RECIPIENT: 'age1test',
      R2_BUCKET: 'strimz-backups',
      HC_PING_URL: 'https://hc-ping.com/check',
      ...env,
    },
  })
  const lines = readFileSync(log, 'utf8').trim().split('\n')
  return {
    status: res.status,
    stderr: res.stderr,
    uploads: lines.filter((l) => l.startsWith('rclone copyto')),
    pings: lines.filter((l) => l.startsWith('ping ')).map((l) => l.slice(5)),
    leftovers: readdirSync(work),
  }
}

describe('nightly backup script', () => {
  it('uploads one encrypted dump under mainnet/ and pings success', () => {
    const r = run()
    expect(r.status).toBe(0)
    expect(r.uploads).toHaveLength(1)
    expect(r.uploads[0]).toMatch(
      /^rclone copyto \S+\/dump\.age r2:strimz-backups\/mainnet\/strimz-\d{8}T\d{6}Z\.dump\.age$/u,
    )
    expect(r.pings).toEqual(['https://hc-ping.com/check/start', 'https://hc-ping.com/check'])
    expect(r.leftovers).toEqual([])
  })

  it('uploads nothing when pg_dump fails', () => {
    const r = run({ STUB_DUMP_FAIL: '1' })
    expect(r.status).not.toBe(0)
    expect(r.uploads).toEqual([])
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
    expect(r.leftovers).toEqual([])
  })

  it('uploads nothing when pg_dump exits with an error after a full-looking dump', () => {
    const r = run({ STUB_DUMP_EXIT_FAIL: '1' })
    expect(r.status).not.toBe(0)
    expect(r.uploads).toEqual([])
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
  })

  it('uploads nothing when the dump has no Merchant data', () => {
    const r = run({ STUB_NO_MERCHANT: '1' })
    expect(r.status).not.toBe(0)
    expect(r.uploads).toEqual([])
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
    expect(r.leftovers).toEqual([])
  })

  it('reports a failed upload', () => {
    const r = run({ STUB_UPLOAD_FAIL: '1' })
    expect(r.status).not.toBe(0)
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
    expect(r.leftovers).toEqual([])
  })

  it('reports an upload whose size does not match', () => {
    const r = run({ STUB_SIZE_MISMATCH: '1' })
    expect(r.status).not.toBe(0)
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
  })

  it('refuses to run without its config', () => {
    const r = run({ AGE_RECIPIENT: '' })
    expect(r.status).not.toBe(0)
    expect(r.uploads).toEqual([])
  })
})
