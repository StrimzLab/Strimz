#!/usr/bin/env bash
# Copies listed folders to the public read-only mirrors (ADR-2026-11-28-public-mirrors).
#   scripts/mirror-sync.sh <sdk|contracts|web|all> [--dry-run]
# --dry-run builds each copy and runs the guard, and pushes nothing. Preflight and CI run it.
# A real sync needs MIRROR_KEY_<NAME>: the mirror's deploy key.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

target="${1:-}"
dry_run=false
[ "${2:-}" = "--dry-run" ] && dry_run=true
case "$target" in
  all) names=(sdk contracts web) ;;
  sdk | contracts | web) names=("$target") ;;
  *) echo "usage: $0 <sdk|contracts|web|all> [--dry-run]" >&2; exit 2 ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

build_copy() {
  local name="$1" dest="$2"
  mkdir -p "$dest"
  # Each line: <source folder> [<folder in the mirror>]. Only files git tracks are copied;
  # a dry run also includes new files that aren't ignored, so preflight sees them.
  local list=(--cached)
  $dry_run && list+=(--others --exclude-standard)
  while read -r src to; do
    [ -z "$src" ] || [[ "$src" == \#* ]] && continue
    to="${to:-$src}"
    git ls-files -z "${list[@]}" -- "$src" | while IFS= read -r -d '' file; do
      [ -f "$file" ] || continue # submodules and deleted files
      rel="${file#"$src"/}"
      mkdir -p "$dest/$to/$(dirname "$rel")"
      cp "$file" "$dest/$to/$rel"
    done
  done < "mirrors/$name/paths"
  # The mirror's note goes in front of a README the copy already has.
  if [ -f "$dest/README.md" ]; then
    { cat "mirrors/$name/README.md"; echo; cat "$dest/README.md"; } > "$dest/README.tmp"
    mv "$dest/README.tmp" "$dest/README.md"
  else
    cp "mirrors/$name/README.md" "$dest/README.md"
  fi
  [ -f "mirrors/$name/LICENSE" ] && cp "mirrors/$name/LICENSE" "$dest/LICENSE"
  mkdir -p "$dest/.github"
  cp mirrors/PULL_REQUEST_TEMPLATE.md "$dest/.github/PULL_REQUEST_TEMPLATE.md"
}

push_copy() {
  local name="$1" dest="$2"
  local var="MIRROR_KEY_$(echo "$name" | tr '[:lower:]' '[:upper:]')"
  local key="${!var:-}"
  [ -n "$key" ] || { echo "$var is not set" >&2; exit 1; }
  local keyfile="$work/$name.key"
  (umask 077 && printf '%s\n' "$key" > "$keyfile")
  # GitHub's published host key, so the push can't go to anyone else.
  echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > "$work/known_hosts"
  export GIT_SSH_COMMAND="ssh -i $keyfile -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$work/known_hosts"

  local clone="$work/$name-clone"
  git clone -q --depth 1 "git@github.com:StrimzLab/strimz-$name.git" "$clone" 2>/dev/null ||
    { mkdir -p "$clone" && git -C "$clone" init -q -b main &&
      git -C "$clone" remote add origin "git@github.com:StrimzLab/strimz-$name.git"; }
  find "$clone" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -R "$dest/." "$clone/"

  git -C "$clone" add -A
  if git -C "$clone" diff --cached --quiet 2>/dev/null && git -C "$clone" rev-parse -q --verify HEAD >/dev/null; then
    echo "strimz-$name: up to date"
    return
  fi
  git -C "$clone" -c user.name="Strimz Bot" -c user.email="bot@strimz.finance" \
    commit -q -m "Sync from Strimz ($(date -u +%Y-%m-%d))"
  git -C "$clone" push -q origin HEAD:main
  echo "strimz-$name: synced"
}

for name in "${names[@]}"; do
  dest="$work/$name"
  build_copy "$name" "$dest"
  # Older Node 22 releases need the flag to run TypeScript directly.
  node --experimental-strip-types --disable-warning=ExperimentalWarning \
    packages/mirror/src/cli.ts "$dest" mirrors/address-allowlist.txt
  if $dry_run; then
    echo "strimz-$name: $(find "$dest" -type f | wc -l | tr -d ' ') files pass the guard"
  else
    push_copy "$name" "$dest"
  fi
done
