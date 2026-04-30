// Package chain wraps the go-ethereum client with the smaller surface the
// indexer needs: head height, block-range log fetching, block-header
// timestamp lookup, and (for tests) a mockable interface.
package chain

import (
	"context"
	"fmt"
	"math/big"
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

func (e *EthClient) Close() { e.c.Close() }

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
