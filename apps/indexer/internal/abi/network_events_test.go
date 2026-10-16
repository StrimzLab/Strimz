package abi

import (
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var newlyIndexedSignatures = []string{
	"MerchantPayoutChangeInitiated(uint256,address,uint64)",
	"MerchantPayoutChangeCancelled(uint256)",
	"MerchantMaxFeeBpsLowered(uint256,uint16)",
	"MerchantOwnershipTransferInitiated(uint256,address,address)",
	"MerchantOwnershipTransferAccepted(uint256,address,address)",
	"MerchantOwnershipTransferCancelled(uint256)",
	"Paused(address)",
	"Unpaused(address)",
	"DependencyUpdated(string,address)",
	"FeeWithdrawn(address,address,uint256)",
	"TokenAdded(address)",
	"TokenRemoved(address)",
	"TokenCapabilitiesSet(address,uint8)",
}

func containsTopic(topics []common.Hash, topic common.Hash) bool {
	for _, t := range topics {
		if t == topic {
			return true
		}
	}
	return false
}

func TestLoad_EmbedsTheTokenWhitelistABI(t *testing.T) {
	r := MustLoad()
	_, ok := r.abis["TokenWhitelist"]
	assert.True(t, ok, "TokenWhitelist ABI is not embedded")
}

func TestSubscribedTopics_IncludesEveryEventTheContractsEmit(t *testing.T) {
	subscribed := MustLoad().SubscribedTopics()
	for _, sig := range newlyIndexedSignatures {
		assert.True(t, containsTopic(subscribed, crypto.Keccak256Hash([]byte(sig))), "%s is not subscribed", sig)
	}
}

func TestSubscribedTopics_ExcludesTheLegacyOwnerTransferredEvent(t *testing.T) {
	subscribed := MustLoad().SubscribedTopics()
	legacy := crypto.Keccak256Hash([]byte("MerchantOwnerTransferred(uint256,address)"))
	assert.False(t, containsTopic(subscribed, legacy))
}

func TestDecode_MaterialisesEveryNewlyIndexedEvent(t *testing.T) {
	r := MustLoad()
	for _, sig := range newlyIndexedSignatures {
		t.Run(sig, func(t *testing.T) {
			topic := crypto.Keccak256Hash([]byte(sig))
			bound, ok := r.byTopic[topic]
			require.True(t, ok, "no ABI declares %s", sig)
			topics := []common.Hash{topic}
			for _, arg := range bound.event.Inputs {
				if arg.Indexed {
					topics = append(topics, common.BigToHash(common.Big1))
				}
			}
			var nonIndexed []any
			for _, arg := range bound.event.Inputs {
				if arg.Indexed {
					continue
				}
				switch arg.Type.String() {
				case "address":
					nonIndexed = append(nonIndexed, common.HexToAddress("0x01"))
				case "string":
					nonIndexed = append(nonIndexed, "registry")
				case "uint8":
					nonIndexed = append(nonIndexed, uint8(1))
				case "uint16":
					nonIndexed = append(nonIndexed, uint16(1))
				case "uint64":
					nonIndexed = append(nonIndexed, uint64(1))
				default:
					nonIndexed = append(nonIndexed, common.Big1)
				}
			}
			data, err := bound.event.Inputs.NonIndexed().Pack(nonIndexed...)
			require.NoError(t, err)
			name, payload, err := r.Decode(types.Log{Topics: topics, Data: data})
			require.NoError(t, err)
			assert.Equal(t, bound.event.Name, string(name))
			assert.NotNil(t, payload)
		})
	}
}
