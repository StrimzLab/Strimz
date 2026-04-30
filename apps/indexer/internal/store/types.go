package store

import "context"

// pgxTxLike is the subset of pgx.Tx used by projection methods.
// Declared explicitly so test fakes can stand in.
type pgxTxLike interface {
	Exec(ctx context.Context, sql string, args ...any) (pgxCommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgxRow
}

type pgxCommandTag interface {
	RowsAffected() int64
}

type pgxRow interface {
	Scan(dest ...any) error
}
