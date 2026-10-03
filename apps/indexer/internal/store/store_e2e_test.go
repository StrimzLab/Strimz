//go:build e2e

// e2e tests for the store. Run with `go test -tags=e2e ./internal/store/...`
// (or `pnpm --filter @strimz/indexer test:e2e`). Spins up an ephemeral
// Postgres via testcontainers, applies the Prisma migrations, and
// exercises every projection method with realistic inputs.
package store

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/testpg"
)

var (
	sharedStore *Store
	sharedOnce  sync.Once
)

func startTestPostgres(t *testing.T) *Store {
	t.Helper()
	sharedOnce.Do(func() {
		store, err := New(context.Background(), testpg.DSN(t))
		if err != nil {
			t.Fatalf("connect: %v", err)
		}
		sharedStore = store
	})
	require.NoError(t, truncateMost(context.Background(), sharedStore))
	t.Cleanup(func() {
		if t.Failed() {
			return
		}
		require.NoError(t, truncateMost(context.Background(), sharedStore))
	})
	return sharedStore
}

func TestMain(m *testing.M) { testpg.Main(m) }

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
		  "IndexerCursor",
		  "IndexerDeadLetter"
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

func TestE2E_LinkOnchainMerchant_MatchesRegistrationTxHash(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	payout := "0x000000000000000000000000000000000000beef"
	ours := "0x" + strings.Repeat("ab", 32)
	theirs := "0x" + strings.Repeat("cd", 32)

	mustExec(t, s, ctx, `
		INSERT INTO "Merchant" ("id", "privyUserId", "email", "payoutAddress", "onchainRegistrationTxHash", "createdAt", "updatedAt")
		VALUES ('m_ours', 'did:privy:e2e:ours', 'o@x.io', $1, $2, NOW(), NOW()),
		       ('m_theirs', 'did:privy:e2e:theirs', 't@x.io', $1, $3, NOW(), NOW())
	`, payout, ours, theirs)

	rows, err := s.LinkOnchainMerchant(ctx, big.NewInt(42), strings.ToUpper(ours[:2])+ours[2:])
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	rows, err = s.LinkOnchainMerchant(ctx, big.NewInt(42), ours)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	var got int64
	err = s.pool.QueryRow(ctx, `SELECT "onchainMerchantId" FROM "Merchant" WHERE id = 'm_ours'`).Scan(&got)
	require.NoError(t, err)
	assert.Equal(t, int64(42), got)

	var other *int64
	err = s.pool.QueryRow(ctx, `SELECT "onchainMerchantId" FROM "Merchant" WHERE id = 'm_theirs'`).Scan(&other)
	require.NoError(t, err)
	assert.Nil(t, other)
}

