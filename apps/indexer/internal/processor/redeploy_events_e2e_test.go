//go:build e2e

package processor

import (
	"context"
	"encoding/json"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

func TestE2E_Stream_TokensRescuedAlertsTheAdmin(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newAdminRunner(t, c)
	to := "0x00000000000000000000000000000000000000e4"
	by := "0x00000000000000000000000000000000000000e5"
	rescued := func(contract common.Address, block uint64, tx common.Hash) types.Log {
		return eventLog(contract, "TokensRescued(address,address,uint256,address)",
			[]common.Hash{addrTopic(usdcAddr.Hex()), addrTopic(to), addrTopic(by)},
			pack(t, []string{"uint256"}, big.NewInt(2_500_000)), block, 0, tx)
	}
	c.logs = []types.Log{rescued(paymentsAddr, 11, txHash(0x91)), rescued(subsAddr, 12, txHash(0x92))}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	assert.Equal(t, 2, alertCount(t, st, "contract.tokens_rescued"))
	category, merchantID, _, _, metadata := auditRow(t, st, "contract.tokens_rescued")
	assert.Equal(t, "admin", category)
	assert.Nil(t, merchantID)
	assert.Equal(t, strings.ToLower(usdcAddr.Hex()), metadata["token"])
	assert.Equal(t, to, metadata["to"])
	assert.Equal(t, "2500000", metadata["amount"])
	assert.Equal(t, by, metadata["by"])
}

func TestE2E_Stream_FeeIncreaseScheduledAndCancelledAlertOnlyTheAdmin(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newGovernanceRunner(t, c)
	id := int64(7)
	seedMerchant(t, st, "m_fee_up", "0x"+strings.Repeat("0", 63)+"6", &id)
	effectiveAt := uint64(1_790_090_000)
	c.logs = []types.Log{
		eventLog(registryAddr, "MerchantFeeIncreaseScheduled(uint256,uint16,uint64)",
			[]common.Hash{idTopic(7)}, pack(t, []string{"uint16", "uint64"}, uint16(50), effectiveAt), 11, 0, txHash(0x93)),
		eventLog(registryAddr, "MerchantFeeIncreaseCancelled(uint256)",
			[]common.Hash{idTopic(7)}, nil, 12, 0, txHash(0x94)),
	}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	assert.Equal(t, 1, alertCount(t, st, "merchant.fee_increase_scheduled_onchain"))
	assert.Equal(t, 1, alertCount(t, st, "merchant.fee_increase_cancelled_onchain"))
	_, merchantID, _, _, scheduled := auditRow(t, st, "merchant.fee_increase_scheduled_onchain")
	require.NotNil(t, merchantID)
	assert.Equal(t, "m_fee_up", *merchantID)
	assert.EqualValues(t, 50, scheduled["feeBps"])
	assert.EqualValues(t, effectiveAt, scheduled["effectiveAt"])
	// Only payout and ownership changes email the merchant.
	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "MerchantSecurityAlert"`))
}

func TestE2E_Stream_ReinstatedSubscriptionIsActiveAgainAndNotifiesEveryone(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 30}
	r, st := newGovernanceRunner(t, c)
	merchantOnchainID := int64(8)
	seedMerchant(t, st, "m_reinstate", "0x"+strings.Repeat("0", 63)+"7", &merchantOnchainID)
	now := time.Now().UTC()
	_, err := st.UpsertSubscriptionFromOnchain(ctx, store.SubscriptionCreatedInput{
		OnchainSubscriptionID: big.NewInt(21),
		MerchantOnchainID:     big.NewInt(merchantOnchainID),
		PayerAddress:          "0x000000000000000000000000000000000000aa31",
		Currency:              "USDC", Amount: "20000000", Interval: "monthly", IntervalCount: 1,
		StartAt: now, BlockTimestamp: now,
		CurrentPeriodEndAt: now.Add(30 * 24 * time.Hour), NextChargeAt: now.Add(30 * 24 * time.Hour),
		Mode: "live",
	})
	require.NoError(t, err)
	scheduler := "0x00000000000000000000000000000000000000f1"
	safe := "0x00000000000000000000000000000000000000f2"
	c.logs = []types.Log{
		eventLog(subsAddr, "SubscriptionCancelled(uint256,address)",
			[]common.Hash{idTopic(21), addrTopic(scheduler)}, nil, 11, 0, txHash(0x95)),
		eventLog(subsAddr, "SubscriptionReinstated(uint256,address)",
			[]common.Hash{idTopic(21), addrTopic(safe)}, nil, 12, 0, txHash(0x96)),
	}

	require.NoError(t, r.Tick(ctx))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	var status string
	var cancelledAt *time.Time
	require.NoError(t, st.Pool().QueryRow(ctx,
		`SELECT status::text, "cancelledAt" FROM "Subscription" WHERE "onchainSubscriptionId" = 21`).
		Scan(&status, &cancelledAt))
	assert.Equal(t, "active", status)
	assert.Nil(t, cancelledAt)

	assert.Equal(t, 1, alertCount(t, st, "subscription.reinstated_onchain"))
	category, merchantID, _, _, metadata := auditRow(t, st, "subscription.reinstated_onchain")
	assert.Equal(t, "subscription", category)
	require.NotNil(t, merchantID)
	assert.Equal(t, "m_reinstate", *merchantID)
	assert.Equal(t, safe, metadata["by"])

	var payload []byte
	require.NoError(t, st.Pool().QueryRow(ctx,
		`SELECT payload FROM "WebhookEvent" WHERE type = 'subscription_reactivated' AND "merchantId" = 'm_reinstate'`).
		Scan(&payload))
	var ref struct {
		Ref struct {
			Kind           string `json:"kind"`
			SubscriptionID string `json:"subscriptionId"`
		} `json:"ref"`
	}
	require.NoError(t, json.Unmarshal(payload, &ref))
	assert.Equal(t, "subscription.reactivated", ref.Ref.Kind)
	assert.NotEmpty(t, ref.Ref.SubscriptionID)
	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "WebhookEvent" WHERE type = 'subscription_reactivated'`))
}
