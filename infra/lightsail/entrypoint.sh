#!/usr/bin/env bash
# Strimz single-container entrypoint.
#
# Runs once per container boot. Handles the first-time setup work that
# needs an actual root shell (initdb, database creation, Prisma
# migrations) and then hands off to supervisord, which owns every
# process for the container's lifetime.
#
# The script is idempotent: subsequent boots detect that postgres is
# already initialised + the DB exists + migrations are current, and
# skip straight to supervisord.

set -euo pipefail

log() { printf "\033[36m[entrypoint]\033[0m %s\n" "$*"; }

# -------- 1. Postgres first-time init --------

PGDATA=/data/postgres
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  log "Initialising Postgres data dir at $PGDATA…"
  # `--auth-local trust` + `--auth-host trust` are safe because postgres
  # only listens on localhost inside the container (see postgresql.conf
  # below). External access happens through nginx → the API, never
  # directly to Postgres.
  chown -R postgres:postgres "$PGDATA"
  su-exec postgres initdb \
    --pgdata="$PGDATA" \
    --auth-local=trust \
    --auth-host=trust \
    --username=postgres
  {
    echo "listen_addresses = 'localhost'"
    echo "max_connections = 100"
    echo "shared_buffers = 128MB"
  } >> "$PGDATA/postgresql.conf"
fi

# -------- 2. Temporarily start Postgres so we can prep the DB --------

log "Starting Postgres in the background for bootstrap…"
su-exec postgres pg_ctl -D "$PGDATA" -l /tmp/pg-boot.log -w start

# 2a. Create the strimz DB if it doesn't exist. `|| true` covers the
# already-exists case without a special check — cleaner than parsing
# psql output.
log "Ensuring strimz database exists…"
su-exec postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='strimz'" \
  | grep -q 1 \
  || su-exec postgres psql -c "CREATE DATABASE strimz"

# 2b. The MAC-role dance we do locally isn't needed here — apps read
# DATABASE_URL from the container env, which uses `postgres` user.
# Trust-auth on localhost means no password prompt.

# -------- 3. Prisma migrations --------
#
# Run against the running Postgres. Idempotent — if the DB is up to date
# Prisma's `migrate deploy` is a no-op.

if [ -d /repo/packages/db ]; then
  log "Applying Prisma migrations…"
  cd /repo/packages/db
  # Migration deploy uses the DATABASE_URL from the env we inherit from
  # `docker run --env-file`.
  DATABASE_URL="${DATABASE_URL:-postgresql://postgres@localhost:5432/strimz}" \
    /repo/node_modules/.bin/prisma migrate deploy || {
      log "Prisma migrations failed — check /tmp/pg-boot.log for DB issues, then re-run container."
      exit 1
    }
  cd /repo
fi

# -------- 4. Stop the bootstrap Postgres so supervisor can own it --------

log "Stopping bootstrap Postgres so supervisord takes over…"
su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop

# -------- 5. Redis data dir permissions --------

chown -R redis:redis /data/redis || true

# -------- 6. Nginx pre-flight --------

nginx -t

# -------- 7. Hand off to supervisord --------

# Default the agent toggle so supervisord's %(ENV_ENABLE_AGENT)s always
# resolves. Set ENABLE_AGENT=false in the container env to save ~120 MB on
# a memory-tight box; unset means on, matching prior behaviour.
export ENABLE_AGENT="${ENABLE_AGENT:-true}"

log "Boot complete (agent enabled: $ENABLE_AGENT). Handing off to supervisord…"
exec /usr/bin/supervisord -c /etc/supervisord.conf
