// Package processor is the indexer's main loop:
//
//  1. ask the chain for the current head height
//  2. load each contract's checkpoint
//  3. for each contract, fetch logs in batches of `BlockBatchSize` from
//     `lastProcessedBlock + 1` up to `head − Confirmations`
//  4. resolve each unique block's timestamp once via `eth_getBlockByNumber`
//  5. decode + project each log via the projector layer
//  6. advance the checkpoint
//
// Every step is idempotent so a crash at any point can resume cleanly.
package processor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"

	indabi "github.com/StrimzLab/strimz/apps/indexer/internal/abi"
	"github.com/StrimzLab/strimz/apps/indexer/internal/chain"
	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

// blockTimeCacheMax bounds the shared timestamp cache. Once every
// contract has passed a block it is never asked for again, so a full
// reset on overflow is cheap and correct.
const blockTimeCacheMax = 4096

// errReorg halts a contract loop when a recorded block's hash changes —
// history rewritten past the confirmation window. We stop rather than
// commit against a fork; the freshness monitor alarms on the stall.
var errReorg = errors.New("reorg detected")

// Runner owns long-lived dependencies (chain client, DB pool, ABI registry)
// and drives the polling loops.
type Runner struct {
	cfg       *config.Config
	chain     chain.Client
	store     *store.Store
	registry  *indabi.Registry
	projector *Projector
	log       *slog.Logger

	// addresses we monitor — built once at startup.
	contractAddrs       []common.Address
	subscribedTopics    []common.Hash
	stablecoinAddresses []common.Address

	// block-timestamp cache shared across contract loops so N contracts
	// scanning the same range don't refetch the same headers.
	btMu       sync.RWMutex
	blockTimes map[uint64]time.Time
}

// NewRunner wires up the chain client, DB store, ABI registry, and
// projector. Caller is responsible for calling Close.
func NewRunner(ctx context.Context, cfg *config.Config) (*Runner, error) {
	log := slog.Default().With("component", "processor")
	rpcURLs := append([]string{cfg.RPCURL}, cfg.FallbackRPCURLs...)
	cli, err := chain.DialFailover(ctx, rpcURLs, log)
	if err != nil {
		return nil, err
	}
	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		cli.Close()
		return nil, err
	}
	registry, err := indabi.Load()
	if err != nil {
		cli.Close()
		st.Close()
		return nil, fmt.Errorf("load abis: %w", err)
	}

	contractAddrs := []common.Address{
		common.HexToAddress(cfg.RegistryAddress),
		common.HexToAddress(cfg.PaymentsAddress),
		common.HexToAddress(cfg.SubscriptionsAddress),
		common.HexToAddress(cfg.AgentEscrowAddress),
		common.HexToAddress(cfg.FeeCollectorAddress),
	}
	stables := make([]common.Address, 0, len(cfg.StablecoinAddresses))
	tokenMap := make(map[string]string, len(cfg.StablecoinAddresses))
	for _, addr := range cfg.StablecoinAddresses {
		trimmed := strings.TrimSpace(addr)
		if trimmed == "" {
			continue
		}
		stables = append(stables, common.HexToAddress(trimmed))
		// M1: assume any configured stablecoin is USDC. EURC support
		// requires per-address symbol mapping in env; M2 surface.
		tokenMap[strings.ToLower(common.HexToAddress(trimmed).Hex())] = "USDC"
	}

	return &Runner{
		cfg:                 cfg,
		chain:               cli,
		store:               st,
		registry:            registry,
		projector:           NewProjector(st, registry, string(cfg.Environment), tokenMap),
		log:                 slog.Default().With("component", "processor"),
		contractAddrs:       contractAddrs,
		subscribedTopics:    registry.SubscribedTopics(),
		stablecoinAddresses: stables,
		blockTimes:          make(map[uint64]time.Time, blockTimeCacheMax),
	}, nil
}

// Close releases held resources. Safe to call from a deferred handler.
func (r *Runner) Close() {
	r.chain.Close()
	r.store.Close()
}

// Store exposes the runner's store so out-of-band callers (freshness
// monitor, admin tools) can share the same connection pool.
func (r *Runner) Store() *store.Store { return r.store }

