package health

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// FreshnessMonitor polls the IndexerCursor table on a schedule and marks
// the health server unhealthy when any cursor stalls beyond StaleAfter.
//
// A cursor stalling is the most common failure mode: a bad projection
// error loops forever, an RPC provider drops us, a batch tx deadlocks.
// The monitor turns "no visible symptom for hours" into "readyz turns
// 503 in seconds and every tick logs the stall."
//
// Scoped to the currently-configured contract addresses. Cursor rows
// left behind by old contract deployments would otherwise pin the
// oldest-updatedAt query forever and jam the alarm on.
type FreshnessMonitor struct {
	pool          *pgxpool.Pool
	env           string
	addresses     []string
	staleAfter    time.Duration
	pollEvery     time.Duration
	log           *slog.Logger
	stale         atomic.Bool
	maxLagSecs    atomic.Int64
	staleContract atomic.Value // string
}

// NewFreshnessMonitor wires the checker. `addresses` is the configured
// contract set in checkpoint (checksummed hex) form; staleAfter <= 0
// disables the check entirely (monitor becomes a no-op).
func NewFreshnessMonitor(pool *pgxpool.Pool, env string, addresses []string, staleAfter time.Duration) *FreshnessMonitor {
	return &FreshnessMonitor{
		pool:       pool,
		env:        env,
		addresses:  addresses,
		staleAfter: staleAfter,
		pollEvery:  15 * time.Second,
		log:        slog.Default().With("component", "freshness"),
	}
}

// Start polls in a loop until ctx cancels.
func (f *FreshnessMonitor) Start(ctx context.Context) {
	if f.staleAfter <= 0 || len(f.addresses) == 0 {
		return
	}
	t := time.NewTicker(f.pollEvery)
	defer t.Stop()
	f.check(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			f.check(ctx)
		}
	}
}

// IsStale is safe to call from anywhere.
func (f *FreshnessMonitor) IsStale() bool { return f.stale.Load() }

// MaxLagSeconds returns the age of the oldest monitored cursor.
func (f *FreshnessMonitor) MaxLagSeconds() int64 { return f.maxLagSecs.Load() }

// StaleContract returns the address of the oldest stalled cursor, or "".
func (f *FreshnessMonitor) StaleContract() string {
	v := f.staleContract.Load()
	if v == nil {
		return ""
	}
	return v.(string)
}

func (f *FreshnessMonitor) check(ctx context.Context) {
	row := f.pool.QueryRow(ctx,
		`SELECT "contractAddress", EXTRACT(EPOCH FROM (NOW() - "updatedAt"))::bigint
		   FROM "IndexerCursor"
		  WHERE environment = $1
		    AND "contractAddress" = ANY($2)
		  ORDER BY "updatedAt" ASC
		  LIMIT 1`,
		f.env, f.addresses)
	var addr string
	var lag int64
	if err := row.Scan(&addr, &lag); err != nil {
		// No cursors yet is fine — first tick has not run.
		f.stale.Store(false)
		f.maxLagSecs.Store(0)
		f.staleContract.Store("")
		return
	}
	f.maxLagSecs.Store(lag)
	f.staleContract.Store(addr)
	if time.Duration(lag)*time.Second > f.staleAfter {
		if !f.stale.Swap(true) {
			f.log.Warn("indexer cursor is stale",
				"contract", addr,
				"lag_seconds", lag,
				"threshold_seconds", int(f.staleAfter.Seconds()),
			)
		}
		return
	}
	if f.stale.Swap(false) {
		f.log.Info("indexer cursor recovered",
			"contract", addr,
			"lag_seconds", lag,
		)
	}
}
