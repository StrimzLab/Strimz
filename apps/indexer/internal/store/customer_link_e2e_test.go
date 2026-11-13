//go:build e2e

package store

import (
	"context"
	"database/sql"
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ADR-2026-11-13-transaction-customer-link: a transaction carries its customer.

func txCustomer(t *testing.T, s *Store, kind string) sql.NullString {
	t.Helper()
	var c sql.NullString
	require.NoError(t, s.pool.QueryRow(context.Background(),
		`SELECT "customerId" FROM "Transaction" WHERE kind = $1::"TransactionKind"`, kind).Scan(&c))
	return c
}

func oneShot(sessionRef string) OneShotTxInput {
	return OneShotTxInput{
		MerchantOnchainID: big.NewInt(310),
		PayerAddress:      "0x000000000000000000000000000000000000bbbb",
		Amount:            "100000",
		FeeAmount:         "1500",
		NetAmount:         "98500",
		Currency:          "USDC",
		SessionRef:        sessionRef,
		OnchainTxHash:     "0x" + repeatStr("e", 64),
		BlockNumber:       1000,
		BlockTimestamp:    time.Now().UTC(),
		LogIndex:          0,
		Mode:              "live",
	}
}

func TestE2E_OneShotTransaction_TakesTheSessionCustomer(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_cl", "cl@x.io", "0x000000000000000000000000000000000000d00d", big.NewInt(310))
	mustExec(t, s, ctx, `INSERT INTO "Customer" (id, "merchantId", "walletAddress") VALUES ('cus_1', 'm_cl', '0x000000000000000000000000000000000000bbbb')`)
	seedPaymentSession(t, s, "sess_cl", "m_cl", "100000", "USDC", "live")
	mustExec(t, s, ctx, `UPDATE "PaymentSession" SET "customerId" = 'cus_1' WHERE id = 'sess_cl'`)

	_, err := s.InsertOneShotTransaction(ctx, oneShot("sess_cl"))
	require.NoError(t, err)

	assert.Equal(t, sql.NullString{String: "cus_1", Valid: true}, txCustomer(t, s, "one_shot"))
}

func TestE2E_OneShotTransaction_StaysUnlinkedWithoutACustomer(t *testing.T) {
	s := startTestPostgres(t)
	seedMerchantOnchain(t, s, "m_cl", "cl@x.io", "0x000000000000000000000000000000000000d00d", big.NewInt(310))
	seedPaymentSession(t, s, "sess_cl", "m_cl", "100000", "USDC", "live")

	_, err := s.InsertOneShotTransaction(context.Background(), oneShot("sess_cl"))
	require.NoError(t, err)

	assert.False(t, txCustomer(t, s, "one_shot").Valid)
}

func TestE2E_SubscriptionChargeTransaction_TakesTheSubscriptionCustomer(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_cls", "cls@x.io", "0x000000000000000000000000000000000000fefe", big.NewInt(410))
	_, err := s.UpsertSubscriptionFromOnchain(ctx, SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(41),
		MerchantOnchainID:     big.NewInt(410),
		PayerAddress:          "0x000000000000000000000000000000000000aa41",
		Currency:              "USDC",
		Amount:                "20000000",
		Interval:              "monthly",
		IntervalCount:         1,
		StartAt:               time.Now().UTC(),
		BlockTimestamp:        time.Now().UTC(),
		CurrentPeriodEndAt:    time.Now().Add(30 * 24 * time.Hour).UTC(),
		NextChargeAt:          time.Now().UTC(),
		OnchainTxHash:         "0x" + repeatStr("4", 64),
		Mode:                  "live",
	})
	require.NoError(t, err)

	_, err = s.InsertSubscriptionCharge(ctx, SubscriptionChargedInput{
		OnchainSubscriptionID: big.NewInt(41),
		ChargeAttemptID:       "0x" + repeatStr("5", 64),
		Amount:                "20000000",
		FeeAmount:             "0",
		NetAmount:             "20000000",
		NextChargeAt:          time.Now().Add(30 * 24 * time.Hour).UTC(),
		OnchainTxHash:         "0x" + repeatStr("6", 64),
		BlockNumber:           1200,
		BlockTimestamp:        time.Now().UTC(),
		LogIndex:              0,
		Mode:                  "live",
	})
	require.NoError(t, err)

	var subCustomer string
	require.NoError(t, s.pool.QueryRow(ctx,
		`SELECT "customerId" FROM "Subscription" WHERE "onchainSubscriptionId" = 41`).Scan(&subCustomer))
	assert.Equal(t, sql.NullString{String: subCustomer, Valid: true}, txCustomer(t, s, "subscription_charge"))
}
