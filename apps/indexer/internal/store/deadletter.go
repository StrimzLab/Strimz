package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type DeadLetter struct {
	ID              string
	Environment     string
	ContractAddress string
	TxHash          string
	LogIndex        uint
	BlockNumber     uint64
	BlockHash       string
	BlockTimestamp  time.Time
	Topics          []string
	Data            string
	Reason          string
	Attempts        int
}

func (s *Store) Savepoint(ctx context.Context, fn func() error) error {
	if s.tx == nil {
		return errors.New("savepoint requires a batch transaction")
	}
	if _, err := s.tx.Exec(ctx, `SAVEPOINT indexer_log`); err != nil {
		return fmt.Errorf("savepoint: %w", err)
	}
	if err := fn(); err != nil {
		if _, rbErr := s.tx.Exec(ctx, `ROLLBACK TO SAVEPOINT indexer_log`); rbErr != nil {
			return errors.Join(err, fmt.Errorf("rollback to savepoint: %w", rbErr))
		}
		return err
	}
	if _, err := s.tx.Exec(ctx, `RELEASE SAVEPOINT indexer_log`); err != nil {
		return fmt.Errorf("release savepoint: %w", err)
	}
	return nil
}

func (s *Store) InsertDeadLetter(ctx context.Context, d DeadLetter) error {
	_, err := s.db().Exec(ctx, `
		INSERT INTO "IndexerDeadLetter" (
		  id, environment, "contractAddress", "txHash", "logIndex", "blockNumber",
		  "blockHash", "blockTimestamp", topics, data, reason, attempts, "createdAt", "updatedAt"
		) VALUES (
		  gen_random_uuid()::text, $1::"ArcEnvironment", $2, $3, $4, $5,
		  $6, $7, $8, $9, $10, 1, NOW(), NOW()
		)
		ON CONFLICT ("txHash", "logIndex") DO NOTHING
	`, d.Environment, d.ContractAddress, d.TxHash, int64(d.LogIndex), int64(d.BlockNumber),
		d.BlockHash, d.BlockTimestamp, d.Topics, d.Data, d.Reason)
	if err != nil {
		return fmt.Errorf("insert dead letter %s:%d: %w", d.TxHash, d.LogIndex, err)
	}
	return nil
}

func (s *Store) UnresolvedDeadLetters(ctx context.Context, env string, limit int) ([]DeadLetter, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, environment::text, "contractAddress", "txHash", "logIndex", "blockNumber",
		       "blockHash", "blockTimestamp", topics, data, reason, attempts
		  FROM "IndexerDeadLetter"
		 WHERE environment::text = $1 AND "resolvedAt" IS NULL
		 ORDER BY "blockNumber", "logIndex"
		 LIMIT $2
	`, env, limit)
	if err != nil {
		return nil, fmt.Errorf("list dead letters: %w", err)
	}
	letters, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (DeadLetter, error) {
		var d DeadLetter
		var logIndex, block int64
		err := row.Scan(&d.ID, &d.Environment, &d.ContractAddress, &d.TxHash, &logIndex, &block,
			&d.BlockHash, &d.BlockTimestamp, &d.Topics, &d.Data, &d.Reason, &d.Attempts)
		d.LogIndex = uint(logIndex)
		d.BlockNumber = uint64(block)
		d.BlockTimestamp = d.BlockTimestamp.UTC()
		return d, err
	})
	if err != nil {
		return nil, fmt.Errorf("scan dead letters: %w", err)
	}
	return letters, nil
}

func (s *Store) CountUnresolvedDeadLetters(ctx context.Context, env string) (int64, error) {
	var n int64
	err := s.db().QueryRow(ctx,
		`SELECT count(*) FROM "IndexerDeadLetter" WHERE environment::text = $1 AND "resolvedAt" IS NULL`,
		env).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count dead letters: %w", err)
	}
	return n, nil
}

func (s *Store) ResolveDeadLetter(ctx context.Context, id string) error {
	_, err := s.db().Exec(ctx,
		`UPDATE "IndexerDeadLetter" SET "resolvedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("resolve dead letter %s: %w", id, err)
	}
	return nil
}

func (s *Store) RecordDeadLetterAttempt(ctx context.Context, id, reason string) error {
	_, err := s.db().Exec(ctx, `
		UPDATE "IndexerDeadLetter"
		   SET attempts = attempts + 1, reason = $2, "updatedAt" = NOW()
		 WHERE id = $1`, id, reason)
	if err != nil {
		return fmt.Errorf("record dead letter attempt %s: %w", id, err)
	}
	return nil
}
