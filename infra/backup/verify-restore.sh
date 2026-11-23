#!/usr/bin/env bash
# Restores a backup into a throwaway Postgres container on your machine and prints row counts.
# Usage: bash infra/backup/verify-restore.sh <strimz-...dump.age> <age key file>
# The plaintext dump only ever passes through a pipe; the container is removed at the end.
set -euo pipefail

backup="${1:?path to the .dump.age file}"
identity="${2:?path to your age private key file}"
here="$(cd "$(dirname "$0")" && pwd)"
name="strimz-restore-check-$$"

trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=strimz postgres:16 >/dev/null
# The image's init server listens only on the socket, so wait for TCP to know init is done.
until docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d strimz -q; do sleep 1; done

age -d -i "$identity" "$backup" \
  | docker exec -i "$name" pg_restore -U postgres -d strimz --no-owner --no-privileges --exit-on-error

docker exec -i "$name" psql -U postgres -d strimz -At -F ' ' <"$here/row-counts.sql"
