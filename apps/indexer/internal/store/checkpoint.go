package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Checkpoint is the indexer's bookmark for a single contract address. It
// answers "what's the last block I successfully projected for this address?"
type Checkpoint struct {
	ChainID               int64
	ContractAddress       string
	Environment           string
	LastProcessedBlock    uint64
	LastProcessedLogIndex int32
	// Hash of LastProcessedBlock, used to detect reorgs on the next poll.
	LastBlockHash string
}

// LoadCheckpoint returns the saved bookmark for `addr` in `env`, or a
// zero-block default if no row exists yet (i.e., first-time start).
func (s *Store) LoadCheckpoint(ctx context.Context, chainID int64, addr string) (*Checkpoint, error) {
	var cp Checkpoint
	var hash *string
	err := s.db().QueryRow(ctx, `
		SELECT "chainId", "contractAddress", environment::text, "lastProcessedBlock", "lastProcessedLogIndex", "lastBlockHash"
		FROM "IndexerCursor"
		WHERE "chainId" = $1 AND "contractAddress" = $2
	`, chainID, addr).Scan(&cp.ChainID, &cp.ContractAddress, &cp.Environment, &cp.LastProcessedBlock, &cp.LastProcessedLogIndex, &hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &Checkpoint{ChainID: chainID, ContractAddress: addr, LastProcessedLogIndex: -1}, nil
		}
		return nil, fmt.Errorf("load checkpoint %s: %w", addr, err)
	}
	if hash != nil {
		cp.LastBlockHash = *hash
	}
	return &cp, nil
}

// SaveCheckpoint persists the bookmark. Used after every successfully
// projected block range. Atomic with the projection writes via `inTx`.
func (s *Store) SaveCheckpoint(ctx context.Context, cp *Checkpoint) error {
	var hash *string
	if cp.LastBlockHash != "" {
		hash = &cp.LastBlockHash
	}
	_, err := s.db().Exec(ctx, `
		INSERT INTO "IndexerCursor" ("chainId", "contractAddress", environment, "lastProcessedBlock", "lastProcessedLogIndex", "lastBlockHash", "updatedAt")
		VALUES ($1, $2, $3::"ArcEnvironment", $4, $5, $6, NOW())
		ON CONFLICT ("chainId", "contractAddress") DO UPDATE
		  SET environment = EXCLUDED.environment,
		      "lastProcessedBlock" = EXCLUDED."lastProcessedBlock",
		      "lastProcessedLogIndex" = EXCLUDED."lastProcessedLogIndex",
		      "lastBlockHash" = EXCLUDED."lastBlockHash",
		      "updatedAt" = NOW()
	`, cp.ChainID, cp.ContractAddress, cp.Environment, cp.LastProcessedBlock, cp.LastProcessedLogIndex, hash)
	if err != nil {
		return fmt.Errorf("save checkpoint %s: %w", cp.ContractAddress, err)
	}
	return nil
}