func TestE2E_LinkOnchainMerchant_UnknownTxHashLinksNothing(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	mustExec(t, s, ctx, `
		INSERT INTO "Merchant" ("id", "privyUserId", "email", "payoutAddress", "createdAt", "updatedAt")
		VALUES ('m_none', 'did:privy:e2e:none', 'n@x.io', '0x000000000000000000000000000000000000beef', NOW(), NOW())
	`)

	rows, err := s.LinkOnchainMerchant(ctx, big.NewInt(43), "0x"+strings.Repeat("ef", 32))
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
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

func seedPaymentSession(t *testing.T, s *Store, id, merchantID, amount, currency, mode string) {
	t.Helper()
	mustExec(t, s, context.Background(), `
		INSERT INTO "PaymentSession" ("id", "merchantId", amount, currency, "feeAmount", "netAmount",
		  description, "checkoutUrl", mode, "expiresAt", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4::"PaymentCurrency", '1500', '98500', 'test', 'https://x', $5::"Mode", NOW() + INTERVAL '1 hour', NOW(), NOW())
	`, id, merchantID, amount, currency, mode)
}

func oneShotInput(merchantOnchainID int64, sessionRef, txHash string) OneShotTxInput {
	return OneShotTxInput{
		MerchantOnchainID: big.NewInt(merchantOnchainID),
		PayerAddress:      "0x000000000000000000000000000000000000bbbb",
		Amount:            "100000",
		FeeAmount:         "1500",
		NetAmount:         "98500",
		Currency:          "USDC",
		SessionRef:        sessionRef,
		OnchainTxHash:     txHash,
		BlockNumber:       1000,
		BlockTimestamp:    time.Now().UTC(),
		LogIndex:          0,
		Mode:              "live",
	}
}

type oneShotOutcome struct {
	sessionStatus     string
	sessionTxHash     *string
	linkedTxCount     int
	unlinkedTxCount   int
	completedEvents   int
	mismatchAuditRows int
}

func readOneShotOutcome(t *testing.T, s *Store, sessionID string) oneShotOutcome {
	t.Helper()
	ctx := context.Background()
	var o oneShotOutcome
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text, "onchainTxHash" FROM "PaymentSession" WHERE id=$1`, sessionID,
	).Scan(&o.sessionStatus, &o.sessionTxHash))
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "Transaction" WHERE "sessionId"=$1`, sessionID,
	).Scan(&o.linkedTxCount))
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "Transaction" WHERE kind='one_shot' AND "sessionId" IS NULL`,
	).Scan(&o.unlinkedTxCount))
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "WebhookEvent" WHERE type='payment_completed'`,
	).Scan(&o.completedEvents))
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "AuditLog" WHERE action='payment.session_mismatch' AND "targetId"=$1`, sessionID,
	).Scan(&o.mismatchAuditRows))
	return o
}

func TestE2E_InsertOneShotTransaction_RejectsPaymentsThatDoNotMatchTheSession(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(in *OneShotTxInput)
		reason string
	}{
		{"amount", func(in *OneShotTxInput) { in.Amount = "1"; in.FeeAmount = "0"; in.NetAmount = "1" }, "amount"},
		{"currency", func(in *OneShotTxInput) { in.Currency = "EURC" }, "currency"},
		{"mode", func(in *OneShotTxInput) { in.Mode = "test" }, "mode"},
		{"merchant", func(in *OneShotTxInput) { in.MerchantOnchainID = big.NewInt(302) }, "merchant"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := startTestPostgres(t)
			ctx := context.Background()
			seedMerchantOnchain(t, s, "m_pay", "pay@x.io", "0x000000000000000000000000000000000000d00d", big.NewInt(301))
			seedMerchantOnchain(t, s, "m_other", "other@x.io", "0x000000000000000000000000000000000000d00e", big.NewInt(302))
			sessionID := "sess_" + tc.name
			seedPaymentSession(t, s, sessionID, "m_pay", "100000", "USDC", "live")

			in := oneShotInput(301, sessionID, "0x"+repeatStr("a", 64))
			tc.mutate(&in)
			rows, err := s.InsertOneShotTransaction(ctx, in)
			require.NoError(t, err)
			assert.Equal(t, int64(1), rows)

			o := readOneShotOutcome(t, s, sessionID)
			assert.Equal(t, "created", o.sessionStatus)
			assert.Nil(t, o.sessionTxHash)
			assert.Equal(t, 0, o.linkedTxCount)
			assert.Equal(t, 1, o.unlinkedTxCount)
			assert.Equal(t, 0, o.completedEvents)
			assert.Equal(t, 1, o.mismatchAuditRows)

			var reasons string
			require.NoError(t, s.pool.QueryRow(ctx,
				`SELECT metadata->>'reasons' FROM "AuditLog" WHERE action='payment.session_mismatch' AND "targetId"=$1`, sessionID,
			).Scan(&reasons))
			assert.Contains(t, reasons, tc.reason)

			rows, err = s.InsertOneShotTransaction(ctx, in)
			require.NoError(t, err)
			assert.Equal(t, int64(0), rows)
			assert.Equal(t, 1, readOneShotOutcome(t, s, sessionID).mismatchAuditRows)
		})
	}
}

func TestE2E_InsertOneShotTransaction_SecondPaymentForConfirmedSessionDoesNotWedge(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_pay", "pay@x.io", "0x000000000000000000000000000000000000d00d", big.NewInt(301))
	sessionID := "sess_twice"
	seedPaymentSession(t, s, sessionID, "m_pay", "100000", "USDC", "live")

	first := "0x" + repeatStr("1", 64)
	rows, err := s.InsertOneShotTransaction(ctx, oneShotInput(301, sessionID, first))
	require.NoError(t, err)
	require.Equal(t, int64(1), rows)

	rows, err = s.InsertOneShotTransaction(ctx, oneShotInput(301, sessionID, "0x"+repeatStr("2", 64)))
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	o := readOneShotOutcome(t, s, sessionID)
	assert.Equal(t, "confirmed", o.sessionStatus)
	require.NotNil(t, o.sessionTxHash)
	assert.Equal(t, first, *o.sessionTxHash)
	assert.Equal(t, 1, o.linkedTxCount)
	assert.Equal(t, 1, o.unlinkedTxCount)
	assert.Equal(t, 1, o.completedEvents)
	assert.Equal(t, 1, o.mismatchAuditRows)
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
		BlockTimestamp:        time.Now().UTC(),
		CurrentPeriodEndAt:    time.Now().Add(30 * 24 * time.Hour).UTC(),
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
		BlockTimestamp:        time.Now().UTC(),
		CurrentPeriodEndAt:    time.Now().Add(30 * 24 * time.Hour).UTC(),
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

	var payerAddress, merchantAddress string
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT "payerAddress", "merchantAddress" FROM "Transaction" WHERE kind='subscription_charge'`,
	).Scan(&payerAddress, &merchantAddress))
	assert.Equal(t, "0x000000000000000000000000000000000000aa11", payerAddress)
	assert.Equal(t, "0x000000000000000000000000000000000000fefe", merchantAddress)

	// SubscriptionChargeSkipped flips the sub to at_risk.
	skipRows, err := s.InsertSubscriptionChargeSkip(ctx, SubscriptionChargeSkippedInput{
		OnchainSubscriptionID: big.NewInt(1),
		ChargeAttemptID:       "0x" + repeatStr("d", 64),
		Outcome:               "insufficient_funds",
		IsPaymentFailure:      true,
		BlockTimestamp:        time.Now().UTC(),
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), skipRows)

	var subStatus string
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text FROM "Subscription" WHERE "onchainSubscriptionId"=1`,
	).Scan(&subStatus))
	assert.Equal(t, "at_risk", subStatus)

	// The charge-failed webhook must carry the subscription's real mode.
	// A live subscription tagged `test` never reaches the merchant's live
	// endpoints, which silently drops the exact failure notification this
	// projection exists to deliver.
	var failedMode string
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT mode::text FROM "WebhookEvent"
		  WHERE "merchantId"='m_sub' AND type='subscription_charge_failed'`,
	).Scan(&failedMode))
	assert.Equal(t, "live", failedMode)
}

