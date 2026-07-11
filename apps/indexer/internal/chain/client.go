// Package chain wraps the go-ethereum client with the smaller surface the
// indexer needs: head height, block-range log fetching, block-header
// timestamp lookup, and (for tests) a mockable interface.
package chain

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Client is the read-only chain interface used by the processor. It is
// satisfied by `*ethclient.Client` directly via `EthClient` and by an
// in-memory fake in tests.
type Client interface {
	BlockNumber(ctx context.Context) (uint64, error)
	FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error)
	BlockTime(ctx context.Context, blockNumber uint64) (time.Time, error)
	BlockHash(ctx context.Context, blockNumber uint64) (string, error)
	Close()
}

// EthClient adapts a go-ethereum `*ethclient.Client` to our `Client`
// interface.
type EthClient struct {
	c *ethclient.Client
}

// Dial connects to an Ethereum-compatible RPC URL and returns an `EthClient`.
func Dial(ctx context.Context, rpcURL string) (*EthClient, error) {
	c, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", rpcURL, err)
	}
	return &EthClient{c: c}, nil
}

func (e *EthClient) BlockNumber(ctx context.Context) (uint64, error) {
	return e.c.BlockNumber(ctx)
}

func (e *EthClient) FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	return e.c.FilterLogs(ctx, q)
}

// BlockTime fetches a block header and returns its timestamp.
func (e *EthClient) BlockTime(ctx context.Context, blockNumber uint64) (time.Time, error) {
	h, err := e.c.HeaderByNumber(ctx, new(big.Int).SetUint64(blockNumber))
	if err != nil {
		return time.Time{}, fmt.Errorf("header @%d: %w", blockNumber, err)
	}
	return time.Unix(int64(h.Time), 0).UTC(), nil
}

// BlockHash returns the canonical hash of a block. Used to detect reorgs:
// if a previously-recorded block's hash changed, history was rewritten.
func (e *EthClient) BlockHash(ctx context.Context, blockNumber uint64) (string, error) {
	h, err := e.c.HeaderByNumber(ctx, new(big.Int).SetUint64(blockNumber))
	if err != nil {
		return "", fmt.Errorf("header @%d: %w", blockNumber, err)
	}
	return h.Hash().Hex(), nil
}

func (e *EthClient) Close() { e.c.Close() }

// FailoverClient fans a single logical Client over an ordered list of RPC
// endpoints. Reads try the currently-active endpoint first; on a transport
// error it advances to the next and retries, so a flaky or rate-limited
// provider doesn't stall the indexer. The active index is sticky — once an
// endpoint answers, we keep using it until it fails, rather than thrashing.
//
// Arc has deterministic finality and never reorgs, so the endpoints are
// interchangeable read replicas. The one case this guards beyond plain
// downtime: a load-balanced endpoint briefly serving from a lagging node.
// The processor's block-hash check rejects that stale data; failover then
// routes around the bad node.
type FailoverClient struct {
	clients []Client
	urls    []string
	log     *slog.Logger

	mu     sync.Mutex
	active int
}

// DialFailover dials every URL in order and returns a Client that fails over
// between them. At least one URL must connect; URLs that fail to dial are
// logged and skipped. Order is priority: put the primary endpoint first.
func DialFailover(ctx context.Context, urls []string, log *slog.Logger) (*FailoverClient, error) {
	if log == nil {
		log = slog.Default()
	}
	fc := &FailoverClient{urls: make([]string, 0, len(urls)), log: log}
	for _, url := range urls {
		c, err := Dial(ctx, url)
		if err != nil {
			log.Warn("rpc endpoint unavailable at startup, skipping", "url", redactURL(url), "err", err)
			continue
		}
		fc.clients = append(fc.clients, c)
		fc.urls = append(fc.urls, url)
	}
	if len(fc.clients) == 0 {
		return nil, errors.New("no usable RPC endpoints")
	}
	return fc, nil
}

// try runs fn against endpoints starting from the active one, advancing on
// error. It returns the first success; if every endpoint fails it returns the
// last error. On a successful failover it makes the winning endpoint sticky.
func failoverDo[T any](fc *FailoverClient, fn func(c Client) (T, error)) (T, error) {
	fc.mu.Lock()
	start := fc.active
	fc.mu.Unlock()

	var zero T
	var lastErr error
	n := len(fc.clients)
	for i := 0; i < n; i++ {
		idx := (start + i) % n
		out, err := fn(fc.clients[idx])
		if err == nil {
			if idx != start {
				fc.mu.Lock()
				fc.active = idx
				fc.mu.Unlock()
				fc.log.Warn("rpc failover", "from", redactURL(fc.urls[start]), "to", redactURL(fc.urls[idx]))
			}
			return out, nil
		}
		lastErr = err
	}
	return zero, fmt.Errorf("all %d rpc endpoints failed: %w", n, lastErr)
}

func (fc *FailoverClient) BlockNumber(ctx context.Context) (uint64, error) {
	return failoverDo(fc, func(c Client) (uint64, error) { return c.BlockNumber(ctx) })
}

func (fc *FailoverClient) FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	return failoverDo(fc, func(c Client) ([]types.Log, error) { return c.FilterLogs(ctx, q) })
}

func (fc *FailoverClient) BlockTime(ctx context.Context, blockNumber uint64) (time.Time, error) {
	return failoverDo(fc, func(c Client) (time.Time, error) { return c.BlockTime(ctx, blockNumber) })
}

func (fc *FailoverClient) BlockHash(ctx context.Context, blockNumber uint64) (string, error) {
	return failoverDo(fc, func(c Client) (string, error) { return c.BlockHash(ctx, blockNumber) })
}

func (fc *FailoverClient) Close() {
	for _, c := range fc.clients {
		c.Close()
	}
}

// redactURL keeps scheme+host but drops the path so API keys embedded in the
// URL (e.g. Alchemy's /v2/<key>) don't reach the logs.
func redactURL(url string) string {
	scheme := 0
	if j := strings.Index(url, "://"); j >= 0 {
		scheme = j + 3
	}
	if k := strings.Index(url[scheme:], "/"); k >= 0 {
		return url[:scheme+k] + "/…"
	}
	return url
}

// FilterRange builds a `FilterQuery` for the given inclusive block range,
// scoping by the contract addresses and topic[0] values the indexer cares
// about. A nil/empty `topics` slice means "any topic" — used for ERC-20
// Transfer scanning where we filter by address only.
func FilterRange(addresses []common.Address, topics []common.Hash, fromBlock, toBlock uint64) ethereum.FilterQuery {
	q := ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(toBlock),
		Addresses: addresses,
	}
	if len(topics) > 0 {
		q.Topics = [][]common.Hash{topics}
	}
	return q
}
