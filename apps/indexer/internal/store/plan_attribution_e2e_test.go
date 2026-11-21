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

func seedPlan(t *testing.T, s *Store, id, merchantID, amount string, createdAt time.Time) {
	t.Helper()
	mustExec(t, s, context.Background(), `
		INSERT INTO "SubscriptionPlan" (id, "merchantId", name, amount, currency, interval, "intervalCount", status, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, 'USDC', 'monthly', 1, 'active', $5, NOW())
	`, id, merchantID, "Plan "+id, amount, createdAt)
}

func seedEnrolment(t *testing.T, s *Store, nonce, merchantID, planID, payer string) {
	t.Helper()
	mustExec(t, s, context.Background(), `
		INSERT INTO "SubscriptionEnrolment" ("intentNonce", "merchantId", "planId", "payerAddress")
		VALUES ($1, $2, $3, $4)
	`, nonce, merchantID, planID, payer)
}

func createdFor(onchainID int64, merchant *big.Int, payer, amount, nonce string) SubscriptionCreatedInput {
	now := time.Now().UTC()
	return SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(onchainID),
		MerchantOnchainID:     merchant,
		PayerAddress:          payer,
		Currency:              "USDC",
		Amount:                amount,
		Interval:              "monthly",
		IntervalCount:         1,
		StartAt:               now,
		BlockTimestamp:        now,
		CurrentPeriodEndAt:    now.Add(30 * 24 * time.Hour),
		NextChargeAt:          now.Add(30 * 24 * time.Hour),
		OnchainTxHash:         "0x" + strings.Repeat("9", 63) + string(rune('0'+onchainID)),
		Mode:                  "live",
		IntentNonce:           nonce,
	}
}

func subscriptionPlan(t *testing.T, s *Store, onchainID int64) (planID, planMatch string) {
	t.Helper()
	require.NoError(t, s.pool.QueryRow(context.Background(), `
		SELECT "planId", COALESCE(metadata->>'planMatch', '') FROM "Subscription" WHERE "onchainSubscriptionId" = $1
	`, onchainID).Scan(&planID, &planMatch))
	return planID, planMatch
}

const payerA = "0x000000000000000000000000000000000000a001"

func TestE2E_PlanAttribution_UsesThePlanTheIntentNonceWasRecordedFor(t *testing.T) {
	s := startTestPostgres(t)
	seedMerchantOnchain(t, s, "m_two", "two@x.io", "0x000000000000000000000000000000000000fa01", big.NewInt(600))
	seedPlan(t, s, "plan_a", "m_two", "2000000", time.Now().Add(-2*time.Hour))
	seedPlan(t, s, "plan_b", "m_two", "2000000", time.Now().Add(-time.Hour))
	nonce := "0x" + strings.Repeat("b", 64)
	seedEnrolment(t, s, nonce, "m_two", "plan_b", payerA)

	_, err := s.UpsertSubscriptionFromOnchain(context.Background(), createdFor(1, big.NewInt(600), payerA, "2000000", nonce))
	require.NoError(t, err)

	planID, match := subscriptionPlan(t, s, 1)
	assert.Equal(t, "plan_b", planID)
	assert.Empty(t, match)
}

func TestE2E_PlanAttribution_IgnoresARecordWhoseTermsDiffer(t *testing.T) {
	s := startTestPostgres(t)
	seedMerchantOnchain(t, s, "m_terms", "terms@x.io", "0x000000000000000000000000000000000000fa02", big.NewInt(601))
	seedPlan(t, s, "plan_cheap", "m_terms", "1000000", time.Now().Add(-2*time.Hour))
	seedPlan(t, s, "plan_two", "m_terms", "2000000", time.Now().Add(-time.Hour))
	nonce := "0x" + strings.Repeat("c", 64)
	seedEnrolment(t, s, nonce, "m_terms", "plan_cheap", payerA)

	_, err := s.UpsertSubscriptionFromOnchain(context.Background(), createdFor(2, big.NewInt(601), payerA, "2000000", nonce))
	require.NoError(t, err)

	planID, _ := subscriptionPlan(t, s, 2)
	assert.Equal(t, "plan_two", planID)
}

func TestE2E_PlanAttribution_WithoutARecordPicksTheOldestMatchAndFlagsIt(t *testing.T) {
	s := startTestPostgres(t)
	seedMerchantOnchain(t, s, "m_amb", "amb@x.io", "0x000000000000000000000000000000000000fa03", big.NewInt(602))
	seedPlan(t, s, "plan_new", "m_amb", "2000000", time.Now().Add(-time.Hour))
	seedPlan(t, s, "plan_old", "m_amb", "2000000", time.Now().Add(-48*time.Hour))

	_, err := s.UpsertSubscriptionFromOnchain(context.Background(), createdFor(3, big.NewInt(602), payerA, "2000000", ""))
	require.NoError(t, err)

	planID, match := subscriptionPlan(t, s, 3)
	assert.Equal(t, "plan_old", planID)
	assert.Equal(t, "ambiguous", match)
}

func TestE2E_PlanAttribution_ASingleMatchIsNotFlagged(t *testing.T) {
	s := startTestPostgres(t)
	seedMerchantOnchain(t, s, "m_one", "one@x.io", "0x000000000000000000000000000000000000fa04", big.NewInt(603))
	seedPlan(t, s, "plan_only", "m_one", "2000000", time.Now().Add(-time.Hour))

	_, err := s.UpsertSubscriptionFromOnchain(context.Background(), createdFor(4, big.NewInt(603), payerA, "2000000", ""))
	require.NoError(t, err)

	planID, match := subscriptionPlan(t, s, 4)
	assert.Equal(t, "plan_only", planID)
	assert.Empty(t, match)
}

func TestE2E_PlanAttribution_ARecordForAnotherMerchantIsIgnored(t *testing.T) {
	s := startTestPostgres(t)
	seedMerchantOnchain(t, s, "m_mine", "mine@x.io", "0x000000000000000000000000000000000000fa05", big.NewInt(604))
	seedMerchantOnchain(t, s, "m_other", "other@x.io", "0x000000000000000000000000000000000000fa06", big.NewInt(605))
	seedPlan(t, s, "plan_mine", "m_mine", "2000000", time.Now().Add(-time.Hour))
	seedPlan(t, s, "plan_other", "m_other", "2000000", time.Now().Add(-time.Hour))
	nonce := "0x" + strings.Repeat("d", 64)
	seedEnrolment(t, s, nonce, "m_other", "plan_other", payerA)

	_, err := s.UpsertSubscriptionFromOnchain(context.Background(), createdFor(5, big.NewInt(604), payerA, "2000000", nonce))
	require.NoError(t, err)

	planID, _ := subscriptionPlan(t, s, 5)
	assert.Equal(t, "plan_mine", planID)
}
