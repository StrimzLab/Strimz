#!/usr/bin/env bash
set -euo pipefail

ARC_FOUNDRY_VERSION="v0.8.0-2"
DEST="${1:-$HOME/.local/bin}"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)
    TARGET="x86_64-unknown-linux-gnu"
    SHA256="088bdb96a84418b757f9825d491e702792f1d1d1e29a9145af305a6600a79556"
    ;;
  Linux-aarch64 | Linux-arm64)
    TARGET="aarch64-unknown-linux-gnu"
    SHA256="6508a6425bfeab62188698702771478619d4229fda1db038fb01c1050476c805"
    ;;
  Darwin-arm64)
    TARGET="aarch64-apple-darwin"
    SHA256="90e3eefbf7dd80652fd283a7562e9263301a48797bc2224cc21a3964e2d5db87"
    ;;
  *)
    echo "No Arc Foundry ${ARC_FOUNDRY_VERSION} binary for $(uname -s)-$(uname -m)." >&2
    echo "Build it from source: https://github.com/circlefin/arc-foundry#building-from-source" >&2
    exit 1
    ;;
esac

ARCHIVE="arc-foundry-${ARC_FOUNDRY_VERSION}-${TARGET}.tar.gz"
URL="https://github.com/circlefin/arc-foundry/releases/download/${ARC_FOUNDRY_VERSION}/${ARCHIVE}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -fsSL "$URL" -o "$WORK/$ARCHIVE"
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$WORK/$ARCHIVE" | cut -d' ' -f1)"
else
  ACTUAL="$(shasum -a 256 "$WORK/$ARCHIVE" | cut -d' ' -f1)"
fi
if [ "$ACTUAL" != "$SHA256" ]; then
  echo "Checksum mismatch for $ARCHIVE: expected $SHA256, got $ACTUAL" >&2
  exit 1
fi

tar -xzf "$WORK/$ARCHIVE" -C "$WORK"
mkdir -p "$DEST"
install -m 0755 "$WORK/forge" "$DEST/arc-forge"
install -m 0755 "$WORK/cast" "$DEST/arc-cast"
install -m 0755 "$WORK/anvil" "$DEST/arc-anvil"
echo "Installed Arc Foundry ${ARC_FOUNDRY_VERSION} (${TARGET}) into ${DEST}"
