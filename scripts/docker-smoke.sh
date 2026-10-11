#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: [SMOKE_WORKDIR=/repo/apps/<app>] scripts/docker-smoke.sh <image> [expected-output]" >&2
  exit 2
fi

IMAGE="$1"
EXPECTED="${2:-Invalid environment configuration}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-60}"

CONTAINER="strimz-smoke-$$"
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -n "${SMOKE_WORKDIR:-}" ]; then
  docker run -d --name "$CONTAINER" --entrypoint node -w "$SMOKE_WORKDIR" "$IMAGE" dist/main.js >/dev/null
else
  docker run -d --name "$CONTAINER" "$IMAGE" >/dev/null
fi

deadline=$((SECONDS + TIMEOUT_SECONDS))
while [ "$SECONDS" -lt "$deadline" ]; do
  OUTPUT="$(docker logs "$CONTAINER" 2>&1 || true)"
  if grep -qE "ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|Cannot find (module|package)" <<<"$OUTPUT"; then
    echo "FAIL $IMAGE: a module did not resolve" >&2
    echo "$OUTPUT" >&2
    exit 1
  fi
  if grep -qF -- "$EXPECTED" <<<"$OUTPUT"; then
    echo "ok $IMAGE: reached \"$EXPECTED\""
    exit 0
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
    echo "FAIL $IMAGE: exited without \"$EXPECTED\"" >&2
    echo "$OUTPUT" >&2
    exit 1
  fi
  sleep 1
done

echo "FAIL $IMAGE: no \"$EXPECTED\" within ${TIMEOUT_SECONDS}s" >&2
docker logs "$CONTAINER" >&2 || true
exit 1
