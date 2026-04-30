//go:build e2e

// e2e tests for the store. Run with `go test -tags=e2e ./internal/store/...`
// (or `pnpm --filter @strimz/indexer test:e2e`). Spins up an ephemeral
// Postgres via testcontainers, applies the Prisma migrations, and
// exercises every projection method with realistic inputs.
package store

import (
	"context"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

// We share one container across the whole suite. Each test gets a fresh
// schema state via `truncateAll`. Tests are run serially by `go test`'s
// default mode within a package.
var (
	sharedStore   *Store
	sharedCleanup func()
	sharedOnce    sync.Once
)

// startTestPostgres brings up a Postgres container, applies prisma
// migrations from the monorepo's @strimz/db package, and returns a Store
// pointing at it. Subsequent calls reuse the running container.
func startTestPostgres(t *testing.T) *Store {
	t.Helper()
	sharedOnce.Do(func() {
		ctx := context.Background()

		pg, err := tcpostgres.Run(ctx,
			"postgres:16-alpine",
			tcpostgres.WithDatabase("strimz_test"),
			tcpostgres.WithUsername("postgres"),
			tcpostgres.WithPassword("postgres"),
			tcpostgres.BasicWaitStrategies(),
			tcpostgres.WithSQLDriver("pgx"),
		)
		if err != nil {
			t.Fatalf("start postgres: %v", err)
		}

		dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
		if err != nil {
			t.Fatalf("conn string: %v", err)
		}

		repoRoot := repoRoot(t)
		dbPkg := filepath.Join(repoRoot, "packages", "db")

		migrate := exec.Command("pnpm", "db:migrate:deploy")
		migrate.Dir = dbPkg
		migrate.Env = append(os.Environ(), "DATABASE_URL="+dsn)
		migrate.Stdout = testLogWriter{t}
		migrate.Stderr = testLogWriter{t}
		if err := migrate.Run(); err != nil {
			t.Fatalf("prisma migrate deploy: %v", err)
		}

		store, err := New(ctx, dsn)
		if err != nil {
			t.Fatalf("connect: %v", err)
		}

		sharedStore = store
		sharedCleanup = func() {
			store.Close()
			_ = pg.Terminate(ctx)
		}
	})
	t.Cleanup(func() {
		if t.Failed() {
			return
		}
		// Per-test cleanup: truncate everything except IndexerCursor (which
		// some tests assert on).
		require.NoError(t, truncateMost(context.Background(), sharedStore))
	})
	return sharedStore
}

// TestMain owns the lifecycle for sharedCleanup so the container is torn
// down even when individual tests fail.
func TestMain(m *testing.M) {
	if os.Getenv("DOCKER_HOST") == "" {
		_ = os.Setenv("DOCKER_HOST", "unix://"+os.Getenv("HOME")+"/.docker/run/docker.sock")
	}
	code := m.Run()
	if sharedCleanup != nil {
		sharedCleanup()
	}
	os.Exit(code)
}

func repoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	require.NoError(t, err)
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

func truncateMost(ctx context.Context, s *Store) error {
	_, err := s.pool.Exec(ctx, `
		TRUNCATE TABLE
		  "AuditLog", "AgentActivityLog", "AgentJob",
		  "WebhookDelivery", "WebhookEvent", "MerchantWebhookEndpoint",
		  "Refund", "Transaction",
		  "SubscriptionCharge", "Subscription", "SubscriptionPlan",
		  "PaymentSession",
		  "Customer",
		  "Merchant",
		  "ComplianceLog",
		  "IndexerCursor"
		RESTART IDENTITY CASCADE`)
	return err
}

// ----- Helpers used by every test below -----

func mustExec(t *testing.T, s *Store, ctx context.Context, sql string, args ...any) {
	t.Helper()
	_, err := s.pool.Exec(ctx, sql, args...)
	require.NoError(t, err)
}

func seedMerchantOnchain(t *testing.T, s *Store, id, email, payout string, onchainID *big.Int) {
	t.Helper()
	mustExec(t, s, context.Background(), `
		INSERT INTO "Merchant" ("id", "privyUserId", "email", "payoutAddress", "onchainMerchantId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
	`, id, "did:privy:e2e:"+email, email, payout, onchainID.Int64())
}

func repeatStr(s string, n int) string {
	out := make([]byte, n*len(s))
	for i := 0; i < n; i++ {
		copy(out[i*len(s):], s)
	}
	return string(out)
}

// ===== Checkpoint =====

func TestE2E_LoadCheckpoint_ReturnsZeroForNewContract(t *testing.T) {
	s := startTestPostgres(t)
	cp, err := s.LoadCheckpoint(context.Background(), "testnet", "0x0000000000000000000000000000000000000001")
	require.NoError(t, err)
	assert.Equal(t, uint64(0), cp.LastProcessedBlock)
	assert.Equal(t, int32(-1), cp.LastProcessedLogIndex)
}

func TestE2E_SaveCheckpoint_RoundTrips(t *testing.T) {
	s := startTestPostgres(t)
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
	s := startTestPostgres(t)
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

// ===== Merchant registry =====

func TestE2E_LinkOnchainMerchant_UpdatesByPayoutAddress(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	payout := "0x000000000000000000000000000000000000beef"

	mustExec(t, s, ctx, `
		INSERT INTO "Merchant" ("id", "privyUserId", "email", "payoutAddress", "createdAt", "updatedAt")
		VALUES ('m_link', 'did:privy:e2e:link', 'l@x.io', $1, NOW(), NOW())
	`, payout)

	rows, err := s.LinkOnchainMerchant(ctx, big.NewInt(42), payout)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	rows, err = s.LinkOnchainMerchant(ctx, big.NewInt(42), payout)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	var got int64
	err = s.pool.QueryRow(ctx, `SELECT "onchainMerchantId" FROM "Merchant" WHERE id = 'm_link'`).Scan(&got)
	require.NoError(t, err)
	assert.Equal(t, int64(42), got)
}

func TestE2E_UpdateMerchantPayoutAddress(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_payout", "p@x.io", "0x000000000000000000000000000000000000abc1", big.NewInt(100))

	rows, err := s.UpdateMerchantPayoutAddress(ctx, big.NewInt(100), "0x000000000000000000000000000000000000abc2")
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	var got string
	err = s.pool.QueryRow(ctx, `SELECT "payoutAddress" FROM "Merchant" WHERE id='m_payout'`).Scan(&got)
	require.NoError(t, err)
	assert.Equal(t, "0x000000000000000000000000000000000000abc2", got)
}

func TestE2E_SetMerchantActive(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_active", "a@x.io", "0x000000000000000000000000000000000000abc3", big.NewInt(101))

	_, err := s.SetMerchantActive(ctx, big.NewInt(101), false)
	require.NoError(t, err)
	var status string
	err = s.pool.QueryRow(ctx, `SELECT status::text FROM "Merchant" WHERE id='m_active'`).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "suspended", status)

	_, err = s.SetMerchantActive(ctx, big.NewInt(101), true)
	require.NoError(t, err)
	err = s.pool.QueryRow(ctx, `SELECT status::text FROM "Merchant" WHERE id='m_active'`).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "active", status)
}

