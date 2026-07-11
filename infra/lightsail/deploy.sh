#!/usr/bin/env bash
# Strimz Lightsail deploy helper.
#
# Runs on your Lightsail Ubuntu 22.04 instance. Installs Docker if it
# isn't already present, builds the single-container image from the
# repo you cloned onto the box, and starts it with a persistent volume.
#
# Usage on the Lightsail instance (SSH in first):
#
#     git clone https://github.com/StrimzLab/Strimz.git strimz
#     cd strimz
#     cp infra/lightsail/env.example .env      # then fill in secrets
#     sudo bash infra/lightsail/deploy.sh
#
# Re-runs are safe — the script stops and replaces any existing
# `strimz` container without touching the `strimz-data` volume.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE_TAG="${IMAGE_TAG:-strimz:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-strimz}"
DATA_VOLUME="${DATA_VOLUME:-strimz-data}"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"
HTTP_PORT="${HTTP_PORT:-80}"

log() { printf "\033[36m[deploy]\033[0m %s\n" "$*"; }
die() { printf "\033[31m[deploy]\033[0m %s\n" "$*" >&2; exit 1; }

# ------------------------------------------------------------
# 1. Docker install (idempotent — no-op if already installed).
# ------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker CE…"
  apt-get update -qq
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  systemctl enable --now docker
else
  log "Docker already installed — skipping install."
fi

# --------------------------------------------------
# 2. Env file check — refuse to boot with placeholders.
# --------------------------------------------------
[ -f "$ENV_FILE" ] || die "Missing $ENV_FILE. Copy infra/lightsail/env.example and fill in secrets."
if grep -q '^\s*PRIVY_APP_ID=\s*$' "$ENV_FILE"; then
  die "PRIVY_APP_ID is blank in $ENV_FILE — fill it in (and every other secret) before deploying."
fi

# --------------------------------------------------
# 3. Build the image from the repo.
# --------------------------------------------------
log "Building $IMAGE_TAG (this takes ~5 minutes on cold caches)…"
docker build \
  -f "$REPO_ROOT/Dockerfile.lightsail" \
  -t "$IMAGE_TAG" \
  "$REPO_ROOT"

# --------------------------------------------------
# 4. Create the data volume if it doesn't exist.
# --------------------------------------------------
docker volume inspect "$DATA_VOLUME" >/dev/null 2>&1 || {
  log "Creating persistent volume $DATA_VOLUME…"
  docker volume create "$DATA_VOLUME"
}

# --------------------------------------------------
# 5. Replace any existing container.
# --------------------------------------------------
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "Stopping and removing existing container…"
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm   "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

# --------------------------------------------------
# 6. Boot.
# --------------------------------------------------
log "Starting container…"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -v "$DATA_VOLUME:/data" \
  -p "$HTTP_PORT:80" \
  --health-cmd 'curl -fsS http://localhost/nginx-health || exit 1' \
  --health-interval 30s \
  --health-timeout 5s \
  --health-retries 3 \
  "$IMAGE_TAG"

log ""
log "Container up. Public endpoints:"
log "  http://<lightsail-public-ip>/health   → API healthcheck"
log "  http://<lightsail-public-ip>/nginx-health"
log ""
log "Container health:   docker inspect --format '{{.State.Health.Status}}' $CONTAINER_NAME"
log "Live logs:          docker logs -f $CONTAINER_NAME"
log "Process state:      docker exec -it $CONTAINER_NAME supervisorctl status"
log "Postgres shell:     docker exec -it $CONTAINER_NAME su-exec postgres psql strimz"