func TestE2E_SubscriptionChargeSkip_NonPaymentFailureEmitsNoWebhook(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_skip", "skip@x.io", "0x000000000000000000000000000000000000fe01", big.NewInt(402))

	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(3),
		MerchantOnchainID:     big.NewInt(402),
		PayerAddress:          "0x000000000000000000000000000000000000aa22",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt:            time.Now().UTC(),
		BlockTimestamp:     time.Now().UTC(),
		CurrentPeriodEndAt: time.Now().Add(30 * 24 * time.Hour).UTC(),
		NextChargeAt:       time.Now().Add(30 * 24 * time.Hour).UTC(),
		Mode:               "live",
	})
	require.NoError(t, err)

	var evtCountBefore int
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "WebhookEvent" WHERE "merchantId"='m_skip'`,
	).Scan(&evtCountBefore))

	// A NotDue sweep is scheduler noise: audit row, no webhook, no at_risk.
	rows, err := s.InsertSubscriptionChargeSkip(ctx, SubscriptionChargeSkippedInput{
		OnchainSubscriptionID: big.NewInt(3),
		ChargeAttemptID:       "0x" + repeatStr("f", 64),
		Outcome:               "not_due",
		IsPaymentFailure:      false,
		BlockTimestamp:        time.Now().UTC(),
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	var evtCount int
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "WebhookEvent" WHERE "merchantId"='m_skip'`,
	).Scan(&evtCount))
	assert.Equal(t, evtCountBefore, evtCount)

	var status string
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text FROM "Subscription" WHERE "onchainSubscriptionId"=3`,
	).Scan(&status))
	assert.NotEqual(t, "at_risk", status)
}

func TestE2E_SubscriptionChargeSkip_PaymentFailureAfterPaidCycles(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_cycle", "cycle@x.io", "0x000000000000000000000000000000000000fe02", big.NewInt(403))

	interval := 30 * 24 * time.Hour
	start := time.Now().Add(-2 * interval).UTC().Truncate(time.Second)
	subID := big.NewInt(4)

	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: subID,
		MerchantOnchainID:     big.NewInt(403),
		PayerAddress:          "0x000000000000000000000000000000000000aa33",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt:            start,
		BlockTimestamp:     start,
		CurrentPeriodEndAt: start.Add(interval),
		NextChargeAt:       start,
		OnchainTxHash:      "0x" + repeatStr("4", 64),
		Mode:               "live",
	})
	require.NoError(t, err)

	charge := func(attempt int, at time.Time) {
		t.Helper()
		rows, err := s.InsertSubscriptionCharge(ctx, SubscriptionChargedInput{
			OnchainSubscriptionID: subID,
			ChargeAttemptID:       fmt.Sprintf("0x%064x", attempt),
			Amount:                "20000000",
			FeeAmount:             "300000",
			NetAmount:             "19700000",
			NextChargeAt:          at.Add(interval),
			OnchainTxHash:         fmt.Sprintf("0x%064x", 0x5000+attempt),
			BlockNumber:           uint64(2000 + attempt),
			BlockTimestamp:        at,
			LogIndex:              0,
			Mode:                  "live",
		})
		require.NoError(t, err)
		require.Equal(t, int64(1), rows)
	}
	fail := func(attempt int, at time.Time) int64 {
		t.Helper()
		rows, err := s.InsertSubscriptionChargeSkip(ctx, SubscriptionChargeSkippedInput{
			OnchainSubscriptionID: subID,
			ChargeAttemptID:       fmt.Sprintf("0x%064x", attempt),
			Outcome:               "insufficient_funds",
			IsPaymentFailure:      true,
			BlockTimestamp:        at,
		})
		require.NoError(t, err)
		return rows
	}
	type subState struct {
		status      string
		retryCount  int
		nextRetryAt *time.Time
	}
	read := func() subState {
		t.Helper()
		var st subState
		require.NoError(t, s.pool.QueryRow(ctx,
			`SELECT status::text, "retryCount", "nextRetryAt" FROM "Subscription" WHERE "onchainSubscriptionId"=4`,
		).Scan(&st.status, &st.retryCount, &st.nextRetryAt))
		return st
	}
	count := func(query string) int {
		t.Helper()
		var n int
		require.NoError(t, s.pool.QueryRow(ctx, query).Scan(&n))
		return n
	}

	charge(1, start)
	charge(2, start.Add(interval))
	require.Equal(t, "active", read().status)

	firstFailure := start.Add(2 * interval)
	assert.Equal(t, int64(1), fail(3, firstFailure))
	st := read()
	assert.Equal(t, "at_risk", st.status)
	assert.Equal(t, 1, st.retryCount)
	require.NotNil(t, st.nextRetryAt)
	assert.WithinDuration(t, firstFailure.Add(15*time.Minute), *st.nextRetryAt, time.Second)

	assert.Equal(t, int64(0), fail(3, firstFailure))
	replayed := read()
	assert.Equal(t, "at_risk", replayed.status)
	assert.Equal(t, 1, replayed.retryCount)
	require.NotNil(t, replayed.nextRetryAt)
	assert.WithinDuration(t, firstFailure.Add(15*time.Minute), *replayed.nextRetryAt, time.Second)
	assert.Equal(t, 1, count(`SELECT count(*) FROM "SubscriptionCharge" WHERE "merchantId"='m_cycle' AND status='failed'`))
	assert.Equal(t, 1, count(`SELECT count(*) FROM "WebhookEvent" WHERE "merchantId"='m_cycle' AND type='subscription_charge_failed'`))

	secondFailure := firstFailure.Add(15 * time.Minute)
	assert.Equal(t, int64(1), fail(4, secondFailure))
	st = read()
	assert.Equal(t, "at_risk", st.status)
	assert.Equal(t, 2, st.retryCount)
	require.NotNil(t, st.nextRetryAt)
	assert.WithinDuration(t, secondFailure.Add(time.Hour), *st.nextRetryAt, time.Second)

	charge(5, secondFailure.Add(time.Hour))
	st = read()
	assert.Equal(t, "active", st.status)
	assert.Equal(t, 0, st.retryCount)
	assert.Nil(t, st.nextRetryAt)
}

func TestE2E_SubscriptionCharged_RetryUnderSameAttemptIdUpgradesFailedRow(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_retry", "retry@x.io", "0x000000000000000000000000000000000000fe03", big.NewInt(404))

	interval := 30 * 24 * time.Hour
	start := time.Now().UTC().Truncate(time.Second)
	subID := big.NewInt(5)
	attempt := "0x" + repeatStr("5", 64)

	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: subID,
		MerchantOnchainID:     big.NewInt(404),
		PayerAddress:          "0x000000000000000000000000000000000000aa55",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt:            start,
		BlockTimestamp:     start,
		CurrentPeriodEndAt: start.Add(interval),
		NextChargeAt:       start,
		OnchainTxHash:      "0x" + repeatStr("6", 64),
		Mode:               "live",
	})
	require.NoError(t, err)

	rows, err := s.InsertSubscriptionChargeSkip(ctx, SubscriptionChargeSkippedInput{
		OnchainSubscriptionID: subID,
		ChargeAttemptID:       attempt,
		Outcome:               "insufficient_funds",
		IsPaymentFailure:      true,
		BlockTimestamp:        start,
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), rows)

	charged := SubscriptionChargedInput{
		OnchainSubscriptionID: subID,
		ChargeAttemptID:       attempt,
		Amount:                "20000000",
		FeeAmount:             "300000",
		NetAmount:             "19700000",
		NextChargeAt:          start.Add(interval),
		OnchainTxHash:         "0x" + repeatStr("7", 64),
		BlockNumber:           3000,
		BlockTimestamp:        start.Add(15 * time.Minute),
		LogIndex:              0,
		Mode:                  "live",
	}
	rows, err = s.InsertSubscriptionCharge(ctx, charged)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	type chargeRow struct {
		id, status, outcome string
		txHash              *string
		executedAt          time.Time
	}
	var c chargeRow
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT id, status::text, outcome::text, "onchainTxHash", "executedAt" FROM "SubscriptionCharge" WHERE "chargeAttemptId"=$1`, attempt,
	).Scan(&c.id, &c.status, &c.outcome, &c.txHash, &c.executedAt))
	assert.Equal(t, "succeeded", c.status)
	assert.Equal(t, "charged", c.outcome)
	require.NotNil(t, c.txHash)
	assert.Equal(t, charged.OnchainTxHash, *c.txHash)
	assert.WithinDuration(t, charged.BlockTimestamp, c.executedAt, time.Second)

	var chargeCount, linkedTx int
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "SubscriptionCharge" WHERE "merchantId"='m_retry'`).Scan(&chargeCount))
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "Transaction" WHERE "subscriptionChargeId"=$1 AND status='confirmed'`, c.id).Scan(&linkedTx))
	assert.Equal(t, 1, chargeCount)
	assert.Equal(t, 1, linkedTx)

	var status string
	var retryCount int
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text, "retryCount" FROM "Subscription" WHERE "onchainSubscriptionId"=5`,
	).Scan(&status, &retryCount))
	assert.Equal(t, "active", status)
	assert.Equal(t, 0, retryCount)

	var events int
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT count(*) FROM "WebhookEvent" WHERE "merchantId"='m_retry' AND type='subscription_charged'`,
	).Scan(&events))
	assert.Equal(t, 1, events)

	rows, err = s.InsertSubscriptionCharge(ctx, charged)
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "SubscriptionCharge" WHERE "merchantId"='m_retry'`).Scan(&chargeCount))
	assert.Equal(t, 1, chargeCount)
}

func TestE2E_SubscriptionCharged_BatchKeepsOneTransactionPerCharge(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_batch", "batch@x.io", "0x000000000000000000000000000000000000fe04", big.NewInt(405))

	interval := 30 * 24 * time.Hour
	start := time.Now().UTC().Truncate(time.Second)
	for i := int64(1); i <= 2; i++ {
		_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
			OnchainSubscriptionID: big.NewInt(10 + i),
			MerchantOnchainID:     big.NewInt(405),
			PayerAddress:          fmt.Sprintf("0x%040x", 0xaa60+i),
			Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
			StartAt:            start,
			BlockTimestamp:     start,
			CurrentPeriodEndAt: start.Add(interval),
			NextChargeAt:       start,
			OnchainTxHash:      fmt.Sprintf("0x%064x", 0x6000+i),
			Mode:               "live",
		})
		require.NoError(t, err)
	}

	batchTx := "0x" + repeatStr("b", 64)
	charge := func(sub int64, logIndex uint) SubscriptionChargedInput {
		return SubscriptionChargedInput{
			OnchainSubscriptionID: big.NewInt(sub),
			ChargeAttemptID:       fmt.Sprintf("0x%064x", 0x7000+sub),
			Amount:                "20000000",
			FeeAmount:             "300000",
			NetAmount:             "19700000",
			NextChargeAt:          start.Add(interval),
			OnchainTxHash:         batchTx,
			BlockNumber:           4000,
			BlockTimestamp:        start,
			LogIndex:              logIndex,
			Mode:                  "live",
		}
	}
	first := charge(11, 0)
	second := charge(12, 1)

	rows, err := s.InsertSubscriptionCharge(ctx, first)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)
	rows, err = s.InsertSubscriptionCharge(ctx, second)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	count := func(query string) int {
		t.Helper()
		var n int
		require.NoError(t, s.pool.QueryRow(ctx, query).Scan(&n))
		return n
	}
	assert.Equal(t, 2, count(`SELECT count(*) FROM "Transaction" WHERE "onchainTxHash"='`+batchTx+`'`))
	assert.Equal(t, 2, count(`SELECT count(*) FROM "Transaction" WHERE "subscriptionChargeId" IS NOT NULL AND "merchantId"='m_batch'`))
	assert.Equal(t, 2, count(`SELECT count(*) FROM "WebhookEvent" WHERE "merchantId"='m_batch' AND type='subscription_charged'`))

	rows, err = s.InsertSubscriptionCharge(ctx, second)
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
	assert.Equal(t, 2, count(`SELECT count(*) FROM "Transaction" WHERE "onchainTxHash"='`+batchTx+`'`))
	assert.Equal(t, 2, count(`SELECT count(*) FROM "WebhookEvent" WHERE "merchantId"='m_batch' AND type='subscription_charged'`))
}

func TestE2E_InsertOneShotTransaction_TwoPaymentsInOneTransaction(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_pay", "pay@x.io", "0x000000000000000000000000000000000000d00d", big.NewInt(301))
	seedPaymentSession(t, s, "sess_batch_a", "m_pay", "100000", "USDC", "live")
	seedPaymentSession(t, s, "sess_batch_b", "m_pay", "100000", "USDC", "live")

	txHash := "0x" + repeatStr("e", 64)
	a := oneShotInput(301, "sess_batch_a", txHash)
	b := oneShotInput(301, "sess_batch_b", txHash)
	b.LogIndex = 1

	rows, err := s.InsertOneShotTransaction(ctx, a)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)
	rows, err = s.InsertOneShotTransaction(ctx, b)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	for _, id := range []string{"sess_batch_a", "sess_batch_b"} {
		o := readOneShotOutcome(t, s, id)
		assert.Equal(t, "confirmed", o.sessionStatus, id)
		assert.Equal(t, 1, o.linkedTxCount, id)
	}
	assert.Equal(t, 2, readOneShotOutcome(t, s, "sess_batch_a").completedEvents)
}

func TestE2E_SubscriptionCharged_RecordsThePaidPeriod(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_period", "period@x.io", "0x000000000000000000000000000000000000fe05", big.NewInt(406))

	interval := 30 * 24 * time.Hour
	start := time.Now().UTC().Truncate(time.Second)
	subID := big.NewInt(6)
	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: subID,
		MerchantOnchainID:     big.NewInt(406),
		PayerAddress:          "0x000000000000000000000000000000000000aa66",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt:            start,
		BlockTimestamp:     start,
		CurrentPeriodEndAt: start.Add(interval),
		NextChargeAt:       start,
		OnchainTxHash:      "0x" + repeatStr("8", 64),
		Mode:               "live",
	})
	require.NoError(t, err)

	chargePeriod := func(attempt int64, at time.Time) (time.Time, time.Time) {
		t.Helper()
		_, err := s.InsertSubscriptionCharge(ctx, SubscriptionChargedInput{
			OnchainSubscriptionID: subID,
			ChargeAttemptID:       fmt.Sprintf("0x%064x", 0x8000+attempt),
			Amount:                "20000000",
			FeeAmount:             "300000",
			NetAmount:             "19700000",
			NextChargeAt:          at.Add(interval),
			OnchainTxHash:         fmt.Sprintf("0x%064x", 0x9000+attempt),
			BlockNumber:           uint64(5000 + attempt),
			BlockTimestamp:        at,
			LogIndex:              0,
			Mode:                  "live",
		})
		require.NoError(t, err)
		var periodStart, periodEnd time.Time
		require.NoError(t, s.pool.QueryRow(ctx,
			`SELECT "periodStartAt", "periodEndAt" FROM "SubscriptionCharge" WHERE "chargeAttemptId"=$1`,
			fmt.Sprintf("0x%064x", 0x8000+attempt),
		).Scan(&periodStart, &periodEnd))
		return periodStart, periodEnd
	}

	firstStart, firstEnd := chargePeriod(1, start)
	assert.WithinDuration(t, start, firstStart, time.Second)
	assert.WithinDuration(t, start.Add(interval), firstEnd, time.Second)

	secondStart, secondEnd := chargePeriod(2, start.Add(interval))
	assert.WithinDuration(t, start.Add(interval), secondStart, time.Second)
	assert.WithinDuration(t, start.Add(2*interval), secondEnd, time.Second)
}

func TestE2E_SubscriptionCharged_OutOfOrderEventIsUnresolvable(t *testing.T) {
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
	require.ErrorIs(t, err, ErrUnresolvable)
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
		StartAt:            time.Now().UTC(),
		BlockTimestamp:     time.Now().UTC(),
		CurrentPeriodEndAt: time.Now().Add(30 * 24 * time.Hour).UTC(),
		NextChargeAt:       time.Now().Add(30 * 24 * time.Hour).UTC(),
		Mode:               "live",
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
		  status, "assessorAddress", "escrowTxHash", "createdAt")
		VALUES ('job_1', 'm_agent', '0x000000000000000000000000000000000000bbcc', 'spec', '50000000',
		  'USDC', 'in_progress', '0x000000000000000000000000000000000000aaaa', $1, NOW())
	`, "0x"+repeatStr("a", 64))

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

