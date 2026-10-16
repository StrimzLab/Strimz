//go:build e2e

package processor

import (
	"context"
	"math/big"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

var (
	agentRegistryAddr = common.HexToAddress("0x0000000000000000000000000000000000000b07")
	timelockAddr      = common.HexToAddress("0x0000000000000000000000000000000000000b08")
)

func newAdminRunner(t *testing.T, c *rangeChain) (*Runner, *store.Store) {
	t.Helper()
	r, st := newGovernanceRunner(t, c)
	r.contractAddrs = append(r.contractAddrs, agentRegistryAddr, timelockAddr)
	r.projector = r.projector.WithContractNames(map[string]string{
		strings.ToLower(registryAddr.Hex()):      "StrimzRegistry",
		strings.ToLower(paymentsAddr.Hex()):      "StrimzPayments",
		strings.ToLower(subsAddr.Hex()):          "StrimzSubscriptions",
		strings.ToLower(escrowAddr.Hex()):        "StrimzAgentEscrow",
		strings.ToLower(feesAddr.Hex()):          "FeeCollector",
		strings.ToLower(whitelistAddr.Hex()):     "TokenWhitelist",
		strings.ToLower(agentRegistryAddr.Hex()): "StrimzAgentRegistry",
		strings.ToLower(timelockAddr.Hex()):      "TimelockController",
	})
	return r, st
}

func roleTopic(name string) common.Hash { return crypto.Keccak256Hash([]byte(name)) }

func alertCount(t *testing.T, st *store.Store, action string) int {
	t.Helper()
	return countRows(t, st, `
		SELECT count(*) FROM "ContractAlert" a JOIN "AuditLog" l ON l.id = a."auditLogId"
		 WHERE l.action = $1 AND a."alertedAt" IS NULL AND a."chainId" = $2`, action, arcTestnetChainID)
}

func TestE2E_Runner_WatchesTheAgentRegistryTimelockAndAdminEvents(t *testing.T) {
	c := &rangeChain{head: 31}
	r, _ := bootRunnerOnFakeChain(t, c)

	require.NoError(t, r.Tick(context.Background()))

	core := coreStreamCall(t, c)
	assert.Contains(t, core.Addresses, agentRegistryAddr)
	assert.Contains(t, core.Addresses, timelockAddr)
	require.Len(t, core.Topics, 1)
	for _, sig := range []string{
		"RoleGranted(bytes32,address,address)",
		"RoleRevoked(bytes32,address,address)",
		"RoleAdminChanged(bytes32,bytes32,bytes32)",
		"Upgraded(address)",
		"CallScheduled(bytes32,uint256,address,uint256,bytes,bytes32,uint256)",
		"CallExecuted(bytes32,uint256,address,uint256,bytes)",
		"Cancelled(bytes32)",
		"MinDelayChange(uint256,uint256)",
		"AgentRegistered(address,address,bytes32,string,string)",
		"AgentActivated(address)",
	} {
		assert.Contains(t, core.Topics[0], crypto.Keccak256Hash([]byte(sig)), sig)
	}
}

func TestE2E_Stream_RecordsAndQueuesAlertsForRoleUpgradeTimelockAndPauseEvents(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newAdminRunner(t, c)
	safe := "0x00000000000000000000000000000000000000f1"
	attacker := "0x00000000000000000000000000000000000000f2"
	newImpl := "0x00000000000000000000000000000000000000f3"
	operationID := common.HexToHash("0x" + strings.Repeat("ab", 32))
	c.logs = []types.Log{
		eventLog(registryAddr, "RoleGranted(bytes32,address,address)",
			[]common.Hash{roleTopic("STRIMZ_FEE_MANAGER_ROLE"), addrTopic(attacker), addrTopic(safe)}, nil, 11, 0, txHash(0xb1)),
		eventLog(feesAddr, "RoleRevoked(bytes32,address,address)",
			[]common.Hash{roleTopic("STRIMZ_TREASURY_ROLE"), addrTopic(safe), addrTopic(safe)}, nil, 12, 0, txHash(0xb2)),
		eventLog(subsAddr, "RoleAdminChanged(bytes32,bytes32,bytes32)",
			[]common.Hash{roleTopic("STRIMZ_CHARGER_ROLE"), {}, roleTopic("STRIMZ_ADMIN_ROLE")}, nil, 13, 0, txHash(0xb3)),
		eventLog(whitelistAddr, "Upgraded(address)", []common.Hash{addrTopic(newImpl)}, nil, 14, 0, txHash(0xb4)),
		eventLog(timelockAddr, "CallScheduled(bytes32,uint256,address,uint256,bytes,bytes32,uint256)",
			[]common.Hash{operationID, idTopic(0)},
			pack(t, []string{"address", "uint256", "bytes", "bytes32", "uint256"},
				registryAddr, big.NewInt(0), []byte{0x3f, 0x4b, 0xa8, 0x3a}, [32]byte{}, big.NewInt(300)), 15, 0, txHash(0xb5)),
		eventLog(timelockAddr, "CallExecuted(bytes32,uint256,address,uint256,bytes)",
			[]common.Hash{operationID, idTopic(0)},
			pack(t, []string{"address", "uint256", "bytes"}, registryAddr, big.NewInt(0), []byte{0x3f, 0x4b, 0xa8, 0x3a}), 16, 0, txHash(0xb6)),
		eventLog(timelockAddr, "Cancelled(bytes32)", []common.Hash{operationID}, nil, 17, 0, txHash(0xb7)),
		eventLog(timelockAddr, "MinDelayChange(uint256,uint256)", nil,
			pack(t, []string{"uint256", "uint256"}, big.NewInt(300), big.NewInt(60)), 18, 0, txHash(0xb8)),
		eventLog(escrowAddr, "Paused(address)", nil, pack(t, []string{"address"}, common.HexToAddress(safe)), 19, 0, txHash(0xb9)),
	}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	expected := map[string]common.Address{
		"contract.role_granted":       registryAddr,
		"contract.role_revoked":       feesAddr,
		"contract.role_admin_changed": subsAddr,
		"contract.upgraded":           whitelistAddr,
		"timelock.call_scheduled":     timelockAddr,
		"timelock.call_executed":      timelockAddr,
		"timelock.cancelled":          timelockAddr,
		"timelock.min_delay_changed":  timelockAddr,
		"contract.paused":             escrowAddr,
	}
	for action, contract := range expected {
		category, merchantID, targetType, targetID, metadata := auditRow(t, st, action)
		assert.Equal(t, "admin", category, action)
		assert.Nil(t, merchantID, action)
		assert.Equal(t, "Contract", targetType, action)
		assert.Equal(t, strings.ToLower(contract.Hex()), targetID, action)
		assert.NotEmpty(t, metadata["transactionHash"], action)
		assert.NotEmpty(t, metadata["contractName"], action)
		assert.Equal(t, 1, alertCount(t, st, action), action)
	}

	_, _, _, _, granted := auditRow(t, st, "contract.role_granted")
	assert.Equal(t, "StrimzRegistry", granted["contractName"])
	assert.Equal(t, "FEE_MANAGER_ROLE", granted["roleName"])
	assert.Equal(t, roleTopic("STRIMZ_FEE_MANAGER_ROLE").Hex(), granted["role"])
	assert.Equal(t, attacker, granted["account"])
	assert.Equal(t, safe, granted["sender"])

	_, _, _, _, adminChanged := auditRow(t, st, "contract.role_admin_changed")
	assert.Equal(t, "CHARGER_ROLE", adminChanged["roleName"])
	assert.Equal(t, "DEFAULT_ADMIN_ROLE", adminChanged["previousAdminRoleName"])
	assert.Equal(t, "ADMIN_ROLE", adminChanged["newAdminRoleName"])

	_, _, _, _, upgraded := auditRow(t, st, "contract.upgraded")
	assert.Equal(t, newImpl, upgraded["implementation"])

	_, _, _, _, scheduled := auditRow(t, st, "timelock.call_scheduled")
	assert.Equal(t, operationID.Hex(), scheduled["operationId"])
	assert.Equal(t, strings.ToLower(registryAddr.Hex()), scheduled["target"])
	assert.Equal(t, "0x3f4ba83a", scheduled["data"])
	assert.Equal(t, "300", scheduled["delay"])

	_, _, _, _, delay := auditRow(t, st, "timelock.min_delay_changed")
	assert.Equal(t, "300", delay["oldDuration"])
	assert.Equal(t, "60", delay["newDuration"])
}

func TestE2E_Stream_RecordsAgentRegistryEventsWithoutAlerting(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newAdminRunner(t, c)
	agent := "0x00000000000000000000000000000000000000a9"
	controller := "0x00000000000000000000000000000000000000aa"
	c.logs = []types.Log{
		eventLog(agentRegistryAddr, "AgentRegistered(address,address,bytes32,string,string)",
			[]common.Hash{addrTopic(agent), addrTopic(controller)},
			pack(t, []string{"bytes32", "string", "string"}, [32]byte{7}, "Strimz AutoPay", "1.0.0"), 11, 0, txHash(0xc1)),
		eventLog(agentRegistryAddr, "AgentReputationAdjusted(address,int256,int256)",
			[]common.Hash{addrTopic(agent)}, pack(t, []string{"int256", "int256"}, big.NewInt(-5), big.NewInt(95)), 12, 0, txHash(0xc2)),
		eventLog(agentRegistryAddr, "AgentDeactivated(address)", []common.Hash{addrTopic(agent)}, nil, 13, 0, txHash(0xc3)),
	}

	require.NoError(t, r.Tick(context.Background()))

	category, _, targetType, targetID, registered := auditRow(t, st, "agent.registered")
	assert.Equal(t, "agent", category)
	assert.Equal(t, "Agent", targetType)
	assert.Equal(t, agent, targetID)
	assert.Equal(t, controller, registered["controller"])
	assert.Equal(t, "Strimz AutoPay", registered["name"])
	assert.Equal(t, "1.0.0", registered["version"])

	_, _, _, _, adjusted := auditRow(t, st, "agent.reputation_adjusted")
	assert.Equal(t, "-5", adjusted["delta"])
	assert.Equal(t, "95", adjusted["newScore"])
	auditRow(t, st, "agent.deactivated")

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "ContractAlert"`))
}

func TestE2E_Stream_ReplayingARangeDoesNotDuplicateAlerts(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 30}
	r, st := newAdminRunner(t, c)
	c.logs = []types.Log{
		eventLog(registryAddr, "RoleGranted(bytes32,address,address)",
			[]common.Hash{roleTopic("STRIMZ_ADMIN_ROLE"), addrTopic("0xf2"), addrTopic("0xf1")}, nil, 11, 0, txHash(0xd1)),
	}

	require.NoError(t, r.Tick(ctx))
	_, err := st.Pool().Exec(ctx, `DELETE FROM "IndexerCursor" WHERE "contractAddress" = $1`, coreCursorKey)
	require.NoError(t, err)
	require.NoError(t, r.Tick(ctx))

	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "AuditLog" WHERE action = 'contract.role_granted'`))
	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "ContractAlert"`))
}
