//go:build e2e

package processor

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"sort"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	ethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	indabi "github.com/StrimzLab/strimz/apps/indexer/internal/abi"
	"github.com/StrimzLab/strimz/apps/indexer/internal/chain"
	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
	"github.com/StrimzLab/strimz/apps/indexer/internal/testpg"
)

func TestMain(m *testing.M) { testpg.Main(m) }

var (
	registryAddr = common.HexToAddress("0x0000000000000000000000000000000000000b01")
	paymentsAddr = common.HexToAddress("0x0000000000000000000000000000000000000b02")
	subsAddr     = common.HexToAddress("0x0000000000000000000000000000000000000b03")
	escrowAddr   = common.HexToAddress("0x0000000000000000000000000000000000000b04")
	feesAddr     = common.HexToAddress("0x0000000000000000000000000000000000000b05")
	usdcAddr     = common.HexToAddress("0x0000000000000000000000000000000000000c01")
	payoutAddr   = "0x000000000000000000000000000000000000beef"
)

type rangeChain struct {
	head  uint64
	logs  []types.Log
	calls []ethereum.FilterQuery
}

func (c *rangeChain) BlockNumber(context.Context) (uint64, error) { return c.head, nil }
func (c *rangeChain) FilterLogs(_ context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	c.calls = append(c.calls, q)
	wanted := map[common.Address]bool{}
	for _, a := range q.Addresses {
		wanted[a] = true
	}
	var out []types.Log
	for _, lg := range c.logs {
		if lg.BlockNumber < q.FromBlock.Uint64() || lg.BlockNumber > q.ToBlock.Uint64() {
			continue
		}
		if len(wanted) > 0 && !wanted[lg.Address] {
			continue
		}
		out = append(out, lg)
	}
	return out, nil
}
func (c *rangeChain) BlockTime(_ context.Context, n uint64) (time.Time, error) {
	return time.Unix(1_790_000_000+int64(n), 0).UTC(), nil
}
func (c *rangeChain) BlockHash(_ context.Context, n uint64) (string, error) {
	return fmt.Sprintf("0x%064x", n), nil
}
func (c *rangeChain) Close()            {}
func (c *rangeChain) Pin() chain.Client { return c }

func newTestRunner(t *testing.T, c *rangeChain, startBlock uint64) (*Runner, *store.Store) {
	t.Helper()
	ctx := context.Background()
	st, err := store.New(ctx, testpg.DSN(t))
	require.NoError(t, err)
	t.Cleanup(st.Close)
	_, err = st.Pool().Exec(ctx, `
		TRUNCATE TABLE "AuditLog", "Transaction", "PaymentSession", "Customer", "Merchant",
		  "WebhookEvent", "IndexerCursor", "IndexerDeadLetter" RESTART IDENTITY CASCADE`)
	require.NoError(t, err)

	cfg := &config.Config{
		Environment:          config.EnvTestnet,
		Confirmations:        0,
		BlockBatchSize:       1000,
		PollIntervalMillis:   1000,
		StartBlock:           startBlock,
		RegistryAddress:      registryAddr.Hex(),
		PaymentsAddress:      paymentsAddr.Hex(),
		SubscriptionsAddress: subsAddr.Hex(),
		AgentEscrowAddress:   escrowAddr.Hex(),
		FeeCollectorAddress:  feesAddr.Hex(),
	}
	registry := indabi.MustLoad()
	r := &Runner{
		cfg:              cfg,
		chain:            c,
		store:            st,
		registry:         registry,
		projector:        NewProjector(st, registry, string(cfg.Environment), map[string]string{usdcAddr.Hex(): "USDC"}),
		log:              slog.Default(),
		contractAddrs:    []common.Address{registryAddr, paymentsAddr, subsAddr, escrowAddr, feesAddr},
		subscribedTopics: registry.SubscribedTopics(),
		blockTimes:       map[uint64]time.Time{},
	}
	return r, st
}

func mustTopic(t *testing.T, name indabi.EventName) common.Hash {
	t.Helper()
	topic, ok := indabi.MustLoad().TopicByName(name)
	require.True(t, ok, "topic %s", name)
	return topic
}

func pack(t *testing.T, types_ []string, values ...any) []byte {
	t.Helper()
	args := make(ethabi.Arguments, len(types_))
	for i, ty := range types_ {
		typ, err := ethabi.NewType(ty, "", nil)
		require.NoError(t, err)
		args[i] = ethabi.Argument{Type: typ}
	}
	data, err := args.Pack(values...)
	require.NoError(t, err)
	return data
}