// MonitoredAddresses returns every polled contract address in
// checkpoint (checksummed hex) form.
func (r *Runner) MonitoredAddresses() []string {
	out := make([]string, 0, len(r.contractAddrs)+len(r.stablecoinAddresses))
	for _, a := range r.contractAddrs {
		out = append(out, a.Hex())
	}
	for _, a := range r.stablecoinAddresses {
		out = append(out, a.Hex())
	}
	return out
}

// Run starts one independent polling loop per monitored contract and
// blocks until ctx is cancelled.
//
// Each contract paces itself. A heavy backfill on one address never
// delays the others — there is no shared tick barrier. Checkpoints are
// per-contract natural keys, so parallel writes never collide. The
// pgxpool + go-ethereum ethclient are both safe for concurrent use.
func (r *Runner) Run(ctx context.Context) error {
	r.log.Info("indexer starting",
		"environment", r.cfg.Environment,
		"rpcURL", r.cfg.RPCURL,
		"pollMs", r.cfg.PollIntervalMillis,
		"confirmations", r.cfg.Confirmations,
		"contracts", len(r.contractAddrs),
		"stablecoins", len(r.stablecoinAddresses),
	)

	var wg sync.WaitGroup
	for _, addr := range r.contractAddrs {
		wg.Add(1)
		go func(addr common.Address) {
			defer wg.Done()
			r.contractLoop(ctx, addr, r.subscribedTopics, false)
		}(addr)
	}
	transferTopic, hasTransfer := r.registry.TopicByName(indabi.EventERC20Transfer)
	if hasTransfer {
		for _, addr := range r.stablecoinAddresses {
			wg.Add(1)
			go func(addr common.Address) {
				defer wg.Done()
				// Stablecoin Transfers only matter for refund matching
				// going forward — a fresh cursor starts at head instead
				// of backfilling millions of historical transfers.
				r.contractLoop(ctx, addr, []common.Hash{transferTopic}, true)
			}(addr)
		}
	}
	wg.Wait()
	return nil
}

