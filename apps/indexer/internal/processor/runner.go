// Package processor is the indexer's main loop:
//
//   1. ask the chain for the current head height
//   2. load each contract's checkpoint
//   3. for each contract, fetch logs in batches of `BlockBatchSize` from
//      `lastProcessedBlock + 1` up to `head − Confirmations`
//   4. resolve each unique block's timestamp once via `eth_getBlockByNumber`
//   5. decode + project each log via the projector layer
//   6. advance the checkpoint
//
// Every step is idempotent so a crash at any point can resume cleanly.
package processor

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"

	indabi "github.com/StrimzLab/strimz/apps/indexer/internal/abi"
	"github.com/StrimzLab/strimz/apps/indexer/internal/chain"
	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

// Runner owns long-lived dependencies (chain client, DB pool, ABI registry)
// and drives the polling loop.
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
}

// NewRunner wires up the chain client, DB store, ABI registry, and
// projector. Caller is responsible for calling Close.
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
		"contracts", len(r.contractAddrs),
		"stablecoins", len(r.stablecoinAddresses),
	)
	t := time.NewTicker(time.Duration(r.cfg.PollIntervalMillis) * time.Millisecond)
	defer t.Stop()

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
		// Chain hasn't moved past the confirmation window yet.
		return nil
	}
	safeHead := head - r.cfg.Confirmations

	// Process the contract addresses (Strimz suite) and any configured
	// stablecoins (for ERC-20 Transfer → refund matching) in the same
	// pass. They share the safeHead but maintain independent checkpoints.
	for _, addr := range r.contractAddrs {
		if err := r.processContract(ctx, addr, safeHead, r.subscribedTopics); err != nil {
			r.log.Error("contract processing failed",
				"contract", addr.Hex(), "head", safeHead, "err", err)
		}
	}
	for _, addr := range r.stablecoinAddresses {
		// For ERC-20 contracts we only care about Transfer; pass the
		// Transfer topic explicitly so the RPC node returns nothing else.
		transferTopic, ok := r.registry.TopicByName(indabi.EventERC20Transfer)
		if !ok {
			continue
		}
		if err := r.processContract(ctx, addr, safeHead, []common.Hash{transferTopic}); err != nil {
			r.log.Error("stablecoin processing failed",
				"contract", addr.Hex(), "head", safeHead, "err", err)
		}
	}
	return nil
}

func (r *Runner) processContract(ctx context.Context, addr common.Address, safeHead uint64, topics []common.Hash) error {
	cp, err := r.store.LoadCheckpoint(ctx, string(r.cfg.Environment), addr.Hex())
	if err != nil {
		return err
	}

	from := cp.LastProcessedBlock + 1
	if cp.LastProcessedBlock == 0 && r.cfg.StartBlock > 0 {
		from = r.cfg.StartBlock
	}
	if from > safeHead {
		return nil
	}

	for from <= safeHead {
		to := from + r.cfg.BlockBatchSize - 1
		if to > safeHead {
			to = safeHead
		}

		q := chain.FilterRange([]common.Address{addr}, topics, from, to)
		logs, err := r.chain.FilterLogs(ctx, q)
		if err != nil {
			return fmt.Errorf("filter %s [%d-%d]: %w", addr.Hex(), from, to, err)
		}

		// Resolve each unique block's timestamp once per batch — much
		// cheaper than fetching per-log when many logs share a block.
		blockTimes := make(map[uint64]time.Time, len(logs))
		for _, lg := range logs {
			if _, ok := blockTimes[lg.BlockNumber]; ok {
				continue
			}
			ts, err := r.chain.BlockTime(ctx, lg.BlockNumber)
			if err != nil {
				return fmt.Errorf("block time @%d: %w", lg.BlockNumber, err)
			}
			blockTimes[lg.BlockNumber] = ts
		}

		for _, lg := range logs {
			if err := r.projector.Apply(ctx, lg, blockTimes[lg.BlockNumber]); err != nil {
				return fmt.Errorf("apply log @%d.%d: %w", lg.BlockNumber, lg.Index, err)
			}
		}

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
