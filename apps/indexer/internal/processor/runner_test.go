package processor

import (
	"context"
	"errors"
	"testing"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
)

// fakeChain is a deterministic stand-in for the on-chain client used by
// runner tests. It records every call and drives FilterLogs from a
// pre-canned response keyed on `(addr, fromBlock, toBlock)` if any.
type fakeChain struct {
	head   uint64
	headFn func() (uint64, error)
	logs   []types.Log
	calls  []ethereum.FilterQuery
}

func (f *fakeChain) BlockNumber(ctx context.Context) (uint64, error) {
	if f.headFn != nil {
		return f.headFn()
	}
	return f.head, nil
}

func (f *fakeChain) FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	f.calls = append(f.calls, q)
	return f.logs, nil
}

func (f *fakeChain) Close() {}

func TestTick_DoesNothingWhenChainBelowConfirmationWindow(t *testing.T) {
	chain := &fakeChain{head: 3}
	r := &Runner{
		cfg: &config.Config{
			Environment:        config.EnvTestnet,
			Confirmations:      5,
			BlockBatchSize:     500,
			PollIntervalMillis: 5_000,
		},
		chain: chain,
	}
	require.NoError(t, r.Tick(context.Background()))
	assert.Empty(t, chain.calls, "should not fetch logs while head <= confirmations")
}

func TestTick_PropagatesHeadFetchError(t *testing.T) {
	chain := &fakeChain{headFn: func() (uint64, error) { return 0, errors.New("rpc down") }}
	r := &Runner{cfg: &config.Config{Confirmations: 5, BlockBatchSize: 500, PollIntervalMillis: 5_000}, chain: chain}
	err := r.Tick(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "rpc down")
}
