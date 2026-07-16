// Package store wraps the Postgres connection pool and exposes typed write
// methods used by the projector. Every projection method is idempotent:
// `INSERT ... ON CONFLICT DO NOTHING` (or `... DO UPDATE`) keyed on a
// natural on-chain identifier so re-running the indexer produces the same
// state.
package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store is the public type. When `tx` is set (via WithTx / RunBatch),
// every write funnels through that transaction so a batch commits or
// rolls back atomically.
type Store struct {
	pool *pgxpool.Pool
	tx   pgxTxLike
}

// New connects to Postgres and verifies the connection. Caller owns Close.
func New(ctx context.Context, databaseURL string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &Store{pool: pool}, nil
}

// Close releases all DB connections.
func (s *Store) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

// Pool exposes the underlying pgxpool for callers that need to run their own
// queries (e.g., tests). Production code should prefer named methods.
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

func (s *Store) WithTx(tx pgxTxLike) *Store {
	return &Store{pool: s.pool, tx: tx}
}

// RunBatch runs fn inside a serialisable tx and hands it a tx-scoped
// Store. All writes fn performs commit atomically.
func (s *Store) RunBatch(ctx context.Context, fn func(txStore *Store) error) error {
	if s.tx != nil {
		return fn(s)
	}
	return s.withinTx(ctx, func(tx pgxTxLike) error {
		return fn(s.WithTx(tx))
	})
}

func (s *Store) db() pgxTxLike {
	if s.tx != nil {
		return s.tx
	}
	return pgxPoolAdapter{pool: s.pool}
}

func (s *Store) inTx(ctx context.Context, fn func(pgxTxLike) error) error {
	if s.tx != nil {
		return fn(s.tx)
	}
	return s.withinTx(ctx, fn)
}

// withinTx runs `fn` inside a serialisable transaction, retrying once on a
// deterministic conflict. Callers that need transactional grouping (e.g.,
// inserting a Subscription + a SubscriptionCharge atomically) use this.
//
// `fn` receives the lighter `pgxTxLike` interface so projection methods can
// be unit-tested without spinning up Postgres.
func (s *Store) withinTx(ctx context.Context, fn func(pgxTxLike) error) error {
	for attempt := 0; attempt < 2; attempt++ {
		tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
		if err != nil {
			return fmt.Errorf("begin tx: %w", err)
		}
		if err := fn(pgxTxAdapter{tx: tx}); err != nil {
			_ = tx.Rollback(ctx)
			if isSerializationFailure(err) && attempt == 0 {
				continue
			}
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			if isSerializationFailure(err) && attempt == 0 {
				continue
			}
			return fmt.Errorf("commit: %w", err)
		}
		return nil
	}
	return errors.New("retry budget exhausted")
}

func isSerializationFailure(err error) bool {
	// pgx wraps Postgres errors; the SQLSTATE we care about is 40001.
	type pgError interface{ SQLState() string }
	var pe pgError
	if errors.As(err, &pe) {
		return pe.SQLState() == "40001"
	}
	return false
}
