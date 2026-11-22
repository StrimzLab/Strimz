// Package chain wraps the go-ethereum client with the smaller surface the
// indexer needs: head height, block-range log fetching, block-header
// timestamp lookup, and (for tests) a mockable interface.
package chain

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rpc"
)

// Client is the read-only chain interface used by the processor. It is
// satisfied by `*ethclient.Client` directly via `EthClient` and by an
// in-memory fake in tests.
type Client interface {
	BlockNumber(ctx context.Context) (uint64, error)
	FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error)
	BlockTime(ctx context.Context, blockNumber uint64) (time.Time, error)
	BlockHash(ctx context.Context, blockNumber uint64) (string, error)
	ChainID(ctx context.Context) (uint64, error)
	Close()
}

type Source interface {
	Client
	Pin() Client
}

// EthClient adapts a go-ethereum `*ethclient.Client` to our `Client`
// interface.
type EthClient struct {
	c *ethclient.Client
}

// Dial connects to an Ethereum-compatible RPC URL and returns an `EthClient`.
func Dial(ctx context.Context, rpcURL string) (*EthClient, error) {
	rc, err := rpc.DialOptions(ctx, rpcURL, rpc.WithHTTPClient(&http.Client{Transport: brotliTransport{http.DefaultTransport}}))
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", rpcURL, err)
	}
	return &EthClient{c: ethclient.NewClient(rc)}, nil
}

// Some providers (Blockdaemon) send Brotli even when asked for identity, and
// net/http only decodes gzip.
type brotliTransport struct{ base http.RoundTripper }

func (t brotliTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	res, err := t.base.RoundTrip(req)
	if err != nil || !strings.EqualFold(res.Header.Get("Content-Encoding"), "br") {
		return res, err
	}
	res.Body = brotliBody{Reader: brotli.NewReader(res.Body), Closer: res.Body}
	res.Header.Del("Content-Encoding")
	res.Header.Del("Content-Length")
	res.ContentLength = -1
	return res, nil
}

type brotliBody struct {
	io.Reader
	io.Closer
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

func (e *EthClient) ChainID(ctx context.Context) (uint64, error) {
	id, err := e.c.ChainID(ctx)
	if err != nil {
		return 0, err
	}
	if !id.IsUint64() {
		return 0, fmt.Errorf("chain id %s does not fit in uint64", id)
	}
	return id.Uint64(), nil
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
			log.Warn("rpc endpoint unavailable at startup, skipping", "url", RedactURL(url), "err", err)
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
				fc.log.Warn("rpc failover", "from", RedactURL(fc.urls[start]), "to", RedactURL(fc.urls[idx]))
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

func (fc *FailoverClient) ChainID(ctx context.Context) (uint64, error) {
	return failoverDo(fc, func(c Client) (uint64, error) { return c.ChainID(ctx) })
}

func (fc *FailoverClient) VerifyChainID(ctx context.Context, want uint64) error {
	clients := make([]Client, 0, len(fc.clients))
	urls := make([]string, 0, len(fc.urls))
	var dropped []Client
	for i, c := range fc.clients {
		got, err := c.ChainID(ctx)
		if err != nil {
			fc.log.Warn("rpc endpoint failed eth_chainId at startup, dropping it", "url", RedactURL(fc.urls[i]), "err", err)
			dropped = append(dropped, c)
			continue
		}
		if got != want {
			return fmt.Errorf("rpc endpoint %s serves chain id %d, ARC_CHAIN_ID is %d", RedactURL(fc.urls[i]), got, want)
		}
		clients = append(clients, c)
		urls = append(urls, fc.urls[i])
	}
	if len(clients) == 0 {
		return fmt.Errorf("no rpc endpoint answered eth_chainId for chain id %d", want)
	}
	for _, c := range dropped {
		c.Close()
	}
	fc.mu.Lock()
	fc.clients, fc.urls, fc.active = clients, urls, 0
	fc.mu.Unlock()
	return nil
}

// VerifyLogRange makes every endpoint answer one eth_getLogs over a full batch,
// so an endpoint that caps the range fails at boot instead of on every poll.
func (fc *FailoverClient) VerifyLogRange(ctx context.Context, batch uint64, addresses []common.Address) error {
	for i, c := range fc.clients {
		head, err := c.BlockNumber(ctx)
		if err != nil {
			return fmt.Errorf("rpc endpoint %s: eth_blockNumber: %w", RedactURL(fc.urls[i]), err)
		}
		from := uint64(1)
		if head >= batch {
			from = head - batch + 1
		}
		if _, err := c.FilterLogs(ctx, FilterRange(addresses, nil, from, head)); err != nil {
			return fmt.Errorf("rpc endpoint %s rejected eth_getLogs over %d blocks (BLOCK_BATCH_SIZE); "+
				"give the indexer an endpoint with a wider log range: %w", RedactURL(fc.urls[i]), batch, err)
		}
	}
	return nil
}

func (fc *FailoverClient) Pin() Client {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	return &pinnedClient{fc: fc, idx: fc.active}
}

func (fc *FailoverClient) moveOff(idx int, err error) {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	if fc.active != idx || len(fc.clients) < 2 {
		return
	}
	fc.active = (idx + 1) % len(fc.clients)
	fc.log.Warn("rpc failover", "from", RedactURL(fc.urls[idx]), "to", RedactURL(fc.urls[fc.active]), "err", err)
}

type pinnedClient struct {
	fc  *FailoverClient
	idx int
}

func pinnedDo[T any](p *pinnedClient, fn func(c Client) (T, error)) (T, error) {
	out, err := fn(p.fc.clients[p.idx])
	if err != nil {
		p.fc.moveOff(p.idx, err)
		var zero T
		return zero, fmt.Errorf("rpc %s: %w", RedactURL(p.fc.urls[p.idx]), err)
	}
	return out, nil
}

func (p *pinnedClient) BlockNumber(ctx context.Context) (uint64, error) {
	return pinnedDo(p, func(c Client) (uint64, error) { return c.BlockNumber(ctx) })
}

func (p *pinnedClient) FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	return pinnedDo(p, func(c Client) ([]types.Log, error) { return c.FilterLogs(ctx, q) })
}

func (p *pinnedClient) BlockTime(ctx context.Context, blockNumber uint64) (time.Time, error) {
	return pinnedDo(p, func(c Client) (time.Time, error) { return c.BlockTime(ctx, blockNumber) })
}

func (p *pinnedClient) BlockHash(ctx context.Context, blockNumber uint64) (string, error) {
	return pinnedDo(p, func(c Client) (string, error) { return c.BlockHash(ctx, blockNumber) })
}

func (p *pinnedClient) ChainID(ctx context.Context) (uint64, error) {
	return pinnedDo(p, func(c Client) (uint64, error) { return c.ChainID(ctx) })
}

func (p *pinnedClient) Close() {}

func (fc *FailoverClient) Close() {
	for _, c := range fc.clients {
		c.Close()
	}
}

// RedactURL keeps the scheme and host but drops the path, so keys embedded in
// the URL (Alchemy's /v2/<key>, QuickNode's /<token>/) don't reach the logs.
func RedactURL(url string) string {
	scheme := 0
	if j := strings.Index(url, "://"); j >= 0 {
		scheme = j + 3
	}
	if k := strings.Index(url[scheme:], "/"); k >= 0 {
		return url[:scheme+k] + "/…"
	}
	return url
}

// FilterRange builds a `FilterQuery` for an inclusive block range. A nil
// `topics` slice means any topic.
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
