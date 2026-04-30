SHELL := /bin/bash

.PHONY: build dev lint test test-e2e clean tidy abi

CONTRACTS_DIR := ../../packages/contracts
ABI_DEST := internal/abi
CONTRACTS := StrimzRegistry StrimzPayments StrimzSubscriptions StrimzAgentEscrow FeeCollector IERC20

build:
	go build -o bin/indexer ./cmd/indexer

dev:
	go run ./cmd/indexer run

lint:
	go vet ./...

test:
	go test -count=1 ./internal/...

test-e2e:
	DOCKER_HOST=$${DOCKER_HOST:-unix://$$HOME/.docker/run/docker.sock} \
	  go test -tags=e2e -count=1 -timeout=240s ./internal/store/...

# `make abi` regenerates the embedded ABI JSON files from the Foundry build
# output. Run after any contract change. The Go binary uses //go:embed to
# bundle these into the indexer image — no runtime filesystem reads.
abi:
	@if [ ! -d "$(CONTRACTS_DIR)/out" ]; then \
	  echo "running forge build first"; \
	  cd $(CONTRACTS_DIR) && forge build; \
	fi
	@for c in $(CONTRACTS); do \
	  src="$(CONTRACTS_DIR)/out/$$c.sol/$$c.json"; \
	  dst="$(ABI_DEST)/$$c.abi.json"; \
	  if [ ! -f "$$src" ]; then echo "missing $$src" >&2; exit 1; fi; \
	  jq '[.abi[] | select(.type == "event")]' "$$src" > "$$dst"; \
	  echo "$$c: $$(jq 'length' "$$dst") events → $$dst"; \
	done

tidy:
	go mod tidy

clean:
	rm -rf bin .turbo
