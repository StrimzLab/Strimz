#!/usr/bin/env bash
#
# Fail if a Worker is over the Workers Free limit (3 MiB gzipped).
# ADR-2026-11-14-split-web-into-workers.
#
# Usage:   scripts/worker-size.sh <web|docs|dashboard|admin|checkout>
#          (run `pnpm --filter <app> build:cloudflare` first)
set -euo pipefail

app="${1:-}"
root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/apps/$app"
limit_kib=3072

if [ -z "$app" ] || [ ! -f "$dir/.open-next/worker.js" ]; then
  echo "usage: $0 <app>; run build:cloudflare first" >&2
  exit 2
fi

out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
line="$(cd "$dir" && WRANGLER_SEND_METRICS=false pnpm exec wrangler deploy --dry-run --outdir "$out" 2>&1 | grep 'Total Upload')"
gzip_kib="$(echo "$line" | sed -E 's/.*gzip: ([0-9.]+) KiB.*/\1/')"
echo "$app: $line"
if awk -v s="$gzip_kib" -v l="$limit_kib" 'BEGIN { exit !(s > l) }'; then
  echo "FAIL: $app is ${gzip_kib} KiB gzipped, over the ${limit_kib} KiB Workers Free limit" >&2
  exit 1
fi
echo "ok: under ${limit_kib} KiB"
