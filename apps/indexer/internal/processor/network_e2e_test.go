//go:build e2e

package processor

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
	"github.com/StrimzLab/strimz/apps/indexer/internal/testpg"
)

const (
	arcTestnetChainID = 5042002
	arcMainnetChainID = 5042
	anvilChainID      = 31337
)

var whitelistAddr = common.HexToAddress("0x0000000000000000000000000000000000000b06")

func chainIDServer(t *testing.T, chainID uint64) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if req.Method != "eth_chainId" {
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"error":{"code":-32601,"message":"method not found"}}`, req.ID)
			return
		}
		fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":"%s"}`, req.ID, hexutil.EncodeUint64(chainID))
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func truncateIndexerTables(t *testing.T, st *store.Store) {
	t.Helper()
	_, err := st.Pool().Exec(context.Background(), `
		TRUNCATE TABLE "AuditLog", "Transaction", "PaymentSession", "Customer", "Merchant",
		  "WebhookEvent", "IndexerCursor", "IndexerDeadLetter" RESTART IDENTITY CASCADE`)
	require.NoError(t, err)
}

func setRunnerEnv(t *testing.T, primary string, fallbacks ...string) {
	t.Helper()
	env := map[string]string{
		"ARC_ENVIRONMENT":         "testnet",
		"ARC_CHAIN_ID":            fmt.Sprint(arcTestnetChainID),
		"ARC_RPC_URL":             primary,
		"ARC_FALLBACK_RPC_URLS":   strings.Join(fallbacks, ","),
		"DATABASE_URL":            testpg.DSN(t),
		"HTTP_PORT":               "4100",
		"LOG_LEVEL":               "info",
		"POLL_INTERVAL_MS":        "1000",
		"CONFIRMATIONS":           "1",
		"START_BLOCK":             "5",
		"BLOCK_BATCH_SIZE":        "1000",
		"STALE_CURSOR_SECONDS":    "120",
		"REGISTRY_ADDRESS":        registryAddr.Hex(),
		"PAYMENTS_ADDRESS":        paymentsAddr.Hex(),
		"SUBSCRIPTIONS_ADDRESS":   subsAddr.Hex(),
		"AGENT_ESCROW_ADDRESS":    escrowAddr.Hex(),
		"FEE_COLLECTOR_ADDRESS":   feesAddr.Hex(),
		"TOKEN_WHITELIST_ADDRESS": whitelistAddr.Hex(),
		"STABLECOIN_ADDRESSES":    "USDC:" + usdcAddr.Hex(),
	}
	for k, v := range env {
		t.Setenv(k, v)
	}
}

func bootRunner(t *testing.T, primary string, fallbacks ...string) (*Runner, error) {
	t.Helper()
	setRunnerEnv(t, primary, fallbacks...)
	cfg, err := config.Load()
	require.NoError(t, err)
	r, err := NewRunner(context.Background(), cfg)
	if err == nil {
		t.Cleanup(r.Close)
	}
	return r, err
}

func bootRunnerOnFakeChain(t *testing.T, c *rangeChain) (*Runner, *store.Store) {
	t.Helper()
	r, err := bootRunner(t, chainIDServer(t, arcTestnetChainID))
	require.NoError(t, err)
	r.chain = c
	truncateIndexerTables(t, r.Store())
	return r, r.Store()
}

func coreStreamCall(t *testing.T, c *rangeChain) ethereum.FilterQuery {
	t.Helper()
	for _, q := range c.calls {
		for _, a := range q.Addresses {
			if a == registryAddr {
				return q
			}
		}
	}
	require.FailNow(t, "the core stream made no eth_getLogs call")
	return ethereum.FilterQuery{}
}

func TestE2E_Boot_RefusesAnRPCOnAnotherChain(t *testing.T) {
	_, err := bootRunner(t, chainIDServer(t, anvilChainID))
	require.Error(t, err)
	assert.Contains(t, err.Error(), fmt.Sprint(anvilChainID))
	assert.Contains(t, err.Error(), fmt.Sprint(arcTestnetChainID))
}

func TestE2E_Boot_RefusesAFallbackRPCOnAnotherChain(t *testing.T) {
	_, err := bootRunner(t, chainIDServer(t, arcTestnetChainID), chainIDServer(t, arcMainnetChainID))
	require.Error(t, err)
	assert.Contains(t, err.Error(), fmt.Sprint(arcMainnetChainID))
}

