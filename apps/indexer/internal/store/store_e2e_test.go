//go:build e2e

// e2e tests for the store. Run with `go test -tags=e2e ./internal/store/...`
// (or `pnpm --filter @strimz/indexer test:e2e`). Spins up an ephemeral
// Postgres via testcontainers, applies the Prisma migrations, and exercises
// every projection method with realistic inputs.
package store

import (
	"context"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

// startTestPostgres brings up a Postgres container, applies prisma
// migrations from the monorepo's @strimz/db package, and returns a Store
// pointing at it.
func startTestPostgres(t *testing.T) (*Store, func()) {
	t.Helper()
	ctx := context.Background()

	pg, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("strimz_test"),
		tcpostgres.WithUsername("postgres"),
		tcpostgres.WithPassword("postgres"),
		tcpostgres.BasicWaitStrategies(),
		tcpostgres.WithSQLDriver("pgx"),
	)
	require.NoError(t, err)

	dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err)

	// Run prisma migrate deploy via pnpm. We assume the repo root is at
	// ../../../.. relative to this file.
	repoRoot := repoRoot(t)
	dbPkg := filepath.Join(repoRoot, "packages", "db")

	migrate := exec.Command("pnpm", "db:migrate:deploy")
	migrate.Dir = dbPkg
	migrate.Env = append(os.Environ(), "DATABASE_URL="+dsn)
	migrate.Stdout = testLogWriter{t}
	migrate.Stderr = testLogWriter{t}
	require.NoError(t, migrate.Run(), "prisma migrate deploy failed")

	// Wait briefly for the schema to settle; pgxpool.Ping below is the real check.
	time.Sleep(100 * time.Millisecond)
	require.Eventually(t, func() bool {
		s, err := New(ctx, dsn)
		if err != nil {
			return false
		}
		s.Close()
		return true
	}, 10*time.Second, 200*time.Millisecond, "store never became reachable")

	store, err := New(ctx, dsn)
	require.NoError(t, err)

	return store, func() {
		store.Close()
		_ = pg.Terminate(ctx)
	}
}

func repoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	require.NoError(t, err)
	// Walk up until we find pnpm-workspace.yaml.
	dir := wd
	for i := 0; i < 8; i++ {
		if _, err := os.Stat(filepath.Join(dir, "pnpm-workspace.yaml")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatalf("could not locate repo root from %s", wd)
	return ""
}

type testLogWriter struct{ t *testing.T }

func (w testLogWriter) Write(p []byte) (int, error) { w.t.Log(string(p)); return len(p), nil }

func waitForReady(t *testing.T) {
	if os.Getenv("DOCKER_HOST") == "" {
		_ = os.Setenv("DOCKER_HOST", "unix://"+os.Getenv("HOME")+"/.docker/run/docker.sock")
	}
}

// ----- Test cases -----

func TestE2E_LoadCheckpoint_ReturnsZeroForNewContract(t *testing.T) {
	waitForReady(t)
	s, cleanup := startTestPostgres(t)
	defer cleanup()

	cp, err := s.LoadCheckpoint(context.Background(), "testnet", "0x0000000000000000000000000000000000000001")
	require.NoError(t, err)
	assert.Equal(t, uint64(0), cp.LastProcessedBlock)
	assert.Equal(t, int32(-1), cp.LastProcessedLogIndex)
}

func TestE2E_SaveCheckpoint_RoundTrips(t *testing.T) {
	waitForReady(t)
	s, cleanup := startTestPostgres(t)
	defer cleanup()
	ctx := context.Background()
	addr := "0x0000000000000000000000000000000000000002"

	require.NoError(t, s.SaveCheckpoint(ctx, &Checkpoint{
		ContractAddress:       addr,
		Environment:           "testnet",
		LastProcessedBlock:    1234,
		LastProcessedLogIndex: 7,
	}))
	cp, err := s.LoadCheckpoint(ctx, "testnet", addr)
	require.NoError(t, err)
	assert.Equal(t, uint64(1234), cp.LastProcessedBlock)
	assert.Equal(t, int32(7), cp.LastProcessedLogIndex)
}

func TestE2E_SaveCheckpoint_IsIdempotent(t *testing.T) {
	waitForReady(t)
	s, cleanup := startTestPostgres(t)
	defer cleanup()
	ctx := context.Background()
	addr := "0x0000000000000000000000000000000000000003"

	for _, block := range []uint64{100, 200, 300} {
		require.NoError(t, s.SaveCheckpoint(ctx, &Checkpoint{
			ContractAddress:    addr,
			Environment:        "testnet",
			LastProcessedBlock: block,
		}))
	}
	cp, err := s.LoadCheckpoint(ctx, "testnet", addr)
	require.NoError(t, err)
	assert.Equal(t, uint64(300), cp.LastProcessedBlock)
}

func TestE2E_LinkOnchainMerchant_UpdatesByPayoutAddress(t *testing.T) {
	waitForReady(t)
	s, cleanup := startTestPostgres(t)
	defer cleanup()
	ctx := context.Background()
	payout := "0x000000000000000000000000000000000000beef"

	// Seed an off-chain merchant.
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "Merchant" ("id", "privyUserId", "email", "payoutAddress", "createdAt", "updatedAt")
		VALUES ('m_test', 'did:privy:e2e:t@x.io:0', 't@x.io', $1, NOW(), NOW())
	`, payout)
	require.NoError(t, err)

	rows, err := s.LinkOnchainMerchant(ctx, big.NewInt(42), payout)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	// Idempotent — second call with the same id is a no-op (still matches WHERE).
	rows, err = s.LinkOnchainMerchant(ctx, big.NewInt(42), payout)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	var got int64
	err = s.pool.QueryRow(ctx, `SELECT "onchainMerchantId" FROM "Merchant" WHERE id = 'm_test'`).Scan(&got)
	require.NoError(t, err)
	assert.Equal(t, int64(42), got)
}

func TestE2E_CompleteRefundByTxHash_OnlyCompletesSubmitted(t *testing.T) {
	waitForReady(t)
	s, cleanup := startTestPostgres(t)
	defer cleanup()
	ctx := context.Background()
	payout := "0x000000000000000000000000000000000000cafe"
	txHash := "0x" + repeatStr("a", 64)

	// Seed merchant + transaction + refund in 'submitted' state.
	mustExec(t, s, ctx, `
		INSERT INTO "Merchant" ("id", "privyUserId", "email", "payoutAddress", "createdAt", "updatedAt")
		VALUES ('m_r', 'did:privy:e2e:r@x.io:0', 'r@x.io', $1, NOW(), NOW())
	`, payout)
	mustExec(t, s, ctx, `
		INSERT INTO "Transaction" ("id", "merchantId", kind, status, amount, "feeAmount", "netAmount", currency,
		  "payerAddress", "merchantAddress", "onchainTxHash", "blockNumber", "blockTimestamp", "logIndex", mode, "createdAt")
		VALUES ('tx_r', 'm_r', 'one_shot', 'confirmed', '1000', '15', '985', 'USDC',
		  '0x000000000000000000000000000000000000bbbb', $1, $2, 100, NOW(), 0, 'live', NOW())
	`, payout, "0x"+repeatStr("b", 64))
	mustExec(t, s, ctx, `
		INSERT INTO "Refund" ("id", "merchantId", "transactionId", amount, currency, reason, status,
		  "payerAddress", "refundTxHash", "initiatedById", mode, "createdAt")
		VALUES ('rf_1', 'm_r', 'tx_r', '500', 'USDC', 'customer_request', 'submitted',
		  '0x000000000000000000000000000000000000bbbb', $1, 'm_r', 'live', NOW())
	`, txHash)

	rows, err := s.CompleteRefundByTxHash(ctx, txHash, time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	// Re-applying is a no-op (status is now 'completed').
	rows, err = s.CompleteRefundByTxHash(ctx, txHash, time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}

func mustExec(t *testing.T, s *Store, ctx context.Context, sql string, args ...any) {
	t.Helper()
	_, err := s.pool.Exec(ctx, sql, args...)
	require.NoError(t, err)
}

func repeatStr(s string, n int) string {
	out := make([]byte, n*len(s))
	for i := 0; i < n; i++ {
		copy(out[i*len(s):], s)
	}
	return string(out)
}