func TestE2E_LogMerchantFeeBpsChange_WritesAuditLog(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	require.NoError(t, s.LogMerchantFeeBpsChange(ctx, big.NewInt(102), 250, "0x"+repeatStr("a", 64)))

	var count int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "AuditLog" WHERE action = 'merchant.fee_bps_changed_onchain' AND "targetId" = 'onchain:102'`,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

// ===== Refunds =====

func TestE2E_CompleteRefundByTxHash_OnlyCompletesSubmitted(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	payout := "0x000000000000000000000000000000000000cafe"
	txHash := "0x" + repeatStr("a", 64)

	seedMerchantOnchain(t, s, "m_r", "r@x.io", payout, big.NewInt(200))
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

	rows, err = s.CompleteRefundByTxHash(ctx, txHash, time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}

// ===== Payments =====

func TestE2E_InsertOneShotTransaction_LinksSessionAndConfirms(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	payout := "0x000000000000000000000000000000000000d00d"
	seedMerchantOnchain(t, s, "m_pay", "pay@x.io", payout, big.NewInt(300))

	// Pre-create a PaymentSession and pass its id as `SessionRef`.
	sessionID := "sess_e2e_one_shot"
	mustExec(t, s, ctx, `
		INSERT INTO "PaymentSession" ("id", "merchantId", amount, currency, "feeAmount", "netAmount",
		  description, "checkoutUrl", mode, "expiresAt", "createdAt", "updatedAt")
		VALUES ($1, 'm_pay', '100000', 'USDC', '1500', '98500', 'test', 'https://x', 'live', NOW() + INTERVAL '1 hour', NOW(), NOW())
	`, sessionID)

	rows, err := s.InsertOneShotTransaction(ctx, OneShotTxInput{
		MerchantOnchainID: big.NewInt(300),
		PayerAddress:      "0x000000000000000000000000000000000000bbbb",
		Amount:            "100000",
		FeeAmount:         "1500",
		NetAmount:         "98500",
		Currency:          "USDC",
		SessionRef:        sessionID,
		OnchainTxHash:     "0x" + repeatStr("c", 64),
		BlockNumber:       1000,
		BlockTimestamp:    time.Now().UTC(),
		LogIndex:          0,
		Mode:              "live",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	var status string
	err = s.pool.QueryRow(ctx, `SELECT status::text FROM "PaymentSession" WHERE id=$1`, sessionID).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "confirmed", status)

	// Re-applying the same event is a no-op.
	rows, err = s.InsertOneShotTransaction(ctx, OneShotTxInput{
		MerchantOnchainID: big.NewInt(300),
		PayerAddress:      "0x000000000000000000000000000000000000bbbb",
		Amount:            "100000",
		FeeAmount:         "1500",
		NetAmount:         "98500",
		Currency:          "USDC",
		SessionRef:        sessionID,
		OnchainTxHash:     "0x" + repeatStr("c", 64),
		BlockNumber:       1000,
		BlockTimestamp:    time.Now().UTC(),
		LogIndex:          0,
		Mode:              "live",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}

// ===== Subscriptions =====

func TestE2E_SubscriptionLifecycle_CreatedThenChargedThenChargeSkipped(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_sub", "sub@x.io", "0x000000000000000000000000000000000000fefe", big.NewInt(400))

	// SubscriptionCreated
	rows, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(1),
		MerchantOnchainID:     big.NewInt(400),
		PayerAddress:          "0x000000000000000000000000000000000000aa11",
		Currency:              "USDC",
		Amount:                "20000000",
		Interval:              "monthly",
		IntervalCount:         1,
		StartAt:               time.Now().UTC(),
		NextChargeAt:          time.Now().Add(30 * 24 * time.Hour).UTC(),
		OnchainTxHash:         "0x" + repeatStr("1", 64),
		Mode:                  "live",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	// Replaying must no-op.
	rows, err = s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(1),
		MerchantOnchainID:     big.NewInt(400),
		PayerAddress:          "0x000000000000000000000000000000000000aa11",
		Currency:              "USDC",
		Amount:                "20000000",
		Interval:              "monthly",
		IntervalCount:         1,
		StartAt:               time.Now().UTC(),
		NextChargeAt:          time.Now().Add(30 * 24 * time.Hour).UTC(),
		OnchainTxHash:         "0x" + repeatStr("1", 64),
		Mode:                  "live",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)

	// Customer was upserted.
	var custCount int
	err = s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "Customer" WHERE "merchantId"='m_sub' AND "walletAddress"='0x000000000000000000000000000000000000aa11'`,
	).Scan(&custCount)
	require.NoError(t, err)
	assert.Equal(t, 1, custCount)

	// SubscriptionPlan was auto-created.
	var planCount int
	err = s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "SubscriptionPlan" WHERE "merchantId"='m_sub' AND amount='20000000' AND interval='monthly'`,
	).Scan(&planCount)
	require.NoError(t, err)
	assert.Equal(t, 1, planCount)

	// SubscriptionCharged → adds a SubscriptionCharge + Transaction.
	chargeRows, err := s.InsertSubscriptionCharge(ctx, SubscriptionChargedInput{
		OnchainSubscriptionID: big.NewInt(1),
		ChargeAttemptID:       "0x" + repeatStr("c", 64),
		Amount:                "20000000",
		FeeAmount:             "300000",
		NetAmount:             "19700000",
		NextChargeAt:          time.Now().Add(60 * 24 * time.Hour).UTC(),
		OnchainTxHash:         "0x" + repeatStr("2", 64),
		BlockNumber:           1100,
		BlockTimestamp:        time.Now().UTC(),
		LogIndex:              0,
		Mode:                  "live",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), chargeRows)

	var scCount, txCount int
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "SubscriptionCharge"`).Scan(&scCount))
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "Transaction" WHERE kind='subscription_charge'`).Scan(&txCount))
	assert.Equal(t, 1, scCount)
	assert.Equal(t, 1, txCount)

	// SubscriptionChargeSkipped flips the sub to at_risk.
	skipRows, err := s.InsertSubscriptionChargeSkip(ctx, SubscriptionChargeSkippedInput{
		OnchainSubscriptionID: big.NewInt(1),
		ChargeAttemptID:       "0x" + repeatStr("d", 64),
		Outcome:               "insufficient_funds",
		BlockTimestamp:        time.Now().UTC(),
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), skipRows)

	var subStatus string
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text FROM "Subscription" WHERE "onchainSubscriptionId"=1`,
	).Scan(&subStatus))
	assert.Equal(t, "at_risk", subStatus)
}

