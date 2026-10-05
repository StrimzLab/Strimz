package config

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const fakeAddr = "0x0000000000000000000000000000000000000001"

func validConfig() *Config {
	return &Config{
		Environment:           EnvTestnet,
		ChainID:               5042002,
		RPCURL:                "https://example.test/rpc",
		DatabaseURL:           "postgres://localhost/strimz",
		HTTPPort:              4100,
		LogLevel:              "info",
		PollIntervalMillis:    5000,
		Confirmations:         1,
		StartBlock:            1,
		BlockBatchSize:        500,
		RegistryAddress:       fakeAddr,
		PaymentsAddress:       fakeAddr,
		SubscriptionsAddress:  fakeAddr,
		AgentEscrowAddress:    fakeAddr,
		FeeCollectorAddress:   fakeAddr,
		TokenWhitelistAddress: fakeAddr,
		StablecoinAddresses:   []string{"USDC:" + fakeAddr},
	}
}

func TestValidate_AcceptsWellFormedConfig(t *testing.T) {
	c, err := Validate(validConfig())
	require.NoError(t, err)
	assert.Equal(t, EnvTestnet, c.Environment)
}

func TestValidate_RejectsBadEnvironment(t *testing.T) {
	c := validConfig()
	c.Environment = "devnet"
	_, err := Validate(c)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ARC_ENVIRONMENT")
}

func TestValidate_RejectsTooShortPollInterval(t *testing.T) {
	c := validConfig()
	c.PollIntervalMillis = 100
	_, err := Validate(c)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "POLL_INTERVAL_MS")
}

func TestValidate_RejectsBatchSizeOutOfRange(t *testing.T) {
	for _, size := range []uint64{0, 5001, 10_000} {
		c := validConfig()
		c.BlockBatchSize = size
		_, err := Validate(c)
		require.Error(t, err, "batch size %d should fail", size)
	}
}

func TestValidate_RejectsMalformedAddresses(t *testing.T) {
	bads := []string{
		"",    // empty
		"abc", // too short
		"0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",   // 40 non-hex chars
		"0000000000000000000000000000000000000001",     // missing 0x
		"0x0000000000000000000000000000000000000001ff", // too long
	}
	for _, bad := range bads {
		c := validConfig()
		c.PaymentsAddress = bad
		_, err := Validate(c)
		require.Error(t, err, "address %q should fail", bad)
		assert.True(t, strings.Contains(err.Error(), "PAYMENTS_ADDRESS"))
	}
}

func TestValidate_RejectsBadStablecoinAddress(t *testing.T) {
	c := validConfig()
	c.StablecoinAddresses = []string{"USDC:" + fakeAddr, "EURC:not-an-address"}
	_, err := Validate(c)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "STABLECOIN_ADDRESSES[1]")
}

func TestValidate_ParsesStablecoinSymbols(t *testing.T) {
	c := validConfig()
	c.StablecoinAddresses = []string{"USDC:0x3600000000000000000000000000000000000000", " eurc:0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a "}
	c, err := Validate(c)
	require.NoError(t, err)
	assert.Equal(t, []Stablecoin{
		{Symbol: "USDC", Address: "0x3600000000000000000000000000000000000000"},
		{Symbol: "EURC", Address: "0x89b50855aa3be2f677cd6303cec089b5f319d72a"},
	}, c.Stablecoins)
}

func TestValidate_RejectsStablecoinEntriesThatAreNotSymbolAddressPairs(t *testing.T) {
	cases := map[string][]string{
		"bare address":      {fakeAddr},
		"unknown symbol":    {"USYC:" + fakeAddr},
		"duplicate symbol":  {"USDC:" + fakeAddr, "USDC:0x0000000000000000000000000000000000000002"},
		"duplicate address": {"USDC:" + fakeAddr, "EURC:" + fakeAddr},
		"empty":             {},
	}
	for name, entries := range cases {
		t.Run(name, func(t *testing.T) {
			c := validConfig()
			c.StablecoinAddresses = entries
			_, err := Validate(c)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "STABLECOIN_ADDRESSES")
		})
	}
}
