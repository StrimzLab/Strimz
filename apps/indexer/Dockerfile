# syntax=docker/dockerfile:1.7

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /out/indexer \
    ./cmd/indexer

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/indexer /usr/local/bin/indexer
USER nonroot:nonroot
EXPOSE 4100
ENTRYPOINT ["/usr/local/bin/indexer", "run"]
