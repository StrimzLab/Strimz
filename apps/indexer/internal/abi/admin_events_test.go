package abi

import (
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var adminEventSignatures = []string{
	"RoleGranted(bytes32,address,address)",
	"RoleRevoked(bytes32,address,address)",
	"RoleAdminChanged(bytes32,bytes32,bytes32)",
	"Upgraded(address)",
	"CallScheduled(bytes32,uint256,address,uint256,bytes,bytes32,uint256)",
	"CallExecuted(bytes32,uint256,address,uint256,bytes)",
	"Cancelled(bytes32)",
	"MinDelayChange(uint256,uint256)",
	"AgentRegistered(address,address,bytes32,string,string)",
	"AgentCredentialRotated(address,bytes32)",
	"AgentReputationAdjusted(address,int256,int256)",
	"AgentDeactivated(address)",
	"AgentActivated(address)",
}

func TestLoad_EmbedsTheAgentRegistryAndTimelockABIs(t *testing.T) {
	r := MustLoad()
	for _, name := range []string{"StrimzAgentRegistry", "TimelockController"} {
		_, ok := r.abis[name]
		assert.True(t, ok, "%s ABI is not embedded", name)
	}
}

func TestSubscribedTopics_IncludesRoleUpgradeTimelockAndAgentRegistryEvents(t *testing.T) {
	subscribed := MustLoad().SubscribedTopics()
	for _, sig := range adminEventSignatures {
		assert.True(t, containsTopic(subscribed, crypto.Keccak256Hash([]byte(sig))), "%s is not subscribed", sig)
	}
}

func TestDecode_MaterialisesEveryAdminEvent(t *testing.T) {
	r := MustLoad()
	for _, sig := range adminEventSignatures {
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
					nonIndexed = append(nonIndexed, "strimz-agent")
				case "bytes32":
					nonIndexed = append(nonIndexed, [32]byte{1})
				case "bytes":
					nonIndexed = append(nonIndexed, []byte{0xab, 0xcd})
				case "int256":
					nonIndexed = append(nonIndexed, big.NewInt(-3))
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

var roleConstant = regexp.MustCompile(`bytes32 public constant (\w+) = keccak256\("([^"]+)"\)`)

func TestRoleName_MatchesEveryRoleConstantInTheContracts(t *testing.T) {
	sources := []string{
		"../../../../packages/contracts/src/access/StrimzAccessControl.sol",
		"../../../../packages/contracts/src/agent/StrimzAgentEscrow.sol",
		"../../../../packages/contracts/lib/openzeppelin-contracts/contracts/governance/TimelockController.sol",
	}
	found := 0
	for _, path := range sources {
		src, err := os.ReadFile(filepath.Clean(path))
		require.NoError(t, err, path)
		for _, m := range roleConstant.FindAllStringSubmatch(string(src), -1) {
			found++
			hash := crypto.Keccak256Hash([]byte(m[2]))
			assert.Equal(t, m[1], RoleName(hash), "%s in %s", m[1], path)
		}
	}
	assert.Equal(t, 14, found, "role constants found in the contract sources")
	assert.Equal(t, "DEFAULT_ADMIN_ROLE", RoleName(common.Hash{}))
}

func TestRoleName_KeepsAnUnknownRoleAsItsHash(t *testing.T) {
	unknown := crypto.Keccak256Hash([]byte("SOMETHING_NEW"))
	assert.Equal(t, unknown.Hex(), RoleName(unknown))
}
