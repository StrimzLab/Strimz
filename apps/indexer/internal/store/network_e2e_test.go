//go:build e2e

package store

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	arcTestnetChainID = 5042002
	arcMainnetChainID = 5042
)

func requireUniqueViolation(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	var pgErr *pgconn.PgError
	require.True(t, errors.As(err, &pgErr), "want a Postgres error, got %v", err)
	assert.Equal(t, "23505", pgErr.Code, pgErr.Message)
}

func insertCursorRow(ctx context.Context, s *Store, chainID int64, env, key string, block int64) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "IndexerCursor" ("chainId", "contractAddress", environment, "lastProcessedBlock", "lastProcessedLogIndex", "updatedAt")
		VALUES ($1, $2, $3::"ArcEnvironment", $4, -1, NOW())`, chainID, key, env, block)
	return err
}

func insertDeadLetterRow(ctx context.Context, s *Store, chainID int64, env, txHash string, logIndex int) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "IndexerDeadLetter" (
		  id, "chainId", environment, "contractAddress", "txHash", "logIndex", "blockNumber",
		  "blockHash", "blockTimestamp", topics, data, reason, "updatedAt"
		) VALUES (
		  gen_random_uuid()::text, $1, $2::"ArcEnvironment", '0x0000000000000000000000000000000000000a02', $3, $4, 10,
		  $5, NOW(), ARRAY[$6], '0x', 'merchant not linked', NOW()
		)`, chainID, env, txHash, logIndex, "0x"+repeatStr("9", 64), "0x"+repeatStr("1", 64))
	return err
}

func TestE2E_IndexerCursor_IsKeyedByChainAndKey(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()

	require.NoError(t, insertCursorRow(ctx, s, arcTestnetChainID, "testnet", "strimz-core", 100))
	require.NoError(t, insertCursorRow(ctx, s, arcMainnetChainID, "mainnet", "strimz-core", 7))
	requireUniqueViolation(t, insertCursorRow(ctx, s, arcTestnetChainID, "testnet", "strimz-core", 200))

	var block int64
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT "lastProcessedBlock" FROM "IndexerCursor" WHERE "chainId" = $1 AND "contractAddress" = 'strimz-core'`,
		arcMainnetChainID).Scan(&block))
	assert.Equal(t, int64(7), block)
}

func TestE2E_IndexerCursor_RequiresAChainID(t *testing.T) {
	s := startTestPostgres(t)
	_, err := s.pool.Exec(context.Background(), `
		INSERT INTO "IndexerCursor" ("contractAddress", environment, "lastProcessedBlock", "lastProcessedLogIndex", "updatedAt")
		VALUES ('strimz-core', 'testnet', 1, -1, NOW())`)
	require.Error(t, err)
	var pgErr *pgconn.PgError
	require.True(t, errors.As(err, &pgErr))
	assert.Equal(t, "23502", pgErr.Code, pgErr.Message)
}

func TestE2E_IndexerDeadLetter_IsUniquePerChain(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	tx := "0x" + repeatStr("a", 64)

	require.NoError(t, insertDeadLetterRow(ctx, s, arcTestnetChainID, "testnet", tx, 0))
	require.NoError(t, insertDeadLetterRow(ctx, s, arcMainnetChainID, "mainnet", tx, 0))
	requireUniqueViolation(t, insertDeadLetterRow(ctx, s, arcTestnetChainID, "testnet", tx, 0))
}
