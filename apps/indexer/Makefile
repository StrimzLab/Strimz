SHELL := /bin/bash

.PHONY: build dev lint test test-e2e clean tidy

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
	  go test -tags=e2e -count=1 -timeout=180s ./internal/store/...

tidy:
	go mod tidy

clean:
	rm -rf bin .turbo
