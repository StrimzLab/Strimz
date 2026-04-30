// Package processor is the indexer's main loop:
//
//   1. ask the chain for the current head height
//   2. load each contract's checkpoint
//   3. for each contract, fetch logs in batches of `BlockBatchSize` from
//      `lastProcessedBlock + 1` up to `head − Confirmations`
//   4. decode + project each log via the projector layer
//   5. advance the checkpoint
//
// Every step is idempotent so a crash at any point can resume cleanly.
package processor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/ethereum/go-ethereum/common"

	indabi "github.com/StrimzLab/strimz/apps/indexer/internal/abi"
	"github.com/StrimzLab/strimz/apps/indexer/internal/chain"
	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

// Runner owns the long-lived dependencies (chain client, DB pool) and drives
// the polling loop.
type Runner struct {
	cfg       *config.Config
	chain     chain.Client
	store     *store.Store
	projector *Projector
	log       *slog.Logger

	// addresses we monitor — built once at startup from cfg
	contractAddrs []common.Address
}

// NewRunner wires up the chain client, DB store, and projector. Caller is
// responsible for calling Close.
func NewRunner(ctx context.Context, cfg *config.Config) (*Runner, error) {
	cli, err := chain.Dial(ctx, cfg.RPCURL)
	if err != nil {
		return nil, err
	}
	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		cli.Close()
		return nil, err
	}
	return &Runner{
		cfg:       cfg,
		chain:     cli,
		store:     st,
		projector: NewProjector(st, string(cfg.Environment)),
		log:       slog.Default().With("component", "processor"),
		contractAddrs: []common.Address{
			common.HexToAddress(cfg.RegistryAddress),
			common.HexToAddress(cfg.PaymentsAddress),
			common.HexToAddress(cfg.SubscriptionsAddress),
			common.HexToAddress(cfg.AgentEscrowAddress),
			common.HexToAddress(cfg.FeeCollectorAddress),
		},
	}, nil
}

// Close releases held resources. Safe to call from a deferred handler.
func (r *Runner) Close() {
	r.chain.Close()
	r.store.Close()
}

// Run blocks until ctx is cancelled, polling at `cfg.PollIntervalMillis`.
func (r *Runner) Run(ctx context.Context) error {
	r.log.Info("indexer starting",
		"environment", r.cfg.Environment,
		"rpcURL", r.cfg.RPCURL,
		"pollMs", r.cfg.PollIntervalMillis,
		"confirmations", r.cfg.Confirmations,
	)
	t := time.NewTicker(time.Duration(r.cfg.PollIntervalMillis) * time.Millisecond)
	defer t.Stop()

	// Run once immediately so a fresh process doesn't wait the full interval.
	if err := r.Tick(ctx); err != nil {
		r.log.Error("first tick failed", "err", err)
	}
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			if err := r.Tick(ctx); err != nil {
				r.log.Error("tick failed", "err", err)
				// Keep ticking — transient RPC / DB errors are expected.
			}
		}
	}
}

// Tick is one iteration of the processing loop. Exported so tests can step
// the loop deterministically.
func (r *Runner) Tick(ctx context.Context) error {
	head, err := r.chain.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get head: %w", err)
	}
	if head <= r.cfg.Confirmations {
		// Chain hasn't moved past the confirmation window yet (genesis testnets).
		return nil
	}
	safeHead := head - r.cfg.Confirmations

	for _, addr := range r.contractAddrs {
		if err := r.processContract(ctx, addr, safeHead); err != nil {
			r.log.Error("contract processing failed",
				"contract", addr.Hex(), "head", safeHead, "err", err)
			// Continue with other contracts — failure is per-address.
		}
	}
	return nil
}

func (r *Runner) processContract(ctx context.Context, addr common.Address, safeHead uint64) error {
	cp, err := r.store.LoadCheckpoint(ctx, string(r.cfg.Environment), addr.Hex())
	if err != nil {
		return err
	}

	from := cp.LastProcessedBlock + 1
	if cp.LastProcessedBlock == 0 && r.cfg.StartBlock > 0 {
		from = r.cfg.StartBlock
	}
	if from > safeHead {
		return nil // nothing to do
	}

	for from <= safeHead {
		to := from + r.cfg.BlockBatchSize - 1
		if to > safeHead {
			to = safeHead
		}

		q := chain.FilterRange([]common.Address{addr}, indabi.AllTopics(), from, to)
		logs, err := r.chain.FilterLogs(ctx, q)
		if err != nil {
			return fmt.Errorf("filter %s [%d-%d]: %w", addr.Hex(), from, to, err)
		}

		for _, lg := range logs {
			if err := r.projector.Apply(ctx, lg); err != nil {
				return fmt.Errorf("apply log @%d.%d: %w", lg.BlockNumber, lg.Index, err)
			}
		}

		// Advance checkpoint after the batch — even on zero logs — so the
		// next tick doesn't refetch the same range.
		if err := r.store.SaveCheckpoint(ctx, &store.Checkpoint{
			ContractAddress:       addr.Hex(),
			Environment:           string(r.cfg.Environment),
			LastProcessedBlock:    to,
			LastProcessedLogIndex: -1,
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
