package abi

import (
	"math/big"
	"testing"

	ethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad_ParsesAllEmbeddedABIs(t *testing.T) {
	r, err := Load()
	require.NoError(t, err)
	for _, contract := range []string{
		"StrimzRegistry", "StrimzPayments", "StrimzSubscriptions",
		"StrimzAgentEscrow", "FeeCollector", "IERC20",
	} {
		_, ok := r.abis[contract]
		assert.True(t, ok, "missing ABI for %s", contract)
	}
}

func TestSubscribedTopics_ContainsEverySubscribedEvent(t *testing.T) {
	r := MustLoad()
	subscribed := r.SubscribedTopics()
	assert.GreaterOrEqual(t, len(subscribed), len(SubscribedEvents)-1) // ≤ for ERC-20 dedup
	for _, name := range SubscribedEvents {
		topic, ok := r.TopicByName(name)
		require.True(t, ok, "topic missing for %s", name)
		found := false
		for _, t := range subscribed {
			if t == topic {
				found = true
				break
			}
		}
		assert.True(t, found, "%s topic not in SubscribedTopics", name)
	}
}

func TestDecode_UnknownTopicSkippedSilently(t *testing.T) {
	r := MustLoad()
	name, payload, err := r.Decode(types.Log{
		Topics: []common.Hash{common.HexToHash("0xdeadbeef")},
	})
	require.NoError(t, err)
	assert.Empty(t, name)
	assert.Nil(t, payload)
}

func TestDecode_RejectsLogWithNoTopics(t *testing.T) {
	r := MustLoad()
	_, _, err := r.Decode(types.Log{})
	require.Error(t, err)
}

// ----- round-trip tests for representative events -----

func TestDecode_ERC20Transfer(t *testing.T) {
	r := MustLoad()
	from := common.HexToAddress("0x000000000000000000000000000000000000aaaa")
	to := common.HexToAddress("0x000000000000000000000000000000000000bbbb")
	value := big.NewInt(1_234_567)
	topic, ok := r.TopicByName(EventERC20Transfer)
	require.True(t, ok)

	uint256, _ := ethabi.NewType("uint256", "", nil)
	args := ethabi.Arguments{{Type: uint256, Name: "value"}}
	data, err := args.Pack(value)
	require.NoError(t, err)

	log := types.Log{
		Topics: []common.Hash{
			topic,
			common.BytesToHash(from.Bytes()),
			common.BytesToHash(to.Bytes()),
		},
		Data: data,
	}
	name, payload, err := r.Decode(log)
	require.NoError(t, err)
	assert.Equal(t, EventERC20Transfer, name)
	tr := payload.(*ERC20Transfer)
	assert.Equal(t, from, tr.From)
	assert.Equal(t, to, tr.To)
	assert.Equal(t, 0, tr.Value.Cmp(value))
}

func TestDecode_PaymentExecuted(t *testing.T) {
	r := MustLoad()
	merchantID := big.NewInt(42)
	payer := common.HexToAddress("0x000000000000000000000000000000000000aaaa")
	token := common.HexToAddress("0x000000000000000000000000000000000000bbbb")
	amount := big.NewInt(1_000_000)
	feeAmount := big.NewInt(15_000)
	netAmount := big.NewInt(985_000)
	var ref [32]byte
	copy(ref[:], "session_123")

	topic, ok := r.TopicByName(EventPaymentExecuted)
	require.True(t, ok)

	uint256, _ := ethabi.NewType("uint256", "", nil)
	bytes32, _ := ethabi.NewType("bytes32", "", nil)
	args := ethabi.Arguments{
		{Type: uint256, Name: "amount"},
		{Type: uint256, Name: "feeAmount"},
		{Type: uint256, Name: "netAmount"},
		{Type: bytes32, Name: "ref"},
	}
	data, err := args.Pack(amount, feeAmount, netAmount, ref)
	require.NoError(t, err)

	log := types.Log{
		Topics: []common.Hash{
			topic,
			common.BigToHash(merchantID),
			common.BytesToHash(payer.Bytes()),
			common.BytesToHash(token.Bytes()),
		},
		Data: data,
	}

	name, payload, err := r.Decode(log)
	require.NoError(t, err)
	assert.Equal(t, EventPaymentExecuted, name)
	pe := payload.(*PaymentExecuted)
	assert.Equal(t, 0, pe.MerchantID.Cmp(merchantID))
	assert.Equal(t, payer, pe.Payer)
	assert.Equal(t, token, pe.Token)
	assert.Equal(t, 0, pe.Amount.Cmp(amount))
	assert.Equal(t, 0, pe.FeeAmount.Cmp(feeAmount))
	assert.Equal(t, 0, pe.NetAmount.Cmp(netAmount))
	assert.Equal(t, ref, pe.Ref)
}

func TestDecode_SubscriptionCharged(t *testing.T) {
	r := MustLoad()
	subID := big.NewInt(7)
	var attempt [32]byte
	copy(attempt[:], "attempt-bytes")
	amount := big.NewInt(2_000_000)
	feeAmount := big.NewInt(30_000)
	netAmount := big.NewInt(1_970_000)
	nextCharge := uint64(1_700_000_000)

	topic, ok := r.TopicByName(EventSubscriptionCharged)
	require.True(t, ok)

	uint256, _ := ethabi.NewType("uint256", "", nil)
	uint64Type, _ := ethabi.NewType("uint64", "", nil)
	args := ethabi.Arguments{
		{Type: uint256, Name: "amount"},
		{Type: uint256, Name: "feeAmount"},
		{Type: uint256, Name: "netAmount"},
		{Type: uint64Type, Name: "nextChargeAt"},
	}
	data, err := args.Pack(amount, feeAmount, netAmount, nextCharge)
	require.NoError(t, err)

	log := types.Log{
		Topics: []common.Hash{
			topic,
			common.BigToHash(subID),
			common.BytesToHash(attempt[:]),
		},
		Data: data,
	}
	name, payload, err := r.Decode(log)
	require.NoError(t, err)
	assert.Equal(t, EventSubscriptionCharged, name)
	sc := payload.(*SubscriptionCharged)
	assert.Equal(t, 0, sc.SubscriptionID.Cmp(subID))
	assert.Equal(t, attempt, sc.ChargeAttemptID)
	assert.Equal(t, 0, sc.Amount.Cmp(amount))
	assert.Equal(t, nextCharge, sc.NextChargeAt)
}

func TestDecode_JobCreated(t *testing.T) {
	r := MustLoad()
	jobID := big.NewInt(1)
	client := common.HexToAddress("0x000000000000000000000000000000000000c1c1")
	vendor := common.HexToAddress("0x000000000000000000000000000000000000d2d2")
	token := common.HexToAddress("0x000000000000000000000000000000000000e3e3")
	amount := big.NewInt(50_000_000)

	topic, ok := r.TopicByName(EventJobCreated)
	require.True(t, ok)

	uint256, _ := ethabi.NewType("uint256", "", nil)
	addrType, _ := ethabi.NewType("address", "", nil)
	args := ethabi.Arguments{
		{Type: addrType, Name: "token"},
		{Type: uint256, Name: "amount"},
	}
	data, err := args.Pack(token, amount)
	require.NoError(t, err)

	log := types.Log{
		Topics: []common.Hash{
			topic,
			common.BigToHash(jobID),
			common.BytesToHash(client.Bytes()),
			common.BytesToHash(vendor.Bytes()),
		},
		Data: data,
	}
	name, payload, err := r.Decode(log)
	require.NoError(t, err)
	assert.Equal(t, EventJobCreated, name)
	jc := payload.(*JobCreated)
	assert.Equal(t, 0, jc.JobID.Cmp(jobID))
	assert.Equal(t, client, jc.Client)
	assert.Equal(t, vendor, jc.Vendor)
	assert.Equal(t, token, jc.Token)
	assert.Equal(t, 0, jc.Amount.Cmp(amount))
}

func TestChargeOutcome_DBStringMap(t *testing.T) {
	cases := map[ChargeOutcome]string{
		ChargeOutcomeCharged:           "charged",
		ChargeOutcomeInsufficientFunds: "insufficient_funds",
		ChargeOutcomeRevokedApproval:   "revoked_approval",
		ChargeOutcomeCancelled:         "cancelled",
		ChargeOutcomeNotDue:            "skipped",
		ChargeOutcomeNone:              "skipped", // defensive default
	}
	for outcome, want := range cases {
		assert.Equal(t, want, outcome.DBString(), "outcome %d", outcome)
	}
}
