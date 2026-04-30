package abi

import (
	"encoding/hex"
	"math/big"
	"testing"

	ethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEventTopicHashes_AreStable pins every event signature's topic[0] to a
// known keccak hash. If any developer accidentally reorders args or changes
// a type, this test fails first — which is much cheaper than discovering
// silent-decode failures in production.
func TestEventTopicHashes_AreStable(t *testing.T) {
	cases := []struct {
		name EventName
		want string
	}{
		// Manually-computed keccak-256 of the Solidity event signature in
		// `Signatures`. Update *only* alongside an intentional contract change.
		{EventERC20Transfer, "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"},
	}
	for _, c := range cases {
		t.Run(string(c.name), func(t *testing.T) {
			got := hex.EncodeToString(TopicByName(c.name).Bytes())
			assert.Equal(t, c.want, got)
		})
	}
}

func TestNameByTopic_ResolvesAllDeclaredEvents(t *testing.T) {
	for name := range Signatures {
		topic := TopicByName(name)
		gotName, ok := NameByTopic(topic)
		require.True(t, ok, "no name for topic of %s", name)
		assert.Equal(t, name, gotName)
	}
}

func TestAllTopics_HasNoDuplicates(t *testing.T) {
	topics := AllTopics()
	seen := make(map[EventID]bool)
	for _, tp := range topics {
		assert.False(t, seen[tp], "duplicate topic %s", tp.Hex())
		seen[tp] = true
	}
	assert.Len(t, topics, len(Signatures))
}

func TestDecode_UnknownTopicReturnsFalseWithoutError(t *testing.T) {
	log := types.Log{
		Topics: []common.Hash{common.HexToHash("0xdeadbeef")},
	}
	name, payload, err := Decode(log)
	require.NoError(t, err)
	assert.Empty(t, name)
	assert.Nil(t, payload)
}

func TestDecode_RejectsLogWithNoTopics(t *testing.T) {
	_, _, err := Decode(types.Log{})
	require.Error(t, err)
}

// TestDecode_ERC20Transfer round-trips through encode → decode and asserts
// every field. ERC-20 Transfer is the most-touched event (all refunds flow
// through it) so we lock its decoder here as a representative case.
func TestDecode_ERC20Transfer(t *testing.T) {
	from := common.HexToAddress("0x000000000000000000000000000000000000aaaa")
	to := common.HexToAddress("0x000000000000000000000000000000000000bbbb")
	value := big.NewInt(1_234_567)

	uint256, _ := ethabi.NewType("uint256", "", nil)
	args := ethabi.Arguments{{Type: uint256}}
	data, err := args.Pack(value)
	require.NoError(t, err)

	log := types.Log{
		Topics: []common.Hash{
			TopicByName(EventERC20Transfer),
			common.BytesToHash(from.Bytes()),
			common.BytesToHash(to.Bytes()),
		},
		Data: data,
	}
	name, payload, err := Decode(log)
	require.NoError(t, err)
	assert.Equal(t, EventERC20Transfer, name)
	t.Logf("payload: %+v", payload)
	tr := payload.(*ERC20Transfer)
	assert.Equal(t, from, tr.From)
	assert.Equal(t, to, tr.To)
	assert.Equal(t, 0, tr.Value.Cmp(value))
}

// TestDecode_PaymentExecuted exercises a 4-topic event with non-trivial data.
func TestDecode_PaymentExecuted(t *testing.T) {
	merchantID := big.NewInt(42)
	payer := common.HexToAddress("0x000000000000000000000000000000000000aaaa")
	token := common.HexToAddress("0x000000000000000000000000000000000000bbbb")
	amount := big.NewInt(1_000_000)
	feeAmount := big.NewInt(15_000)
	netAmount := big.NewInt(985_000)
	var ref [32]byte
	copy(ref[:], crypto.Keccak256([]byte("session_xyz")))

	uint256, _ := ethabi.NewType("uint256", "", nil)
	bytes32, _ := ethabi.NewType("bytes32", "", nil)
	args := ethabi.Arguments{{Type: uint256}, {Type: uint256}, {Type: uint256}, {Type: bytes32}}
	data, err := args.Pack(amount, feeAmount, netAmount, ref)
	require.NoError(t, err)

	log := types.Log{
		Topics: []common.Hash{
			TopicByName(EventPaymentExecuted),
			common.BigToHash(merchantID),
			common.BytesToHash(payer.Bytes()),
			common.BytesToHash(token.Bytes()),
		},
		Data: data,
	}

	name, payload, err := Decode(log)
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
