# Strimz Stellar contracts — build + test + deploy.
#
# Targets:
#   make build           — release WASM for all contracts
#   make test            — cargo test across the workspace (native + wasm)
#   make lint            — cargo fmt --check + clippy
#   make clean           — remove target/ and out/
#   make deploy-testnet  — upload + deploy to Stellar testnet (NET=testnet)
#   make deploy-pubnet   — upload + deploy to Stellar mainnet (NET=pubnet)
#
# Deploy targets require:
#   - The `stellar` CLI authenticated for the target network
#   - A configured deployer identity (`STELLAR_IDENTITY=…`)
#   - The deployer's account funded with XLM

SHELL := /bin/bash

CONTRACTS  := strimz-fee-collector strimz-payments strimz-subscription
OUT_DIR    := out
TARGET_DIR := target/wasm32-unknown-unknown/release

NET            ?= testnet
STELLAR_IDENTITY ?= strimz-deployer
RPC_URL_testnet  := https://soroban-testnet.stellar.org
RPC_URL_pubnet   := https://soroban-rpc.creit.tech
PASSPHRASE_testnet := Test SDF Network ; September 2015
PASSPHRASE_pubnet  := Public Global Stellar Network ; September 2015

.PHONY: build test lint clean deploy-testnet deploy-pubnet

build:
	cargo build --target wasm32-unknown-unknown --release
	@mkdir -p $(OUT_DIR)
	@for c in $(CONTRACTS); do \
	  wasm="$(TARGET_DIR)/$$(echo $$c | tr - _).wasm"; \
	  cp $$wasm $(OUT_DIR)/$$c.wasm; \
	  echo "$(OUT_DIR)/$$c.wasm:" $$(wc -c < $$wasm) bytes; \
	done

test:
	cargo test --workspace

lint:
	cargo fmt --check
	cargo clippy --workspace --target wasm32-unknown-unknown --release -- -D warnings

clean:
	rm -rf target $(OUT_DIR)

# Deploy = upload WASM (one-time, returns a hash), then instantiate the
# contract. The hash + contract id pairs are written to deploy-$(NET).env
# so the API server can pick them up via the SupportedChain.rpcConfig
# update at the end.
deploy-testnet: NET := testnet
deploy-testnet: deploy

deploy-pubnet: NET := pubnet
deploy-pubnet: deploy

deploy: build
	@echo "Deploying to $(NET) as $(STELLAR_IDENTITY)…"
	@out_env="deploy-$(NET).env"; \
	rm -f $$out_env; \
	for c in $(CONTRACTS); do \
	  hash=$$(stellar contract upload \
	    --source $(STELLAR_IDENTITY) \
	    --network $(NET) \
	    --wasm $(OUT_DIR)/$$c.wasm); \
	  id=$$(stellar contract deploy \
	    --source $(STELLAR_IDENTITY) \
	    --network $(NET) \
	    --wasm-hash $$hash); \
	  echo "$$c: hash=$$hash id=$$id"; \
	  printf '%s_HASH=%s\n%s_ID=%s\n' \
	    $$(echo $$c | tr a-z- A-Z_) "$$hash" \
	    $$(echo $$c | tr a-z- A-Z_) "$$id" >> $$out_env; \
	done; \
	echo; echo "wrote $$out_env"
