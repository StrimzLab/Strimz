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
  curl: `#!/usr/bin/env bash
case "$*" in
  */raw/upload*)
    file=""; id=""; preset=""
    while [ $# -gt 0 ]; do
      case "$1" in
        -F) file="\${2#file=@}"; shift ;;
        --form-string)
          case "$2" in
            public_id=*) id="\${2#public_id=}" ;;
            upload_preset=*) preset="\${2#upload_preset=}" ;;
          esac
          shift ;;
      esac
      shift
    done
    echo "upload $preset $id" >>"$STUB_LOG"
    [ -n "\${STUB_UPLOAD_FAIL:-}" ] && { echo '{"error":{"message":"Upload preset not found"}}'; exit 22; }
    bytes="$(wc -c <"$file" | tr -d ' ')"
    [ -n "\${STUB_SIZE_MISMATCH:-}" ] && bytes=1
    type=authenticated
    [ -n "\${STUB_PUBLIC_TYPE:-}" ] && type=upload
    echo "{\\"public_id\\":\\"$id\\",\\"bytes\\":$bytes,\\"type\\":\\"$type\\"}"
    ;;
  *)
    for last; do :; done
    echo "ping $last" >>"$STUB_LOG"
    ;;
esac
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
      CLOUDINARY_CLOUD_NAME: 'strimz',
      CLOUDINARY_UPLOAD_PRESET: 'nightly',
      HC_PING_URL: 'https://hc-ping.com/check',
      ...env,
    },
  })
  const lines = readFileSync(log, 'utf8').trim().split('\n')
  return {
    status: res.status,
    stderr: res.stderr,
    uploads: lines.filter((l) => l.startsWith('upload ')),
    pings: lines.filter((l) => l.startsWith('ping ')).map((l) => l.slice(5)),
    leftovers: readdirSync(work),
  }
}

describe('nightly backup script', () => {
  it('uploads one encrypted dump with the unsigned preset and pings success', () => {
    const r = run()
    expect(r.status).toBe(0)
    expect(r.uploads).toHaveLength(1)
    expect(r.uploads[0]).toMatch(
      /^upload nightly strimz-backups\/mainnet\/strimz-\d{8}T\d{6}Z\.dump\.age$/u,
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
    expect(r.stderr).toMatch(/Upload preset not found/u)
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
    expect(r.leftovers).toEqual([])
  })

  it('reports an upload whose size does not match', () => {
    const r = run({ STUB_SIZE_MISMATCH: '1' })
    expect(r.status).not.toBe(0)
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
  })

  it('reports a backup the preset made public', () => {
    const r = run({ STUB_PUBLIC_TYPE: '1' })
    expect(r.status).not.toBe(0)
    expect(r.pings.at(-1)).toBe('https://hc-ping.com/check/fail')
  })

  it('refuses to run without its config', () => {
    const r = run({ AGE_RECIPIENT: '' })
    expect(r.status).not.toBe(0)
    expect(r.uploads).toEqual([])
  })
})