func seedPendingAgentJob(t *testing.T, s *Store, id, vendor, escrowTxHash string) {
	t.Helper()
	mustExec(t, s, context.Background(), `
		INSERT INTO "AgentJob" ("id", "merchantId", "vendorAddress", description, amount, currency,
		  status, "assessorAddress", "escrowTxHash", "createdAt")
		VALUES ($1, 'm_agent', $2, 'spec', '50000000', 'USDC', 'in_progress',
		  '0x000000000000000000000000000000000000aaaa', NULLIF($3, ''), NOW())
	`, id, vendor, escrowTxHash)
}

func readAgentJobLink(t *testing.T, s *Store, id string) (onchainJobID *int64, status string) {
	t.Helper()
	require.NoError(t, s.pool.QueryRow(context.Background(),
		`SELECT "onchainJobId", status::text FROM "AgentJob" WHERE id=$1`, id,
	).Scan(&onchainJobID, &status))
	return onchainJobID, status
}

func TestE2E_LinkAgentJobOnchain_MatchesTheFundingTransaction(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_agent", "agent@x.io", "0x000000000000000000000000000000000000ab01", big.NewInt(500))
	vendor := "0x000000000000000000000000000000000000bbcc"
	txA := "0x" + repeatStr("1", 64)
	txB := "0x" + repeatStr("2", 64)
	seedPendingAgentJob(t, s, "job_a", vendor, txA)
	seedPendingAgentJob(t, s, "job_b", vendor, txB)

	rows, err := s.LinkAgentJobOnchain(ctx, big.NewInt(22), vendor, txB, time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	idA, _ := readAgentJobLink(t, s, "job_a")
	idB, _ := readAgentJobLink(t, s, "job_b")
	assert.Nil(t, idA)
	require.NotNil(t, idB)
	assert.Equal(t, int64(22), *idB)

	rows, err = s.LinkAgentJobOnchain(ctx, big.NewInt(21), vendor, txA, time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)
	idA, _ = readAgentJobLink(t, s, "job_a")
	require.NotNil(t, idA)
	assert.Equal(t, int64(21), *idA)

	rows, err = s.LinkAgentJobOnchain(ctx, big.NewInt(22), vendor, txB, time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}

func TestE2E_LinkAgentJobOnchain_IgnoresJobsStrimzDidNotFund(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_agent", "agent@x.io", "0x000000000000000000000000000000000000ab01", big.NewInt(500))
	vendor := "0x000000000000000000000000000000000000bbcc"
	seedPendingAgentJob(t, s, "job_ours", vendor, "0x"+repeatStr("3", 64))
	seedPendingAgentJob(t, s, "job_unfunded", vendor, "")

	rows, err := s.LinkAgentJobOnchain(ctx, big.NewInt(99), vendor, "0x"+repeatStr("f", 64), time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)

	for _, id := range []string{"job_ours", "job_unfunded"} {
		onchainID, status := readAgentJobLink(t, s, id)
		assert.Nil(t, onchainID, id)
		assert.Equal(t, "in_progress", status, id)
	}
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

func TestE2E_LogFeeAccrued_UnknownMerchantIsUnresolvable(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	require.ErrorIs(t, s.LogFeeAccrued(ctx, big.NewInt(99_999),
		"0x000000000000000000000000000000000000usdc",
		"50000",
		"0x"+repeatStr("f", 64)), ErrUnresolvable)

	var count int
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT count(*) FROM "AuditLog"`).Scan(&count))
	assert.Equal(t, 0, count)
}

func TestE2E_SubscriptionCreated_FutureFirstChargeIsATrial(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_trial", "trial@x.io", "0x000000000000000000000000000000000000fe11", big.NewInt(410))

	block := time.Now().UTC().Truncate(time.Second)
	trialEnd := block.Add(14 * 24 * time.Hour)
	subID := big.NewInt(40)

	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: subID,
		MerchantOnchainID:     big.NewInt(410),
		PayerAddress:          "0x000000000000000000000000000000000000aa40",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt:            trialEnd,
		BlockTimestamp:     block,
		CurrentPeriodEndAt: trialEnd.Add(30 * 24 * time.Hour),
		NextChargeAt:       trialEnd,
		OnchainTxHash:      "0x" + repeatStr("4", 64),
		Mode:               "live",
	})
	require.NoError(t, err)

	var status string
	var trialEndsAt, periodStart, periodEnd, nextCharge time.Time
	require.NoError(t, s.pool.QueryRow(ctx, `
		SELECT status::text, "trialEndsAt", "currentPeriodStartAt", "currentPeriodEndAt", "nextChargeAt"
		  FROM "Subscription" WHERE "onchainSubscriptionId" = 40`,
	).Scan(&status, &trialEndsAt, &periodStart, &periodEnd, &nextCharge))
	assert.Equal(t, "trialing", status)
	assert.True(t, trialEndsAt.Equal(trialEnd), "trialEndsAt %s", trialEndsAt)
	assert.True(t, periodStart.Equal(block), "currentPeriodStartAt %s", periodStart)
	assert.True(t, periodEnd.Equal(trialEnd), "currentPeriodEndAt %s", periodEnd)
	assert.True(t, nextCharge.Equal(trialEnd), "nextChargeAt %s", nextCharge)

	_, err = s.InsertSubscriptionCharge(ctx, SubscriptionChargedInput{
		OnchainSubscriptionID: subID,
		ChargeAttemptID:       "0x" + repeatStr("e", 64),
		Amount:                "20000000",
		FeeAmount:             "300000",
		NetAmount:             "19700000",
		NextChargeAt:          trialEnd.Add(30 * 24 * time.Hour),
		OnchainTxHash:         "0x" + repeatStr("5", 64),
		BlockNumber:           1200,
		BlockTimestamp:        trialEnd,
		LogIndex:              0,
		Mode:                  "live",
	})
	require.NoError(t, err)
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text FROM "Subscription" WHERE "onchainSubscriptionId" = 40`,
	).Scan(&status))
	assert.Equal(t, "active", status)
}

func TestE2E_SubscriptionCreated_ImmediateFirstChargeIsActive(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_now", "now@x.io", "0x000000000000000000000000000000000000fe12", big.NewInt(411))

	block := time.Now().UTC().Truncate(time.Second)
	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(41),
		MerchantOnchainID:     big.NewInt(411),
		PayerAddress:          "0x000000000000000000000000000000000000aa41",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt:            block,
		BlockTimestamp:     block,
		CurrentPeriodEndAt: block.Add(30 * 24 * time.Hour),
		NextChargeAt:       block,
		OnchainTxHash:      "0x" + repeatStr("6", 64),
		Mode:               "live",
	})
	require.NoError(t, err)

	var status string
	var trialEndsAt *time.Time
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT status::text, "trialEndsAt" FROM "Subscription" WHERE "onchainSubscriptionId" = 41`,
	).Scan(&status, &trialEndsAt))
	assert.Equal(t, "active", status)
	assert.Nil(t, trialEndsAt)
}

func TestE2E_SubscriptionCreated_RequiresBlockTimestamp(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_nots", "nots@x.io", "0x000000000000000000000000000000000000fe13", big.NewInt(412))

	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(42),
		MerchantOnchainID:     big.NewInt(412),
		PayerAddress:          "0x000000000000000000000000000000000000aa42",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt:            time.Now().UTC(),
		CurrentPeriodEndAt: time.Now().Add(30 * 24 * time.Hour).UTC(),
		NextChargeAt:       time.Now().UTC(),
		OnchainTxHash:      "0x" + repeatStr("7", 64),
		Mode:               "live",
	})
	require.Error(t, err)
}

// ===== Unresolvable logs and dead letters =====

func TestE2E_MissingRowsAreUnresolvable(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)

	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(70),
		MerchantOnchainID:     big.NewInt(999),
		PayerAddress:          "0x000000000000000000000000000000000000aa70",
		Currency:              "USDC", Amount: "1", Interval: "monthly", IntervalCount: 1,
		StartAt: now, BlockTimestamp: now, CurrentPeriodEndAt: now, NextChargeAt: now,
		OnchainTxHash: "0x" + repeatStr("a", 64), Mode: "live",
	})
	assert.ErrorIs(t, err, ErrUnresolvable, "SubscriptionCreated for an unlinked merchant")

	_, err = s.InsertSubscriptionCharge(ctx, SubscriptionChargedInput{
		OnchainSubscriptionID: big.NewInt(71),
		ChargeAttemptID:       "0x" + repeatStr("b", 64),
		Amount:                "1", FeeAmount: "0", NetAmount: "1",
		NextChargeAt: now, OnchainTxHash: "0x" + repeatStr("c", 64),
		BlockNumber: 1, BlockTimestamp: now, LogIndex: 0, Mode: "live",
	})
	assert.ErrorIs(t, err, ErrUnresolvable, "charge for an unknown subscription")

	_, err = s.InsertSubscriptionChargeSkip(ctx, SubscriptionChargeSkippedInput{
		OnchainSubscriptionID: big.NewInt(72),
		ChargeAttemptID:       "0x" + repeatStr("d", 64),
		Outcome:               "insufficient_balance",
		IsPaymentFailure:      true,
		BlockTimestamp:        now,
	})
	assert.ErrorIs(t, err, ErrUnresolvable, "skipped charge for an unknown subscription")

	_, err = s.MarkSubscriptionCancelled(ctx, big.NewInt(73), "0x01", "0x"+repeatStr("e", 64), now)
	assert.ErrorIs(t, err, ErrUnresolvable, "cancel for an unknown subscription")

	err = s.LogAgentJobEvent(ctx, big.NewInt(74), "job.funded", nil)
	assert.ErrorIs(t, err, ErrUnresolvable, "agent event for an unknown job")

	err = s.LogFeeAccrued(ctx, big.NewInt(998), "0x01", "1", "0x"+repeatStr("f", 64))
	assert.ErrorIs(t, err, ErrUnresolvable, "fee for an unlinked merchant")
}

func TestE2E_CancellingAnAlreadyCancelledSubscriptionIsNotAnError(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_cx", "cx@x.io", "0x000000000000000000000000000000000000fe20", big.NewInt(420))
	now := time.Now().UTC().Truncate(time.Second)
	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(75),
		MerchantOnchainID:     big.NewInt(420),
		PayerAddress:          "0x000000000000000000000000000000000000aa75",
		Currency:              "USDC", Amount: "1", Interval: "monthly", IntervalCount: 1,
		StartAt: now, BlockTimestamp: now, CurrentPeriodEndAt: now, NextChargeAt: now,
		OnchainTxHash: "0x" + repeatStr("1", 64), Mode: "live",
	})
	require.NoError(t, err)

	rows, err := s.MarkSubscriptionCancelled(ctx, big.NewInt(75), "0x01", "0x"+repeatStr("2", 64), now)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)
	rows, err = s.MarkSubscriptionCancelled(ctx, big.NewInt(75), "0x01", "0x"+repeatStr("2", 64), now)
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}

func TestE2E_SavepointRollsBackOnlyTheFailedStep(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()

	err := s.RunBatch(ctx, func(tx *Store) error {
		failed := tx.Savepoint(ctx, func() error {
			if _, err := tx.db().Exec(ctx, `
				INSERT INTO "Merchant" ("id", "privyUserId", "email", "createdAt", "updatedAt")
				VALUES ('m_rolled', 'did:privy:e2e:rolled', 'rolled@x.io', NOW(), NOW())`); err != nil {
				return err
			}
			return fmt.Errorf("%w: test", ErrUnresolvable)
		})
		require.ErrorIs(t, failed, ErrUnresolvable)
		return tx.Savepoint(ctx, func() error {
			_, err := tx.db().Exec(ctx, `
				INSERT INTO "Merchant" ("id", "privyUserId", "email", "createdAt", "updatedAt")
				VALUES ('m_kept', 'did:privy:e2e:kept', 'kept@x.io', NOW(), NOW())`)
			return err
		})
	})
	require.NoError(t, err)

	var ids []string
	rows, err := s.pool.Query(ctx, `SELECT id FROM "Merchant" ORDER BY id`)
	require.NoError(t, err)
	for rows.Next() {
		var id string
		require.NoError(t, rows.Scan(&id))
		ids = append(ids, id)
	}
	assert.Equal(t, []string{"m_kept"}, ids)
}

func TestE2E_DeadLetters(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	at := time.Now().UTC().Truncate(time.Second)

	letter := func(block uint64, index uint, txByte string) DeadLetter {
		return DeadLetter{
			Environment:     "testnet",
			ContractAddress: "0x0000000000000000000000000000000000000a02",
			TxHash:          "0x" + repeatStr(txByte, 64),
			LogIndex:        index,
			BlockNumber:     block,
			BlockHash:       "0x" + repeatStr("9", 64),
			BlockTimestamp:  at,
			Topics:          []string{"0x" + repeatStr("1", 64)},
			Data:            "0xabcd",
			Reason:          "merchant not linked",
		}
	}

	require.NoError(t, s.InsertDeadLetter(ctx, letter(20, 1, "b")))
	require.NoError(t, s.InsertDeadLetter(ctx, letter(10, 0, "a")))
	require.NoError(t, s.InsertDeadLetter(ctx, letter(10, 0, "a")))

	n, err := s.CountUnresolvedDeadLetters(ctx, "testnet")
	require.NoError(t, err)
	assert.Equal(t, int64(2), n)

	open, err := s.UnresolvedDeadLetters(ctx, "testnet", 10)
	require.NoError(t, err)
	require.Len(t, open, 2)
	assert.Equal(t, uint64(10), open[0].BlockNumber)
	assert.Equal(t, []string{"0x" + repeatStr("1", 64)}, open[0].Topics)
	assert.Equal(t, "0xabcd", open[0].Data)
	assert.True(t, open[0].BlockTimestamp.Equal(at))

	require.NoError(t, s.RecordDeadLetterAttempt(ctx, open[1].ID, "still missing"))
	require.NoError(t, s.ResolveDeadLetter(ctx, open[0].ID))

	n, err = s.CountUnresolvedDeadLetters(ctx, "testnet")
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
	open, err = s.UnresolvedDeadLetters(ctx, "testnet", 10)
	require.NoError(t, err)
	require.Len(t, open, 1)
	assert.Equal(t, 2, open[0].Attempts)
	assert.Equal(t, "still missing", open[0].Reason)
}
