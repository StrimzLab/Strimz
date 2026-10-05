package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setNetworkEnv(t *testing.T, overrides map[string]string, unset ...string) {
	t.Helper()
	env := map[string]string{
		"ARC_ENVIRONMENT":         "testnet",
		"ARC_CHAIN_ID":            "5042002",
		"ARC_RPC_URL":             "https://example.test/rpc",
		"ARC_FALLBACK_RPC_URLS":   "",
		"DATABASE_URL":            "postgres://localhost/strimz",
		"HTTP_PORT":               "4100",
		"LOG_LEVEL":               "info",
		"POLL_INTERVAL_MS":        "1000",
		"CONFIRMATIONS":           "1",
		"START_BLOCK":             "51147731",
		"BLOCK_BATCH_SIZE":        "500",
		"STALE_CURSOR_SECONDS":    "120",
		"REGISTRY_ADDRESS":        fakeAddr,
		"PAYMENTS_ADDRESS":        fakeAddr,
		"SUBSCRIPTIONS_ADDRESS":   fakeAddr,
		"AGENT_ESCROW_ADDRESS":    fakeAddr,
		"FEE_COLLECTOR_ADDRESS":   fakeAddr,
		"TOKEN_WHITELIST_ADDRESS": fakeAddr,
		"STABLECOIN_ADDRESSES":    "USDC:" + fakeAddr,
	}
	for k, v := range overrides {
		env[k] = v
	}
	for k, v := range env {
		t.Setenv(k, v)
	}
	for _, k := range unset {
		t.Setenv(k, "")
		require.NoError(t, os.Unsetenv(k))
	}
}

func TestLoad_AcceptsTheCanonicalChainIDForEachEnvironment(t *testing.T) {
	cases := map[string]string{"testnet": "5042002", "mainnet": "5042"}
	for env, chainID := range cases {
		t.Run(env, func(t *testing.T) {
			setNetworkEnv(t, map[string]string{"ARC_ENVIRONMENT": env, "ARC_CHAIN_ID": chainID})
			_, err := Load()
			require.NoError(t, err)
		})
	}
}

func TestLoad_RequiresChainID(t *testing.T) {
	setNetworkEnv(t, nil, "ARC_CHAIN_ID")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ARC_CHAIN_ID")
}

func TestLoad_RejectsChainIDThatIsNotAPositiveInteger(t *testing.T) {
	for _, chainID := range []string{"0", "-1", "arc"} {
		t.Run(chainID, func(t *testing.T) {
			setNetworkEnv(t, map[string]string{"ARC_CHAIN_ID": chainID})
			_, err := Load()
			require.Error(t, err)
			assert.Contains(t, err.Error(), "ARC_CHAIN_ID")
		})
	}
}

func TestLoad_RequiresStartBlock(t *testing.T) {
	setNetworkEnv(t, nil, "START_BLOCK")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "START_BLOCK")
}

func TestLoad_RejectsZeroStartBlock(t *testing.T) {
	setNetworkEnv(t, map[string]string{"START_BLOCK": "0"})
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "START_BLOCK")
}

func TestLoad_RequiresConfirmations(t *testing.T) {
	setNetworkEnv(t, nil, "CONFIRMATIONS")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CONFIRMATIONS")
}

func TestLoad_RequiresTokenWhitelistAddress(t *testing.T) {
	setNetworkEnv(t, nil, "TOKEN_WHITELIST_ADDRESS")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "TOKEN_WHITELIST_ADDRESS")
}

func TestLoad_RejectsMalformedTokenWhitelistAddress(t *testing.T) {
	setNetworkEnv(t, map[string]string{"TOKEN_WHITELIST_ADDRESS": "0x1234"})
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "TOKEN_WHITELIST_ADDRESS")
}
