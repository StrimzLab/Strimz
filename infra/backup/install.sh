#!/usr/bin/env bash
# Installs the nightly backup on the OVH host (ADR-2026-11-23-nightly-backups).
# Usage: sudo bash infra/backup/install.sh [--reconfigure]
# Secrets are read with hidden prompts and written only to /etc/strimz-backup.env.
set -euo pipefail
umask 077

[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
env_file=/etc/strimz-backup.env

ask() { # prompt, regex, hidden; prompts go to stderr, the value to stdout
  local value
  while :; do
    if [ "$3" = hidden ]; then
      read -r -s -p "$1: " value
      echo >&2
    else
      read -r -p "$1: " value
    fi
    [[ "$value" =~ $2 ]] && break
    echo "That doesn't look right, try again." >&2
  done
  printf '%s' "$value"
}

apt-get install -y -qq age >/dev/null

if [ ! -f "$env_file" ] || [ "${1:-}" = --reconfigure ]; then
  recipient="$(ask "age public key (age1...)" '^age1[0-9a-z]{58}$' shown)"
  cloud="$(ask "Cloudinary cloud name" '^[a-z0-9][a-z0-9_-]{1,63}$' shown)"
  preset="$(ask "Cloudinary unsigned upload preset name" '^[A-Za-z0-9_-]{1,100}$' hidden)"
  ping="$(ask "Healthchecks.io ping URL" '^https://hc-ping\.com/[0-9a-f-]{36}$' hidden)"
  tmp="$(mktemp /etc/strimz-backup.env.XXXXXX)"
  {
    printf 'AGE_RECIPIENT=%s\n' "$recipient"
    printf 'CLOUDINARY_CLOUD_NAME=%s\n' "$cloud"
    printf 'CLOUDINARY_UPLOAD_PRESET=%s\n' "$preset"
    printf 'HC_PING_URL=%s\n' "$ping"
  } >"$tmp"
  mv "$tmp" "$env_file"
  echo "wrote $env_file"
fi

install -m 0755 "$here/strimz-backup.sh" /usr/local/sbin/strimz-backup
install -m 0644 "$here/strimz-backup.service" "$here/strimz-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now strimz-backup.timer
systemctl list-timers strimz-backup.timer --no-pager
