//go:build e2e

package store

import (
	"context"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	cancelPayer = "0x000000000000000000000000000000000000c0a1"
	cancelOwner = "0x000000000000000000000000000000000000c0b2"
)

func seedCancellableSubscription(t *testing.T, s *Store, merchantID string, merchantOnchain, subOnchain int64) {
	t.Helper()
	seedMerchantOnchain(t, s, merchantID, merchantID+"@x.io", "0x000000000000000000000000000000000000c0c3", big.NewInt(merchantOnchain))
	mustExec(t, s, context.Background(), `UPDATE "Merchant" SET "walletAddress" = $2 WHERE id = $1`, merchantID, cancelOwner)
	now := time.Now().UTC()
	_, err := s.UpsertSubscriptionFromOnchain(context.Background(), SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(subOnchain),
		MerchantOnchainID:     big.NewInt(merchantOnchain),
		PayerAddress:          cancelPayer,
		Currency:              "USDC",
		Amount:                "2000000",
		Interval:              "monthly",
		IntervalCount:         1,
		StartAt:               now,
		BlockTimestamp:        now,
		CurrentPeriodEndAt:    now.Add(30 * 24 * time.Hour),
		NextChargeAt:          now.Add(30 * 24 * time.Hour),
		OnchainTxHash:         "0x" + strings.Repeat("e", 62) + "0" + string(rune('0'+subOnchain%10)),
		Mode:                  "live",
	})
	require.NoError(t, err)
}

func cancelState(t *testing.T, s *Store, subOnchain int64) (status, cancelledBy string, events int) {
	t.Helper()
	ctx := context.Background()
	require.NoError(t, s.pool.QueryRow(ctx, `
		SELECT status::text, COALESCE("cancelledBy"::text, '') FROM "Subscription" WHERE "onchainSubscriptionId" = $1
	`, subOnchain).Scan(&status, &cancelledBy))
	require.NoError(t, s.pool.QueryRow(ctx, `
		SELECT count(*) FROM "WebhookEvent" e
		  JOIN "Subscription" s ON e.payload->'ref'->>'subscriptionId' = s.id
		 WHERE e.type = 'subscription_cancelled'::"WebhookEventName"
		   AND e.payload->'ref'->>'kind' = 'subscription.cancelled'
		   AND s."onchainSubscriptionId" = $1
	`, subOnchain).Scan(&events))
	return status, cancelledBy, events
}

func TestE2E_SubscriptionCancel_ByThePayerRecordsItAndSendsOneWebhook(t *testing.T) {
	s := startTestPostgres(t)
	seedCancellableSubscription(t, s, "m_pc", 700, 70)
	at := time.Now().UTC()

	rows, err := s.MarkSubscriptionCancelled(context.Background(), big.NewInt(70), cancelPayer, "0x"+strings.Repeat("1", 64), at)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)
	_, err = s.MarkSubscriptionCancelled(context.Background(), big.NewInt(70), cancelPayer, "0x"+strings.Repeat("1", 64), at)
	require.NoError(t, err)

	status, by, events := cancelState(t, s, 70)
	assert.Equal(t, "cancelled", status)
	assert.Equal(t, "payer", by)
	assert.Equal(t, 1, events)
}

func TestE2E_SubscriptionCancel_ByTheMerchantOwnerIsAMerchantCancel(t *testing.T) {
	s := startTestPostgres(t)
	seedCancellableSubscription(t, s, "m_oc", 701, 71)

	_, err := s.MarkSubscriptionCancelled(context.Background(), big.NewInt(71), cancelOwner, "0x"+strings.Repeat("2", 64), time.Now().UTC())
	require.NoError(t, err)

	_, by, events := cancelState(t, s, 71)
	assert.Equal(t, "merchant", by)
	assert.Equal(t, 1, events)
}

func TestE2E_SubscriptionCancel_ByAnyoneElseIsAStrimzCancel(t *testing.T) {
	s := startTestPostgres(t)
	seedCancellableSubscription(t, s, "m_sc", 702, 72)

	_, err := s.MarkSubscriptionCancelled(context.Background(), big.NewInt(72), "0x000000000000000000000000000000000000dead", "0x"+strings.Repeat("3", 64), time.Now().UTC())
	require.NoError(t, err)

	_, by, events := cancelState(t, s, 72)
	assert.Equal(t, "strimz", by)
	assert.Equal(t, 1, events)
}

func TestE2E_SubscriptionCancel_AlreadyCancelledByTheAPISendsNothingMore(t *testing.T) {
	s := startTestPostgres(t)
	seedCancellableSubscription(t, s, "m_api", 703, 73)
	mustExec(t, s, context.Background(), `
		UPDATE "Subscription" SET status = 'cancelled', "cancelledAt" = NOW(), "cancelledBy" = 'merchant'
		 WHERE "onchainSubscriptionId" = 73`)

	rows, err := s.MarkSubscriptionCancelled(context.Background(), big.NewInt(73), "0x000000000000000000000000000000000000dead", "0x"+strings.Repeat("4", 64), time.Now().UTC())
	require.NoError(t, err)
	assert.Equal(t, int64(0), rows)

	_, by, events := cancelState(t, s, 73)
	assert.Equal(t, "merchant", by)
	assert.Equal(t, 0, events)
}