func txHash(seed byte) common.Hash {
	var h common.Hash
	for i := range h {
		h[i] = seed
	}
	return h
}

func merchantRegistered(t *testing.T, block uint64, index uint, tx common.Hash, onchainID int64) types.Log {
	return types.Log{
		Address:     registryAddr,
		Topics:      []common.Hash{mustTopic(t, indabi.EventMerchantRegistered), common.BigToHash(big.NewInt(onchainID)), common.BytesToHash(common.HexToAddress("0xc1").Bytes())},
		Data:        pack(t, []string{"address", "uint16", "uint16", "uint256"}, common.HexToAddress(payoutAddr), uint16(150), uint16(150), big.NewInt(0)),
		BlockNumber: block, Index: index, TxHash: tx, BlockHash: common.HexToHash(fmt.Sprintf("0x%064x", block)),
	}
}

func merchantActiveSet(t *testing.T, block uint64, index uint, onchainID int64, active bool) types.Log {
	return types.Log{
		Address:     registryAddr,
		Topics:      []common.Hash{mustTopic(t, indabi.EventMerchantActiveSet), common.BigToHash(big.NewInt(onchainID))},
		Data:        pack(t, []string{"bool"}, active),
		BlockNumber: block, Index: index, TxHash: txHash(byte(0x30 + index)), BlockHash: common.HexToHash(fmt.Sprintf("0x%064x", block)),
	}
}

func paymentExecuted(t *testing.T, block uint64, index uint, tx common.Hash, onchainID int64) types.Log {
	var ref [32]byte
	return types.Log{
		Address: paymentsAddr,
		Topics: []common.Hash{
			mustTopic(t, indabi.EventPaymentExecuted),
			common.BigToHash(big.NewInt(onchainID)),
			common.BytesToHash(common.HexToAddress("0xaaaa").Bytes()),
			common.BytesToHash(usdcAddr.Bytes()),
		},
		Data:        pack(t, []string{"uint256", "uint256", "uint256", "bytes32"}, big.NewInt(1_000_000), big.NewInt(15_000), big.NewInt(985_000), ref),
		BlockNumber: block, Index: index, TxHash: tx, BlockHash: common.HexToHash(fmt.Sprintf("0x%064x", block)),
	}
}

func seedMerchant(t *testing.T, st *store.Store, id string, registrationTx string, onchainID *int64) {
	t.Helper()
	_, err := st.Pool().Exec(context.Background(), `
		INSERT INTO "Merchant" ("id", "privyUserId", "email", "payoutAddress", "onchainRegistrationTxHash", "onchainMerchantId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`, id, "did:privy:e2e:"+id, id+"@x.io", payoutAddr, registrationTx, onchainID)
	require.NoError(t, err)
}

func countRows(t *testing.T, st *store.Store, sql string, args ...any) int {
	t.Helper()
	var n int
	require.NoError(t, st.Pool().QueryRow(context.Background(), sql, args...).Scan(&n))
	return n
}

func coreCursor(t *testing.T, st *store.Store) uint64 {
	t.Helper()
	cp, err := st.LoadCheckpoint(context.Background(), "testnet", coreCursorKey)
	require.NoError(t, err)
	return cp.LastProcessedBlock
}

func TestE2E_Stream_AppliesContractsInChainOrder(t *testing.T) {
	regTx := txHash(0x11)
	c := &rangeChain{head: 20}
	r, st := newTestRunner(t, c, 1)
	seedMerchant(t, st, "m_order", regTx.Hex(), nil)
	c.logs = []types.Log{
		paymentExecuted(t, 11, 0, txHash(0x12), 7),
		merchantRegistered(t, 10, 3, regTx, 7),
	}

	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "Transaction" WHERE "merchantId" = 'm_order'`))
	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))
	assert.Equal(t, uint64(20), coreCursor(t, st))
	require.Len(t, c.calls, 1)
	assert.ElementsMatch(t, []common.Address{registryAddr, paymentsAddr, subsAddr, escrowAddr, feesAddr}, c.calls[0].Addresses)
}

func TestE2E_Stream_ParksAnUnresolvableLogAndRetriesIt(t *testing.T) {
	c := &rangeChain{head: 20}
	r, st := newTestRunner(t, c, 1)
	seedMerchant(t, st, "m_late", "0x"+fmt.Sprintf("%064x", 1), nil)
	c.logs = []types.Log{paymentExecuted(t, 11, 0, txHash(0x21), 8)}

	require.NoError(t, r.Tick(context.Background()))
	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "Transaction"`))
	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter" WHERE "resolvedAt" IS NULL`))
	assert.Equal(t, uint64(20), coreCursor(t, st), "the stream moves past a parked log")

	_, err := st.Pool().Exec(context.Background(), `UPDATE "Merchant" SET "onchainMerchantId" = 8 WHERE id = 'm_late'`)
	require.NoError(t, err)
	require.NoError(t, r.Tick(context.Background()))

	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "Transaction" WHERE "merchantId" = 'm_late'`))
	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter" WHERE "resolvedAt" IS NULL`))
}