func TestE2E_Boot_AcceptsEndpointsOnTheConfiguredChain(t *testing.T) {
	_, err := bootRunner(t, chainIDServer(t, arcTestnetChainID), chainIDServer(t, arcTestnetChainID))
	require.NoError(t, err)
}

func TestE2E_Runner_WatchesTheTokenWhitelistAndEveryEmittedEvent(t *testing.T) {
	c := &rangeChain{head: 31}
	r, _ := bootRunnerOnFakeChain(t, c)

	require.NoError(t, r.Tick(context.Background()))

	core := coreStreamCall(t, c)
	assert.Contains(t, core.Addresses, whitelistAddr)
	require.Len(t, core.Topics, 1)
	topics := core.Topics[0]
	for _, sig := range []string{
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
	} {
		assert.Contains(t, topics, crypto.Keccak256Hash([]byte(sig)), sig)
	}
	assert.NotContains(t, topics, crypto.Keccak256Hash([]byte("MerchantOwnerTransferred(uint256,address)")))
}

func TestE2E_Stream_CursorIsScopedToTheConfiguredChain(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 31}
	r, st := bootRunnerOnFakeChain(t, c)
	_, err := st.Pool().Exec(ctx, `
		INSERT INTO "IndexerCursor" ("chainId", "contractAddress", environment, "lastProcessedBlock", "lastProcessedLogIndex", "lastBlockHash", "updatedAt")
		VALUES ($1, 'strimz-core', 'testnet', 25, -1, $2, NOW())`, anvilChainID, fmt.Sprintf("0x%064x", 25))
	require.NoError(t, err)

	require.NoError(t, r.Tick(ctx))

	assert.Equal(t, uint64(5), coreStreamCall(t, c).FromBlock.Uint64(), "a cursor written for another chain is not resumed")
	var own, foreign int64
	require.NoError(t, st.Pool().QueryRow(ctx,
		`SELECT "lastProcessedBlock" FROM "IndexerCursor" WHERE "chainId" = $1 AND "contractAddress" = 'strimz-core'`,
		arcTestnetChainID).Scan(&own))
	require.NoError(t, st.Pool().QueryRow(ctx,
		`SELECT "lastProcessedBlock" FROM "IndexerCursor" WHERE "chainId" = $1 AND "contractAddress" = 'strimz-core'`,
		anvilChainID).Scan(&foreign))
	assert.Equal(t, int64(30), own)
	assert.Equal(t, int64(25), foreign)
}

func TestE2E_Stream_ParkedLogsCarryTheChainID(t *testing.T) {
	c := &rangeChain{head: 31}
	r, st := bootRunnerOnFakeChain(t, c)
	c.logs = []types.Log{paymentExecuted(t, 11, 0, txHash(0x51), 9)}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 1, countRows(t, st,
		`SELECT count(*) FROM "IndexerDeadLetter" WHERE "chainId" = $1 AND "resolvedAt" IS NULL`, arcTestnetChainID))
}