func TestE2E_SubscriptionCharged_OutOfOrderEventDoesntFail(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	// No SubscriptionCreated yet — Charged must silently no-op.
	rows, err := s.InsertSubscriptionCharge(ctx, SubscriptionChargedInput{
		OnchainSubscriptionID: big.NewInt(9_999),
		ChargeAttemptID:       "0x" + repeatStr("e", 64),
		Amount:                "1",
		FeeAmount:             "0",
		NetAmount:             "1",
		NextChargeAt:          time.Now().UTC(),
		OnchainTxHash:         "0x" + repeatStr("9", 64),
		BlockTimestamp:        time.Now().UTC(),
		Mode:                  "live",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}

func TestE2E_MarkSubscriptionCancelled_NoOpForAlreadyCancelled(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_cx", "cx@x.io", "0x000000000000000000000000000000000000aa44", big.NewInt(401))

	// Seed a subscription via the same path.
	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(2),
		MerchantOnchainID:     big.NewInt(401),
		PayerAddress:          "0x000000000000000000000000000000000000aa55",
		Currency:              "USDC", Amount: "10000000", Interval: "monthly", IntervalCount: 1,
		StartAt:      time.Now().UTC(),
		NextChargeAt: time.Now().Add(30 * 24 * time.Hour).UTC(),
		Mode:         "live",
	})
	require.NoError(t, err)

	rows, err := s.MarkSubscriptionCancelled(ctx, big.NewInt(2), "0xpayer", "0xtx", time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	rows, err = s.MarkSubscriptionCancelled(ctx, big.NewInt(2), "0xpayer", "0xtx", time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}

// ===== Agent jobs =====

func TestE2E_AgentJobLifecycle_FromCreatedToCompleted(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_agent", "agent@x.io", "0x000000000000000000000000000000000000ab01", big.NewInt(500))

	// Off-chain pre-creates the job (mimicking the API).
	mustExec(t, s, ctx, `
		INSERT INTO "AgentJob" ("id", "merchantId", "vendorAddress", description, amount, currency,
		  status, "assessorAddress", "createdAt")
		VALUES ('job_1', 'm_agent', '0x000000000000000000000000000000000000bbcc', 'spec', '50000000',
		  'USDC', 'accepted', '0x000000000000000000000000000000000000aaaa', NOW())
	`)

	// JobCreated → links onchainJobId and flips to in_progress.
	rows, err := s.LinkAgentJobOnchain(ctx, big.NewInt(7), "0x000000000000000000000000000000000000bbcc",
		"0x"+repeatStr("a", 64), time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)
	require.NoError(t, s.LogAgentJobEvent(ctx, big.NewInt(7), "job.created", map[string]any{"vendor": "0xbbcc"}))

	var status string
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT status::text FROM "AgentJob" WHERE id='job_1'`).Scan(&status))
	assert.Equal(t, "in_progress", status)

	// JobDelivered → status=delivered, deliverableHash set.
	_, err = s.SetAgentJobStatus(ctx, AgentJobStatusInput{
		OnchainJobID:    big.NewInt(7),
		NewStatus:       "delivered",
		DeliverableHash: "0x" + repeatStr("d", 64),
		BlockTimestamp:  time.Now().UTC(),
	})
	require.NoError(t, err)
	require.NoError(t, s.LogAgentJobEvent(ctx, big.NewInt(7), "job.delivered", nil))

	require.NoError(t, s.pool.QueryRow(ctx, `SELECT status::text FROM "AgentJob" WHERE id='job_1'`).Scan(&status))
	assert.Equal(t, "delivered", status)

	// JobApproved
	_, err = s.SetAgentJobStatus(ctx, AgentJobStatusInput{
		OnchainJobID: big.NewInt(7), NewStatus: "approved", BlockTimestamp: time.Now().UTC(),
	})
	require.NoError(t, err)
	require.NoError(t, s.LogAgentJobEvent(ctx, big.NewInt(7), "job.approved", nil))

	// JobReleased → status=completed, releaseTxHash + completedAt set.
	releaseTx := "0x" + repeatStr("r", 64)
	_, err = s.SetAgentJobStatus(ctx, AgentJobStatusInput{
		OnchainJobID:   big.NewInt(7),
		NewStatus:      "completed",
		ReleaseTxHash:  releaseTx,
		BlockTimestamp: time.Now().UTC(),
		CompletedAt:    true,
	})
	require.NoError(t, err)
	require.NoError(t, s.LogAgentJobEvent(ctx, big.NewInt(7), "job.released", map[string]any{"amount": "50000000"}))

	var release string
	var completed *time.Time
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text, "releaseTxHash", "completedAt" FROM "AgentJob" WHERE id='job_1'`,
	).Scan(&status, &release, &completed))
	assert.Equal(t, "completed", status)
	assert.Equal(t, releaseTx, release)
	require.NotNil(t, completed)

	// 4 audit log entries (created, delivered, approved, released).
	var activityCount int
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "AuditLog" WHERE "targetType"='AgentJob' AND "targetId"='job_1'`).Scan(&activityCount))
	assert.Equal(t, 4, activityCount)
}

func TestE2E_AgentJobDisputed_TransitionsAndLogsReason(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_dis", "dis@x.io", "0x000000000000000000000000000000000000ab02", big.NewInt(501))
	mustExec(t, s, ctx, `
		INSERT INTO "AgentJob" ("id", "merchantId", "onchainJobId", "vendorAddress", description, amount, currency,
		  status, "assessorAddress", "createdAt")
		VALUES ('job_dis', 'm_dis', 8, '0x000000000000000000000000000000000000ccdd', 'spec', '1000', 'USDC',
		  'in_progress', '0x000000000000000000000000000000000000aaaa', NOW())
	`)
	_, err := s.SetAgentJobStatus(ctx, AgentJobStatusInput{
		OnchainJobID:   big.NewInt(8),
		NewStatus:      "disputed",
		BlockTimestamp: time.Now().UTC(),
	})
	require.NoError(t, err)
	require.NoError(t, s.LogAgentJobEvent(ctx, big.NewInt(8), "job.disputed", map[string]any{"reason": "missing deliverable"}))

	var status string
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT status::text FROM "AgentJob" WHERE id='job_dis'`).Scan(&status))
	assert.Equal(t, "disputed", status)

	var reasonJSON string
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT metadata::text FROM "AuditLog" WHERE "targetType"='AgentJob' AND "targetId"='job_dis' ORDER BY "createdAt" DESC LIMIT 1`,
	).Scan(&reasonJSON))
	assert.Contains(t, reasonJSON, "missing deliverable")
}

// ===== Fees =====

func TestE2E_LogFeeAccrued_WritesAuditLogScopedToMerchant(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_fee", "fee@x.io", "0x000000000000000000000000000000000000ab03", big.NewInt(600))

	require.NoError(t, s.LogFeeAccrued(ctx, big.NewInt(600),
		"0x000000000000000000000000000000000000usdc",
		"50000",
		"0x"+repeatStr("f", 64)))

	var count int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "AuditLog" WHERE "merchantId"='m_fee' AND action='fees.accrued'`,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestE2E_LogFeeAccrued_NoOpForUnknownMerchant(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	require.NoError(t, s.LogFeeAccrued(ctx, big.NewInt(99_999),
		"0x000000000000000000000000000000000000usdc",
		"50000",
		"0x"+repeatStr("f", 64)))

	var count int
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "AuditLog"`).Scan(&count))
	assert.Equal(t, 0, count)
}
