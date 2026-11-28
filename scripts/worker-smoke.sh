#!/usr/bin/env bash
#
# Smoke test an app on the Workers runtime (workerd), not `next start`.
# A build can pass every Next check and still fail on Workers.
#
# Usage:   scripts/worker-smoke.sh <web|docs|dashboard|admin|checkout>
#          (run `pnpm --filter <app> build:cloudflare` first)
# Env:     SMOKE_PORT   port for wrangler dev (default 8799)
set -euo pipefail

app="${1:-}"
port="${SMOKE_PORT:-8799}"
root="$(cd "$(dirname "$0")/.." && pwd)"

# Routes that need the live API or a signed-in session are left out.
case "$app" in
  web)
    routes=(
      "/ 200" "/pricing 200" "/use-cases 200" "/about 200" "/contact 200"
      "/legal/terms 200" "/legal/privacy 200" "/customers 308" "/no-such-page 404"
      "/login 308" "/signup 308" "/app/settings 308" "/admin 308"
      "/pay/ps_123 308" "/sub/plan_123 308" "/store/acme 308" "/docs/webhooks 308"
    )
    ;;
  docs)
    routes=(
      "/ 308" "/docs 200" "/docs/webhooks 200" "/docs/no-such-page 404"
      "/api/search?query=webhook 200" "/no-such-page 404"
    )
    ;;
  dashboard)
    routes=("/ 307" "/login 200" "/signup 200" "/app 200" "/app/settings 200" "/no-such-page 404")
    ;;
  admin)
    routes=("/ 307" "/admin 200" "/admin/login 200" "/admin/merchants 200" "/no-such-page 404")
    ;;
  checkout)
    routes=("/ 307" "/no-such-page 404")
    ;;
  *)
    echo "usage: $0 <web|docs|dashboard|admin|checkout>" >&2
    exit 2
    ;;
esac
dir="$root/apps/$app"

if [ ! -f "$dir/.open-next/worker.js" ]; then
  echo "no build at $dir/.open-next; run build:cloudflare first" >&2
  exit 2
fi

log="$(mktemp)"
cd "$dir"
pnpm exec opennextjs-cloudflare populateCache local >/dev/null
WRANGLER_SEND_METRICS=false pnpm exec wrangler dev --port "$port" --ip 127.0.0.1 >"$log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; rm -f "$log"' EXIT

base="http://127.0.0.1:$port"
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "$base/"; then break; fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "wrangler dev exited early" >&2
    cat "$log" >&2
    exit 1
  fi
  sleep 1
done

failed=0
for entry in "${routes[@]}"; do
  path="${entry% *}"
  want="${entry##* }"
  got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$base$path" || echo 000)"
  if [ "$got" = "$want" ]; then
    echo "ok   $got $path"
  else
    echo "FAIL $got $path (want $want)"
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo "--- wrangler log ---" >&2
  cat "$log" >&2
  exit 1
fi
echo "smoke passed: $app"
