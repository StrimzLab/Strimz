SHELL := /bin/bash

.PHONY: build dev lint test test-e2e clean tidy abi

CONTRACTS_DIR := ../../packages/contracts

build:
	go build -o bin/indexer ./cmd/indexer

# `make dev` sources `.env` (if present) before handing to Go. The
# indexer reads config strictly from process env via envconfig — Go has
# no framework-level dotenv the way NestJS / Next.js do — so without
# this step the shell must be pre-exported, which is easy to forget on
# a fresh terminal. `set -a` re-exports every variable the file
# declares; `set +a` returns the shell to normal after the load.
dev:
	set -a; [ -f .env ] && . ./.env; set +a; \
	  go run ./cmd/indexer run

lint:
	go vet ./...

test:
	go test -count=1 ./internal/...

test-e2e:
	DOCKER_HOST=$${DOCKER_HOST:-unix://$$HOME/.docker/run/docker.sock} \
	  CGO_ENABLED=0 go test -tags=e2e -count=1 -timeout=240s ./internal/store/...

# `make abi` regenerates the embedded ABI JSON files from the Foundry build
# output. CI fails when they differ (scripts/generate-abis.sh --check).
abi:
	@if [ ! -d "$(CONTRACTS_DIR)/out" ]; then \
	  echo "running arc-forge build first"; \
	  cd $(CONTRACTS_DIR) && arc-forge build; \
	fi
	../../scripts/generate-abis.sh

tidy:
	go mod tidy

clean:
	rm -rf bin .turbo
