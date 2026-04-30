package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// pgxTxAdapter bridges pgx.Tx (concrete) → our pgxTxLike interface so the
// projection methods can mock the tx in unit tests.
type pgxTxAdapter struct{ tx pgx.Tx }

func (a pgxTxAdapter) Exec(ctx context.Context, sql string, args ...any) (pgxCommandTag, error) {
	tag, err := a.tx.Exec(ctx, sql, args...)
	return commandTagWrapper{tag}, err
}

func (a pgxTxAdapter) QueryRow(ctx context.Context, sql string, args ...any) pgxRow {
	return a.tx.QueryRow(ctx, sql, args...)
}

// commandTagWrapper exists because pgx 5.x's `pgconn.CommandTag` is a value
// type and does not naturally implement our `pgxCommandTag` interface
// without help.
type commandTagWrapper struct{ inner pgconn.CommandTag }

func (c commandTagWrapper) RowsAffected() int64 { return c.inner.RowsAffected() }