// contractLoop polls a single contract until ctx cancels. Errors are
// logged and retried next tick; the checkpoint guarantees no gap no
// matter how many polls fail in between.
func (r *Runner) contractLoop(ctx context.Context, addr common.Address, topics []common.Hash, startAtHead bool) {
	t := time.NewTicker(time.Duration(r.cfg.PollIntervalMillis) * time.Millisecond)
	defer t.Stop()
	for {
		if err := r.pollContract(ctx, addr, topics, startAtHead); err != nil && ctx.Err() == nil {
			r.log.Error("contract processing failed", "contract", addr.Hex(), "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

func (r *Runner) pollContract(ctx context.Context, addr common.Address, topics []common.Hash, startAtHead bool) error {
	head, err := r.chain.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get head: %w", err)
	}
	if head <= r.cfg.Confirmations {
		// Chain hasn't moved past the confirmation window yet.
		return nil
	}
	return r.processContract(ctx, addr, head-r.cfg.Confirmations, topics, startAtHead)
}

// Tick processes every contract once, in parallel, and waits for all.
// Retained for tests that step the pipeline deterministically;
// production uses the independent per-contract loops in Run.
func (r *Runner) Tick(ctx context.Context) error {
	head, err := r.chain.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get head: %w", err)
	}
	if head <= r.cfg.Confirmations {
		return nil
	}
	safeHead := head - r.cfg.Confirmations

	transferTopic, hasTransfer := r.registry.TopicByName(indabi.EventERC20Transfer)

	var wg sync.WaitGroup
	for _, addr := range r.contractAddrs {
		wg.Add(1)
		go func(addr common.Address) {
			defer wg.Done()
			if err := r.processContract(ctx, addr, safeHead, r.subscribedTopics, false); err != nil {
				r.log.Error("contract processing failed",
					"contract", addr.Hex(), "head", safeHead, "err", err)
			}
		}(addr)
	}
	if hasTransfer {
		for _, addr := range r.stablecoinAddresses {
			wg.Add(1)
			go func(addr common.Address) {
				defer wg.Done()
				if err := r.processContract(ctx, addr, safeHead, []common.Hash{transferTopic}, true); err != nil {
					r.log.Error("stablecoin processing failed",
						"contract", addr.Hex(), "head", safeHead, "err", err)
				}
			}(addr)
		}
	}
	wg.Wait()
	return nil
}

func (r *Runner) processContract(ctx context.Context, addr common.Address, safeHead uint64, topics []common.Hash, startAtHead bool) error {
	cp, err := r.store.LoadCheckpoint(ctx, string(r.cfg.Environment), addr.Hex())
	if err != nil {
		return err
	}

	// Reorg guard: if the block we last recorded no longer carries the
	// same hash, the chain forked past our confirmation window. Halt this
	// contract instead of committing against a rewritten history.
	if cp.LastProcessedBlock > 0 && cp.LastBlockHash != "" {
		curHash, err := r.chain.BlockHash(ctx, cp.LastProcessedBlock)
		if err != nil {
			return fmt.Errorf("reorg check @%d: %w", cp.LastProcessedBlock, err)
		}
		if curHash != cp.LastBlockHash {
			return fmt.Errorf("%w: contract %s block %d hash %s -> %s",
				errReorg, addr.Hex(), cp.LastProcessedBlock, cp.LastBlockHash, curHash)
		}
	}

	from := cp.LastProcessedBlock + 1
	if cp.LastProcessedBlock == 0 {
		switch {
		case startAtHead:
			from = safeHead
		case r.cfg.StartBlock > 0:
			from = r.cfg.StartBlock
		}
	}
	if from > safeHead {
		return nil
	}

	for from <= safeHead {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		to := from + r.cfg.BlockBatchSize - 1
		if to > safeHead {
			to = safeHead
		}

		q := chain.FilterRange([]common.Address{addr}, topics, from, to)
		logs, err := r.chain.FilterLogs(ctx, q)
		if err != nil {
			return fmt.Errorf("filter %s [%d-%d]: %w", addr.Hex(), from, to, err)
		}

		blockTimes := make(map[uint64]time.Time, len(logs))
		for _, lg := range logs {
			if _, ok := blockTimes[lg.BlockNumber]; ok {
				continue
			}
			ts, err := r.blockTime(ctx, lg.BlockNumber)
			if err != nil {
				return fmt.Errorf("block time @%d: %w", lg.BlockNumber, err)
			}
			blockTimes[lg.BlockNumber] = ts
		}

		// Hash of the batch's top block, recorded with the checkpoint so
		// the next poll can detect a reorg of this range.
		batchTo := to
		batchHash, err := r.chain.BlockHash(ctx, batchTo)
		if err != nil {
			return fmt.Errorf("batch hash @%d: %w", batchTo, err)
		}

		// Every log in this range + the checkpoint bump commit in one
		// serialisable tx. Crash mid-batch → nothing landed, cursor
		// stays put, next run replays the same range.
		if err := r.store.RunBatch(ctx, func(txStore *store.Store) error {
			txProjector := r.projector.WithStore(txStore)
			for _, lg := range logs {
				if err := txProjector.Apply(ctx, lg, blockTimes[lg.BlockNumber]); err != nil {
					if errors.Is(err, store.ErrSkipLog) {
						r.log.Error("skipping unprojectable log",
							"contract", addr.Hex(),
							"tx", lg.TxHash.Hex(),
							"block", lg.BlockNumber,
							"index", lg.Index,
							"err", err)
						continue
					}
					return fmt.Errorf("apply log @%d.%d: %w", lg.BlockNumber, lg.Index, err)
				}
			}
			return txStore.SaveCheckpoint(ctx, &store.Checkpoint{
				ContractAddress:       addr.Hex(),
				Environment:           string(r.cfg.Environment),
				LastProcessedBlock:    batchTo,
				LastProcessedLogIndex: -1,
				LastBlockHash:         batchHash,
			})
		}); err != nil {
			return err
		}
		r.log.Debug("processed batch",
			"contract", addr.Hex(),
			"from", from, "to", to, "logs", len(logs))
		from = to + 1
	}
	return nil
}

// blockTime resolves a block's timestamp through the shared cache.
func (r *Runner) blockTime(ctx context.Context, blockNumber uint64) (time.Time, error) {
	r.btMu.RLock()
	ts, ok := r.blockTimes[blockNumber]
	r.btMu.RUnlock()
	if ok {
		return ts, nil
	}
	ts, err := r.chain.BlockTime(ctx, blockNumber)
	if err != nil {
		return time.Time{}, err
	}
	r.btMu.Lock()
	if len(r.blockTimes) >= blockTimeCacheMax {
		r.blockTimes = make(map[uint64]time.Time, blockTimeCacheMax)
	}
	r.blockTimes[blockNumber] = ts
	r.btMu.Unlock()
	return ts, nil
}
