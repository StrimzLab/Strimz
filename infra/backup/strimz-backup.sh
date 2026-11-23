#!/usr/bin/env bash
# Nightly encrypted dump of the strimz database to R2 (ADR-2026-11-23-nightly-backups).
# Installed to /usr/local/sbin/strimz-backup; config comes from /etc/strimz-backup.env.
set -euo pipefail
umask 077

: "${AGE_RECIPIENT:?AGE_RECIPIENT is not set}"
: "${R2_BUCKET:?R2_BUCKET is not set}"
: "${HC_PING_URL:?HC_PING_URL is not set}"
CONTAINER="${STRIMZ_CONTAINER:-strimz}"
TMP_DIR="${BACKUP_TMP_DIR:-/var/tmp}"

log() { echo "strimz-backup: $*" >&2; }

# A failed ping must not stop the backup; a missing ping alerts anyway.
ping_hc() {
  curl -fsS -m 10 --retry 3 -o /dev/null "$HC_PING_URL$1" || log "healthcheck ping '$1' failed"
}

work="$(mktemp -d "$TMP_DIR/strimz-backup.XXXXXX")"
trap 'rm -rf "$work"' EXIT
tmp="$work/dump.age"
toc="$work/toc"
mkfifo "$work/plain"

fail() {
  log "$*"
  ping_hc /fail
  exit 1
}

ping_hc /start
key="mainnet/strimz-$(date -u +%Y%m%dT%H%M%SZ).dump.age"

# pg_restore --list stops reading after the table list; cat drains the rest so tee doesn't hit SIGPIPE.
docker exec -i -u postgres "$CONTAINER" sh -c 'pg_restore --list && cat >/dev/null' \
  <"$work/plain" >"$toc" &
lister=$!

docker exec -u postgres "$CONTAINER" pg_dump --format=custom strimz \
  | tee "$work/plain" \
  | age -r "$AGE_RECIPIENT" -o "$tmp" \
  || fail "dump or encryption failed"

wait "$lister" || fail "could not read the dump's table list"
grep -q 'TABLE DATA public Merchant ' "$toc" || fail "dump has no Merchant data"
grep -q 'TABLE DATA public _prisma_migrations ' "$toc" || fail "dump has no migration history"

size="$(wc -c <"$tmp" | tr -d ' ')"
rclone copyto "$tmp" "r2:$R2_BUCKET/$key" || fail "upload failed"
remote="$(rclone size --json "r2:$R2_BUCKET/$key" | grep -o '"bytes":[0-9]*' | cut -d: -f2)" \
  || fail "could not check the upload"
[ "$remote" = "$size" ] || fail "uploaded $remote bytes, expected $size"

ping_hc ""
log "uploaded $key ($size bytes)"