func TestE2E_Stream_RetriesOnlyThisChainsDeadLetters(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 31}
	r, st := bootRunnerOnFakeChain(t, c)
	id := int64(7)
	seedMerchant(t, st, "m_foreign", "0x"+fmt.Sprintf("%064x", 4), &id)
	lg := paymentExecuted(t, 11, 0, txHash(0x52), 7)
	topics := make([]string, len(lg.Topics))
	for i, topic := range lg.Topics {
		topics[i] = topic.Hex()
	}
	_, err := st.Pool().Exec(ctx, `
		INSERT INTO "IndexerDeadLetter" (
		  id, "chainId", environment, "contractAddress", "txHash", "logIndex", "blockNumber",
		  "blockHash", "blockTimestamp", topics, data, reason, "updatedAt"
		) VALUES (
		  'dl_foreign', $1, 'testnet', $2, $3, 0, 11, $4, NOW(), $5, $6, 'parked on another chain', NOW()
		)`, anvilChainID, lg.Address.Hex(), lg.TxHash.Hex(), lg.BlockHash.Hex(), topics, hexutil.Encode(lg.Data))
	require.NoError(t, err)

	require.NoError(t, r.Tick(ctx))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "Transaction" WHERE "merchantId" = 'm_foreign'`))
	assert.Equal(t, 1, countRows(t, st,
		`SELECT count(*) FROM "IndexerDeadLetter" WHERE id = 'dl_foreign' AND "resolvedAt" IS NULL AND attempts = 1`))
}

func newGovernanceRunner(t *testing.T, c *rangeChain) (*Runner, *store.Store) {
	t.Helper()
	r, st := newTestRunner(t, c, 1)
	r.contractAddrs = append(r.contractAddrs, whitelistAddr)
	r.cfg = &config.Config{
		Environment:          r.cfg.Environment,
		Confirmations:        r.cfg.Confirmations,
		BlockBatchSize:       r.cfg.BlockBatchSize,
		PollIntervalMillis:   r.cfg.PollIntervalMillis,
		StartBlock:           r.cfg.StartBlock,
		RegistryAddress:      r.cfg.RegistryAddress,
		PaymentsAddress:      r.cfg.PaymentsAddress,
		SubscriptionsAddress: r.cfg.SubscriptionsAddress,
		AgentEscrowAddress:   r.cfg.AgentEscrowAddress,
		FeeCollectorAddress:  r.cfg.FeeCollectorAddress,
	}
	r.log = slog.Default()
	return r, st
}

func eventLog(addr common.Address, sig string, indexed []common.Hash, data []byte, block uint64, index uint, tx common.Hash) types.Log {
	return types.Log{
		Address:     addr,
		Topics:      append([]common.Hash{crypto.Keccak256Hash([]byte(sig))}, indexed...),
		Data:        data,
		BlockNumber: block, Index: index, TxHash: tx, BlockHash: common.HexToHash(fmt.Sprintf("0x%064x", block)),
	}
}

func idTopic(n int64) common.Hash { return common.BigToHash(big.NewInt(n)) }

func addrTopic(a string) common.Hash { return common.BytesToHash(common.HexToAddress(a).Bytes()) }

func auditRow(t *testing.T, st *store.Store, action string) (category string, merchantID *string, targetType, targetID string, metadata map[string]any) {
	t.Helper()
	var raw []byte
	err := st.Pool().QueryRow(context.Background(), `
		SELECT category::text, "merchantId", "targetType", "targetId", metadata::text
		  FROM "AuditLog" WHERE action = $1`, action).Scan(&category, &merchantID, &targetType, &targetID, &raw)
	require.NoError(t, err, "no AuditLog row for %s", action)
	require.NoError(t, json.Unmarshal(raw, &metadata))
	return
}

func TestE2E_Stream_ProjectsMerchantGovernanceEventsAsAuditRows(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newGovernanceRunner(t, c)
	id := int64(7)
	seedMerchant(t, st, "m_gov", "0x"+fmt.Sprintf("%064x", 5), &id)
	current := "0x00000000000000000000000000000000000000c1"
	pending := "0x00000000000000000000000000000000000000c2"
	newPayout := "0x00000000000000000000000000000000000000d1"
	commitAt := uint64(1_790_086_400)
	c.logs = []types.Log{
		eventLog(registryAddr, "MerchantOwnershipTransferInitiated(uint256,address,address)",
			[]common.Hash{idTopic(7), addrTopic(current), addrTopic(pending)}, nil, 11, 0, txHash(0x61)),
		eventLog(registryAddr, "MerchantPayoutChangeInitiated(uint256,address,uint64)",
			[]common.Hash{idTopic(7), addrTopic(newPayout)}, pack(t, []string{"uint64"}, commitAt), 12, 0, txHash(0x62)),
		eventLog(registryAddr, "MerchantPayoutChangeCancelled(uint256)",
			[]common.Hash{idTopic(7)}, nil, 13, 0, txHash(0x63)),
		eventLog(registryAddr, "MerchantOwnershipTransferAccepted(uint256,address,address)",
			[]common.Hash{idTopic(7), addrTopic(current), addrTopic(pending)}, nil, 13, 1, txHash(0x63)),
		eventLog(registryAddr, "MerchantOwnershipTransferCancelled(uint256)",
			[]common.Hash{idTopic(7)}, nil, 14, 0, txHash(0x64)),
		eventLog(registryAddr, "MerchantMaxFeeBpsLowered(uint256,uint16)",
			[]common.Hash{idTopic(7)}, pack(t, []string{"uint16"}, uint16(100)), 15, 0, txHash(0x65)),
	}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	for _, action := range []string{
		"merchant.ownership_transfer_initiated_onchain",
		"merchant.payout_change_initiated_onchain",
		"merchant.payout_change_cancelled_onchain",
		"merchant.ownership_transfer_accepted_onchain",
		"merchant.ownership_transfer_cancelled_onchain",
		"merchant.max_fee_bps_lowered_onchain",
	} {
		category, merchantID, targetType, targetID, metadata := auditRow(t, st, action)
		assert.Equal(t, "merchant", category, action)
		require.NotNil(t, merchantID, action)
		assert.Equal(t, "m_gov", *merchantID, action)
		assert.Equal(t, "Merchant", targetType, action)
		assert.Equal(t, "m_gov", targetID, action)
		assert.NotEmpty(t, metadata["transactionHash"], action)
		assert.Contains(t, metadata, "logIndex", action)
	}

	_, _, _, _, accepted := auditRow(t, st, "merchant.ownership_transfer_accepted_onchain")
	assert.Equal(t, current, accepted["previousOwner"])
	assert.Equal(t, pending, accepted["newOwner"])
	_, _, _, _, initiated := auditRow(t, st, "merchant.ownership_transfer_initiated_onchain")
	assert.Equal(t, current, initiated["currentOwner"])
	assert.Equal(t, pending, initiated["pendingOwner"])
	_, _, _, _, payout := auditRow(t, st, "merchant.payout_change_initiated_onchain")
	assert.Equal(t, newPayout, payout["newPayoutAddress"])
	assert.EqualValues(t, commitAt, payout["commitAt"])
	_, _, _, _, maxFee := auditRow(t, st, "merchant.max_fee_bps_lowered_onchain")
	assert.EqualValues(t, 100, maxFee["newMaxFeeBps"])

	var payoutAddress string
	require.NoError(t, st.Pool().QueryRow(context.Background(),
		`SELECT "payoutAddress" FROM "Merchant" WHERE id = 'm_gov'`).Scan(&payoutAddress))
	assert.Equal(t, payoutAddr, payoutAddress, "an initiated payout change does not move the payout address")
}

func TestE2E_Stream_GovernanceEventForAnUnlinkedMerchantIsRecordedNotParked(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newGovernanceRunner(t, c)
	c.logs = []types.Log{
		eventLog(registryAddr, "MerchantMaxFeeBpsLowered(uint256,uint16)",
			[]common.Hash{idTopic(8)}, pack(t, []string{"uint16"}, uint16(50)), 11, 0, txHash(0x71)),
	}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	_, merchantID, targetType, targetID, _ := auditRow(t, st, "merchant.max_fee_bps_lowered_onchain")
	assert.Nil(t, merchantID)
	assert.Equal(t, "Merchant", targetType)
	assert.Equal(t, "onchain:8", targetID)
}

func TestE2E_Stream_ProjectsContractOperationsAsAdminAuditRows(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newGovernanceRunner(t, c)
	operator := "0x00000000000000000000000000000000000000e1"
	treasury := "0x00000000000000000000000000000000000000e2"
	newRegistry := "0x00000000000000000000000000000000000000e3"
	c.logs = []types.Log{
		eventLog(paymentsAddr, "Paused(address)", nil, pack(t, []string{"address"}, common.HexToAddress(operator)), 11, 0, txHash(0x81)),
		eventLog(paymentsAddr, "Unpaused(address)", nil, pack(t, []string{"address"}, common.HexToAddress(operator)), 12, 0, txHash(0x82)),
		eventLog(subsAddr, "DependencyUpdated(string,address)", nil,
			pack(t, []string{"string", "address"}, "registry", common.HexToAddress(newRegistry)), 13, 0, txHash(0x83)),
		eventLog(feesAddr, "FeeWithdrawn(address,address,uint256)",
			[]common.Hash{addrTopic(usdcAddr.Hex()), addrTopic(treasury)}, pack(t, []string{"uint256"}, big.NewInt(1_500_000)), 14, 0, txHash(0x84)),
		eventLog(whitelistAddr, "TokenAdded(address)", []common.Hash{addrTopic(usdcAddr.Hex())}, nil, 15, 0, txHash(0x85)),
		eventLog(whitelistAddr, "TokenCapabilitiesSet(address,uint8)",
			[]common.Hash{addrTopic(usdcAddr.Hex())}, pack(t, []string{"uint8"}, uint8(3)), 15, 1, txHash(0x85)),
		eventLog(whitelistAddr, "TokenRemoved(address)", []common.Hash{addrTopic(usdcAddr.Hex())}, nil, 16, 0, txHash(0x86)),
	}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	expected := map[string]common.Address{
		"contract.paused":                  paymentsAddr,
		"contract.unpaused":                paymentsAddr,
		"contract.dependency_updated":      subsAddr,
		"fees.withdrawn":                   feesAddr,
		"token_whitelist.token_added":      whitelistAddr,
		"token_whitelist.capabilities_set": whitelistAddr,
		"token_whitelist.token_removed":    whitelistAddr,
	}
	for action, contract := range expected {
		category, merchantID, targetType, targetID, metadata := auditRow(t, st, action)
		assert.Equal(t, "admin", category, action)
		assert.Nil(t, merchantID, action)
		assert.Equal(t, "Contract", targetType, action)
		assert.Equal(t, strings.ToLower(contract.Hex()), targetID, action)
		assert.NotEmpty(t, metadata["transactionHash"], action)
	}

	_, _, _, _, paused := auditRow(t, st, "contract.paused")
	assert.Equal(t, operator, paused["account"])
	_, _, _, _, dep := auditRow(t, st, "contract.dependency_updated")
	assert.Equal(t, "registry", dep["name"])
	assert.Equal(t, newRegistry, dep["newAddress"])
	_, _, _, _, withdrawn := auditRow(t, st, "fees.withdrawn")
	assert.Equal(t, strings.ToLower(usdcAddr.Hex()), withdrawn["token"])
	assert.Equal(t, treasury, withdrawn["to"])
	assert.Equal(t, "1500000", withdrawn["amount"])
	_, _, _, _, caps := auditRow(t, st, "token_whitelist.capabilities_set")
	assert.Equal(t, strings.ToLower(usdcAddr.Hex()), caps["token"])
	assert.EqualValues(t, 3, caps["capabilities"])
}

func TestE2E_Stream_ReplayingARangeDoesNotDuplicateGovernanceAuditRows(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 30}
	r, st := newGovernanceRunner(t, c)
	id := int64(7)
	seedMerchant(t, st, "m_replay", "0x"+fmt.Sprintf("%064x", 6), &id)
	c.logs = []types.Log{
		eventLog(registryAddr, "MerchantPayoutChangeCancelled(uint256)", []common.Hash{idTopic(7)}, nil, 11, 0, txHash(0x91)),
	}

	require.NoError(t, r.Tick(ctx))
	_, err := st.Pool().Exec(ctx, `DELETE FROM "IndexerCursor" WHERE "contractAddress" = $1`, coreCursorKey)
	require.NoError(t, err)
	require.NoError(t, r.Tick(ctx))

	assert.Equal(t, 1, countRows(t, st,
		`SELECT count(*) FROM "AuditLog" WHERE action = 'merchant.payout_change_cancelled_onchain'`))
}

func TestE2E_Stream_LegacyOwnerTransferredIsNotProjected(t *testing.T) {
	c := &rangeChain{head: 30}
	r, st := newGovernanceRunner(t, c)
	id := int64(7)
	seedMerchant(t, st, "m_legacy", "0x"+fmt.Sprintf("%064x", 7), &id)
	c.logs = []types.Log{
		eventLog(registryAddr, "MerchantOwnerTransferred(uint256,address)", []common.Hash{idTopic(7)},
			pack(t, []string{"address"}, common.HexToAddress("0xc3")), 11, 0, txHash(0xa1)),
	}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "AuditLog" WHERE action = 'merchant.owner_transferred_onchain'`))
	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
}

func TestE2E_Stream_CutoverIgnoresTheWhitelistWhichHadNoLegacyCursor(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 31}
	r, st := bootRunnerOnFakeChain(t, c)
	for _, addr := range []common.Address{registryAddr, paymentsAddr, subsAddr, escrowAddr, feesAddr} {
		require.NoError(t, st.SaveCheckpoint(ctx, &store.Checkpoint{
			ChainID: arcTestnetChainID, ContractAddress: addr.Hex(), Environment: "testnet",
			LastProcessedBlock: 20, LastProcessedLogIndex: -1,
			LastBlockHash: fmt.Sprintf("0x%064x", 20),
		}))
	}

	require.NoError(t, r.Tick(ctx))

	assert.Equal(t, uint64(21), coreStreamCall(t, c).FromBlock.Uint64())
}