func TestE2E_Stream_DatabaseErrorKeepsTheCursor(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 20}
	r, st := newTestRunner(t, c, 1)
	id := int64(9)
	seedMerchant(t, st, "m_fail", "0x"+fmt.Sprintf("%064x", 2), &id)
	c.logs = []types.Log{paymentExecuted(t, 11, 0, txHash(0x31), 9)}

	_, err := st.Pool().Exec(ctx, `
		CREATE OR REPLACE FUNCTION test_reject_tx() RETURNS trigger AS $$
		BEGIN RAISE EXCEPTION 'database unavailable'; END; $$ LANGUAGE plpgsql;
		CREATE TRIGGER test_reject_tx BEFORE INSERT ON "Transaction"
		  FOR EACH ROW EXECUTE FUNCTION test_reject_tx();`)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = st.Pool().Exec(ctx, `DROP TRIGGER IF EXISTS test_reject_tx ON "Transaction"; DROP FUNCTION IF EXISTS test_reject_tx();`)
	})

	require.NoError(t, r.Tick(ctx))
	assert.Equal(t, uint64(0), coreCursor(t, st))
	assert.Equal(t, 0, countRows(t, st, `SELECT count(*) FROM "IndexerDeadLetter"`))

	_, err = st.Pool().Exec(ctx, `DROP TRIGGER test_reject_tx ON "Transaction"`)
	require.NoError(t, err)
	require.NoError(t, r.Tick(ctx))
	assert.Equal(t, uint64(20), coreCursor(t, st))
	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "Transaction" WHERE "merchantId" = 'm_fail'`))
}

func TestE2E_Stream_CutoverSkipsWhatOldCursorsProcessed(t *testing.T) {
	ctx := context.Background()
	c := &rangeChain{head: 30}
	r, st := newTestRunner(t, c, 1)
	id := int64(10)
	seedMerchant(t, st, "m_cut", "0x"+fmt.Sprintf("%064x", 3), &id)

	for addr, block := range map[common.Address]uint64{
		registryAddr: 20, paymentsAddr: 5, subsAddr: 25, escrowAddr: 25, feesAddr: 25,
	} {
		require.NoError(t, st.SaveCheckpoint(ctx, &store.Checkpoint{
			ContractAddress: addr.Hex(), Environment: "testnet",
			LastProcessedBlock: block, LastProcessedLogIndex: -1,
			LastBlockHash: fmt.Sprintf("0x%064x", block),
		}))
	}
	c.logs = []types.Log{
		merchantActiveSet(t, 15, 0, 10, false),
		paymentExecuted(t, 10, 0, txHash(0x41), 10),
	}

	require.NoError(t, r.Tick(ctx))

	require.NotEmpty(t, c.calls)
	assert.Equal(t, uint64(6), c.calls[0].FromBlock.Uint64(), "starts after the slowest old cursor")
	var status string
	require.NoError(t, st.Pool().QueryRow(ctx, `SELECT status::text FROM "Merchant" WHERE id = 'm_cut'`).Scan(&status))
	assert.Equal(t, "active", status, "a registry log the old registry cursor covered is not applied again")
	assert.Equal(t, 1, countRows(t, st, `SELECT count(*) FROM "Transaction" WHERE "merchantId" = 'm_cut'`))
	assert.Equal(t, uint64(30), coreCursor(t, st))
}

func TestE2E_Stream_SortsWithinABlockByLogIndex(t *testing.T) {
	logs := []types.Log{{BlockNumber: 2, Index: 0}, {BlockNumber: 1, Index: 5}, {BlockNumber: 1, Index: 2}}
	sortLogs(logs)
	got := make([][2]uint64, len(logs))
	for i, lg := range logs {
		got[i] = [2]uint64{lg.BlockNumber, uint64(lg.Index)}
	}
	assert.True(t, sort.SliceIsSorted(got, func(i, j int) bool {
		return got[i][0] < got[j][0] || (got[i][0] == got[j][0] && got[i][1] < got[j][1])
	}))
	assert.Equal(t, [2]uint64{1, 2}, got[0])
}
