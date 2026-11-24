#!/usr/bin/env bash
# Nightly encrypted dump of the strimz database to Cloudinary (ADR-2026-11-23-nightly-backups).
# Installed to /usr/local/sbin/strimz-backup; config comes from /etc/strimz-backup.env.
set -euo pipefail
umask 077

: "${AGE_RECIPIENT:?AGE_RECIPIENT is not set}"
: "${CLOUDINARY_CLOUD_NAME:?CLOUDINARY_CLOUD_NAME is not set}"
: "${CLOUDINARY_UPLOAD_PRESET:?CLOUDINARY_UPLOAD_PRESET is not set}"
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
key="strimz-backups/mainnet/strimz-$(date -u +%Y%m%dT%H%M%SZ).dump.age"

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
# An unsigned preset can't overwrite or delete, so this server can't touch past backups.
if ! response="$(curl -sS --fail-with-body -m 300 --retry 3 \
  "https://api.cloudinary.com/v1_1/$CLOUDINARY_CLOUD_NAME/raw/upload" \
  -F "file=@$tmp" \
  --form-string "upload_preset=$CLOUDINARY_UPLOAD_PRESET" \
  --form-string "public_id=$key")"; then
  fail "upload failed: $response"
fi
remote="$(printf '%s' "$response" | grep -oE '"bytes": *[0-9]+' | grep -oE '[0-9]+$')" \
  || fail "no size in Cloudinary's response: $response"
[ "$remote" = "$size" ] || fail "uploaded $remote bytes, expected $size"
printf '%s' "$response" | grep -qE '"type": *"authenticated"' \
  || fail "uploaded without authenticated delivery; set the preset's delivery type to Authenticated"

ping_hc ""
log "uploaded $key ($size bytes)"
