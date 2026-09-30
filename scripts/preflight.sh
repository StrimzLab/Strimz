#!/usr/bin/env bash
set -euo pipefail

# Hooks run with a minimal PATH; make the toolchain visible.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
command -v mise >/dev/null 2>&1 && eval "$(mise activate bash --shims)"
[ -d "$HOME/.foundry/bin" ] && export PATH="$HOME/.foundry/bin:$PATH"
[ -d "$HOME/go/bin" ] && export PATH="$HOME/go/bin:$PATH"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

SKIP_BUILD="${SKIP_BUILD:-false}"
if [ "${1:-}" = "--fast" ]; then SKIP_BUILD="true"; fi

cd "$(git rev-parse --show-toplevel)"
export TURBO_TELEMETRY_DISABLED=1

for tool in pnpm go forge; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo -e "${RED}Missing toolchain: $tool. Install it; the preflight does not skip gates.${NC}"
    exit 1
  fi
done

# Contracts are built and tested with forge directly, as in CI.
TS_ONLY='--filter=!@strimz/contracts'

echo -e "${BLUE}=== Governance Preflight ===${NC}"

echo -e "\n${BLUE}[1/5] Format check...${NC}"
pnpm format:check
UNFORMATTED_GO="$(gofmt -l apps/indexer)"
if [ -n "$UNFORMATTED_GO" ]; then
  echo -e "${RED}gofmt found unformatted files:${NC}\n$UNFORMATTED_GO"
  exit 1
fi

echo -e "\n${BLUE}[2/5] Lint...${NC}"
pnpm exec turbo run lint "$TS_ONLY"

echo -e "\n${BLUE}[3/5] Typecheck...${NC}"
pnpm exec turbo run typecheck "$TS_ONLY"

echo -e "\n${BLUE}[4/5] Tests...${NC}"
pnpm exec turbo run test "$TS_ONLY"
(cd packages/contracts && forge build && forge test)

if [ "$SKIP_BUILD" = "true" ]; then
  echo -e "\n${BLUE}[5/5] Build (skipped in --fast mode)${NC}"
else
  echo -e "\n${BLUE}[5/5] Production build...${NC}"
  pnpm exec turbo run build "$TS_ONLY"
  (cd packages/contracts && forge build --sizes)
fi

echo -e "\n${GREEN}All preflight gates passed.${NC}"
