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
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"

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

const coreCursorKey = "strimz-core"

const deadLetterRetryLimit = 50

// Runner owns long-lived dependencies (chain client, DB pool, ABI registry)
// and drives the polling loops.
type Runner struct {
	cfg       *config.Config
	chain     chain.Source
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

	legacyCursors map[common.Address]uint64
	deadLetters   atomic.Int64
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
	stables := make([]common.Address, 0, len(cfg.Stablecoins))
	tokenMap := make(map[string]string, len(cfg.Stablecoins))
	for _, coin := range cfg.Stablecoins {
		stables = append(stables, common.HexToAddress(coin.Address))
		tokenMap[coin.Address] = coin.Symbol
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
	out := make([]string, 0, 1+len(r.stablecoinAddresses))
	out = append(out, coreCursorKey)
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
	wg.Add(1)
	go func() {
		defer wg.Done()
		r.coreLoop(ctx)
	}()
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
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := r.advanceCore(ctx, safeHead); err != nil {
			r.log.Error("stream processing failed", "head", safeHead, "err", err)
		}
	}()
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
			ts, err := r.blockTime(ctx, r.chain, lg.BlockNumber)
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
				if err := r.applyOrPark(ctx, txStore, txProjector, lg, blockTimes[lg.BlockNumber]); err != nil {
					return err
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
func (r *Runner) blockTime(ctx context.Context, client chain.Client, blockNumber uint64) (time.Time, error) {
	r.btMu.RLock()
	ts, ok := r.blockTimes[blockNumber]
	r.btMu.RUnlock()
	if ok {
		return ts, nil
	}
	ts, err := client.BlockTime(ctx, blockNumber)
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

func (r *Runner) DeadLetters() int64 { return r.deadLetters.Load() }

func (r *Runner) coreLoop(ctx context.Context) {
	t := time.NewTicker(time.Duration(r.cfg.PollIntervalMillis) * time.Millisecond)
	defer t.Stop()
	for {
		if err := r.pollCore(ctx); err != nil && ctx.Err() == nil {
			r.log.Error("stream processing failed", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

func (r *Runner) pollCore(ctx context.Context) error {
	head, err := r.chain.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get head: %w", err)
	}
	if head <= r.cfg.Confirmations {
		return nil
	}
	return r.advanceCore(ctx, head-r.cfg.Confirmations)
}

func (r *Runner) advanceCore(ctx context.Context, safeHead uint64) error {
	if err := r.processCore(ctx, safeHead); err != nil {
		return err
	}
	return r.retryDeadLetters(ctx)
}

func (r *Runner) processCore(ctx context.Context, safeHead uint64) error {
	env := string(r.cfg.Environment)
	cp, err := r.store.LoadCheckpoint(ctx, env, coreCursorKey)
	if err != nil {
		return err
	}
	legacy, err := r.loadLegacyCursors(ctx)
	if err != nil {
		return err
	}

	if cp.LastProcessedBlock > 0 && cp.LastBlockHash != "" {
		curHash, err := r.chain.BlockHash(ctx, cp.LastProcessedBlock)
		if err != nil {
			return fmt.Errorf("reorg check @%d: %w", cp.LastProcessedBlock, err)
		}
		if curHash != cp.LastBlockHash {
			return fmt.Errorf("%w: stream block %d hash %s -> %s",
				errReorg, cp.LastProcessedBlock, cp.LastBlockHash, curHash)
		}
	}

	from := cp.LastProcessedBlock + 1
	if cp.LastProcessedBlock == 0 {
		from = lowestCursor(legacy) + 1
	}

	for from <= safeHead {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		to := from + r.cfg.BlockBatchSize - 1
		if to > safeHead {
			to = safeHead
		}

		client := r.chain.Pin()
		logs, err := client.FilterLogs(ctx, chain.FilterRange(r.contractAddrs, r.subscribedTopics, from, to))
		if err != nil {
			return fmt.Errorf("filter stream [%d-%d]: %w", from, to, err)
		}
		sortLogs(logs)
		logs = dropCovered(logs, legacy)

		blockTimes := make(map[uint64]time.Time, len(logs))
		for _, lg := range logs {
			if _, ok := blockTimes[lg.BlockNumber]; ok {
				continue
			}
			ts, err := r.blockTime(ctx, client, lg.BlockNumber)
			if err != nil {
				return fmt.Errorf("block time @%d: %w", lg.BlockNumber, err)
			}
			blockTimes[lg.BlockNumber] = ts
		}
		batchHash, err := client.BlockHash(ctx, to)
		if err != nil {
			return fmt.Errorf("batch hash @%d: %w", to, err)
		}

		if err := r.store.RunBatch(ctx, func(txStore *store.Store) error {
			txProjector := r.projector.WithStore(txStore)
			for _, lg := range logs {
				if err := r.applyOrPark(ctx, txStore, txProjector, lg, blockTimes[lg.BlockNumber]); err != nil {
					return err
				}
			}
			return txStore.SaveCheckpoint(ctx, &store.Checkpoint{
				ContractAddress:       coreCursorKey,
				Environment:           env,
				LastProcessedBlock:    to,
				LastProcessedLogIndex: -1,
				LastBlockHash:         batchHash,
			})
		}); err != nil {
			return err
		}
		r.log.Debug("processed stream batch", "from", from, "to", to, "logs", len(logs))
		from = to + 1
	}
	return nil
}

func (r *Runner) applyOrPark(ctx context.Context, txStore *store.Store, p *Projector, lg types.Log, blockTime time.Time) error {
	applyErr := txStore.Savepoint(ctx, func() error { return p.Apply(ctx, lg, blockTime) })
	if applyErr == nil {
		return nil
	}
	if !errors.Is(applyErr, store.ErrUnresolvable) {
		return fmt.Errorf("apply log @%d.%d: %w", lg.BlockNumber, lg.Index, applyErr)
	}
	r.log.Error("parking unprojectable log",
		"contract", lg.Address.Hex(),
		"tx", lg.TxHash.Hex(),
		"block", lg.BlockNumber,
		"index", lg.Index,
		"err", applyErr)
	return txStore.InsertDeadLetter(ctx, deadLetterFor(string(r.cfg.Environment), lg, blockTime, applyErr))
}

func (r *Runner) retryDeadLetters(ctx context.Context) error {
	env := string(r.cfg.Environment)
	letters, err := r.store.UnresolvedDeadLetters(ctx, env, deadLetterRetryLimit)
	if err != nil {
		return err
	}
	for _, d := range letters {
		lg, err := logFromDeadLetter(d)
		if err != nil {
			return fmt.Errorf("dead letter %s: %w", d.ID, err)
		}
		if err := r.store.RunBatch(ctx, func(txStore *store.Store) error {
			applyErr := txStore.Savepoint(ctx, func() error {
				return r.projector.WithStore(txStore).Apply(ctx, lg, d.BlockTimestamp)
			})
			switch {
			case applyErr == nil:
				r.log.Info("resolved parked log", "tx", d.TxHash, "index", d.LogIndex, "attempts", d.Attempts)
				return txStore.ResolveDeadLetter(ctx, d.ID)
			case errors.Is(applyErr, store.ErrUnresolvable):
				return txStore.RecordDeadLetterAttempt(ctx, d.ID, applyErr.Error())
			default:
				return applyErr
			}
		}); err != nil {
			return fmt.Errorf("retry dead letter %s: %w", d.ID, err)
		}
	}
	n, err := r.store.CountUnresolvedDeadLetters(ctx, env)
	if err != nil {
		return err
	}
	r.deadLetters.Store(n)
	return nil
}

func (r *Runner) loadLegacyCursors(ctx context.Context) (map[common.Address]uint64, error) {
	if r.legacyCursors != nil {
		return r.legacyCursors, nil
	}
	var floor uint64
	if r.cfg.StartBlock > 0 {
		floor = r.cfg.StartBlock - 1
	}
	legacy := make(map[common.Address]uint64, len(r.contractAddrs))
	for _, addr := range r.contractAddrs {
		cp, err := r.store.LoadCheckpoint(ctx, string(r.cfg.Environment), addr.Hex())
		if err != nil {
			return nil, err
		}
		legacy[addr] = max(cp.LastProcessedBlock, floor)
	}
	r.legacyCursors = legacy
	return legacy, nil
}

func lowestCursor(cursors map[common.Address]uint64) uint64 {
	first := true
	var lowest uint64
	for _, block := range cursors {
		if first || block < lowest {
			lowest, first = block, false
		}
	}
	return lowest
}

func dropCovered(logs []types.Log, legacy map[common.Address]uint64) []types.Log {
	kept := logs[:0]
	for _, lg := range logs {
		if covered, ok := legacy[lg.Address]; ok && lg.BlockNumber <= covered {
			continue
		}
		kept = append(kept, lg)
	}
	return kept
}

func sortLogs(logs []types.Log) {
	sort.SliceStable(logs, func(i, j int) bool {
		if logs[i].BlockNumber != logs[j].BlockNumber {
			return logs[i].BlockNumber < logs[j].BlockNumber
		}
		return logs[i].Index < logs[j].Index
	})
}

func deadLetterFor(env string, lg types.Log, blockTime time.Time, cause error) store.DeadLetter {
	topics := make([]string, len(lg.Topics))
	for i, t := range lg.Topics {
		topics[i] = t.Hex()
	}
	return store.DeadLetter{
		Environment:     env,
		ContractAddress: lg.Address.Hex(),
		TxHash:          lg.TxHash.Hex(),
		LogIndex:        lg.Index,
		BlockNumber:     lg.BlockNumber,
		BlockHash:       lg.BlockHash.Hex(),
		BlockTimestamp:  blockTime,
		Topics:          topics,
		Data:            hexutil.Encode(lg.Data),
		Reason:          cause.Error(),
	}
}

func logFromDeadLetter(d store.DeadLetter) (types.Log, error) {
	data, err := hexutil.Decode(d.Data)
	if err != nil {
		return types.Log{}, fmt.Errorf("data: %w", err)
	}
	topics := make([]common.Hash, len(d.Topics))
	for i, t := range d.Topics {
		topics[i] = common.HexToHash(t)
	}
	return types.Log{
		Address:     common.HexToAddress(d.ContractAddress),
		Topics:      topics,
		Data:        data,
		BlockNumber: d.BlockNumber,
		TxHash:      common.HexToHash(d.TxHash),
		Index:       d.LogIndex,
		BlockHash:   common.HexToHash(d.BlockHash),
	}, nil
}
