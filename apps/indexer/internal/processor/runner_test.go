package processor

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
)

// fakeChain is a deterministic in-memory stand-in for the on-chain client.
type fakeChain struct {
	head    uint64
	headFn  func() (uint64, error)
	logs    []types.Log
	calls   []ethereum.FilterQuery
	blockTs map[uint64]time.Time
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

func (f *fakeChain) BlockTime(ctx context.Context, blockNumber uint64) (time.Time, error) {
	if ts, ok := f.blockTs[blockNumber]; ok {
		return ts, nil
	}
	return time.Now().UTC(), nil
}

func (f *fakeChain) BlockHash(ctx context.Context, blockNumber uint64) (string, error) {
	return fmt.Sprintf("0x%064x", blockNumber), nil
}

func (f *fakeChain) Close() {}

func TestTick_DoesNothingWhenChainBelowConfirmationWindow(t *testing.T) {
	c := &fakeChain{head: 3}
	r := &Runner{
		cfg: &config.Config{
			Environment:        config.EnvTestnet,
			Confirmations:      5,
			BlockBatchSize:     500,
			PollIntervalMillis: 5_000,
		},
		chain: c,
	}
	require.NoError(t, r.Tick(context.Background()))
	assert.Empty(t, c.calls, "should not fetch logs while head <= confirmations")
}

func TestTick_PropagatesHeadFetchError(t *testing.T) {
	c := &fakeChain{headFn: func() (uint64, error) { return 0, errors.New("rpc down") }}
	r := &Runner{cfg: &config.Config{Confirmations: 5, BlockBatchSize: 500, PollIntervalMillis: 5_000}, chain: c}
	err := r.Tick(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "rpc down")
}
