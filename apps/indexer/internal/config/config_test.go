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
		Environment:          EnvTestnet,
		RPCURL:               "https://example.test/rpc",
		DatabaseURL:          "postgres://localhost/strimz",
		HTTPPort:             4100,
		LogLevel:             "info",
		PollIntervalMillis:   5000,
		Confirmations:        5,
		BlockBatchSize:       500,
		RegistryAddress:      fakeAddr,
		PaymentsAddress:      fakeAddr,
		SubscriptionsAddress: fakeAddr,
		AgentEscrowAddress:   fakeAddr,
		FeeCollectorAddress:  fakeAddr,
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
		"",                  // empty
		"abc",               // too short
		"0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",                  // 40 non-hex chars
		"0000000000000000000000000000000000000001",                  // missing 0x
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
	c.StablecoinAddresses = []string{fakeAddr, "not-an-address"}
	_, err := Validate(c)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "STABLECOIN_ADDRESSES[1]")
}
