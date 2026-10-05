// Package config loads and validates the indexer's runtime configuration
// from environment variables. It is the only place env is read at runtime;
// every other package receives a fully-validated `Config` struct.
package config

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/kelseyhightower/envconfig"
)

// Environment names a Strimz deployment target. Mirrors the `ArcEnvironment`
// enum on the Postgres side.
type Environment string

const (
	EnvTestnet Environment = "testnet"
	EnvMainnet Environment = "mainnet"
)

// Config is the fully validated runtime configuration.
//
// Required fields fail fast at startup (envconfig returns an error). Optional
// fields have sensible defaults. We validate addresses are 42-char hex
// (`0x` + 20 bytes) so the chain client receives well-formed values.
type Config struct {
	Environment Environment `envconfig:"ARC_ENVIRONMENT"   required:"true"`
	ChainID     int64       `envconfig:"ARC_CHAIN_ID"      required:"true"`
	RPCURL      string      `envconfig:"ARC_RPC_URL"       required:"true"`
	// Optional ordered fallback endpoints. The client tries ARC_RPC_URL
	// first, then these in order when a request errors.
	FallbackRPCURLs    []string `envconfig:"ARC_FALLBACK_RPC_URLS" default:""`
	DatabaseURL        string   `envconfig:"DATABASE_URL"      required:"true"`
	HTTPPort           int      `envconfig:"HTTP_PORT"         default:"4100"`
	LogLevel           string   `envconfig:"LOG_LEVEL"         default:"info"`
	PollIntervalMillis int      `envconfig:"POLL_INTERVAL_MS"  default:"5000"`
	Confirmations      uint64   `envconfig:"CONFIRMATIONS"     required:"true"`
	StartBlock         uint64   `envconfig:"START_BLOCK"       required:"true"`
	BlockBatchSize     uint64   `envconfig:"BLOCK_BATCH_SIZE"  default:"500"`
	// StaleCursorSeconds: /readyz flips to 503 if any Strimz-contract
	// cursor has not moved in this many seconds. Also drives a per-tick
	// WARN log. Set to 0 to disable the check.
	StaleCursorSeconds int `envconfig:"STALE_CURSOR_SECONDS" default:"120"`

	// Contract addresses — emitted by the Foundry deployment script.
	RegistryAddress       string `envconfig:"REGISTRY_ADDRESS"       required:"true"`
	PaymentsAddress       string `envconfig:"PAYMENTS_ADDRESS"       required:"true"`
	SubscriptionsAddress  string `envconfig:"SUBSCRIPTIONS_ADDRESS"  required:"true"`
	AgentEscrowAddress    string `envconfig:"AGENT_ESCROW_ADDRESS"   required:"true"`
	FeeCollectorAddress   string `envconfig:"FEE_COLLECTOR_ADDRESS"  required:"true"`
	TokenWhitelistAddress string `envconfig:"TOKEN_WHITELIST_ADDRESS" required:"true"`
	// Optional: stablecoin addresses to scan for refund-completion Transfers.
	StablecoinAddresses []string `envconfig:"STABLECOIN_ADDRESSES" default:""`
	Stablecoins         []Stablecoin
}

type Stablecoin struct {
	Symbol  string
	Address string
}

var paymentSymbols = map[string]bool{"USDC": true, "EURC": true}

// Load reads the environment, validates, and returns a Config.
func Load() (*Config, error) {
	var c Config
	if err := envconfig.Process("", &c); err != nil {
		return nil, fmt.Errorf("envconfig: %w", err)
	}
	return Validate(&c)
}

// Validate runs structural checks against an already-decoded Config. Exposed
// so tests can construct Config values directly without going through env.
func Validate(c *Config) (*Config, error) {
	if c.Environment != EnvTestnet && c.Environment != EnvMainnet {
		return nil, fmt.Errorf("ARC_ENVIRONMENT must be testnet or mainnet, got %q", c.Environment)
	}
	if c.ChainID < 1 || c.ChainID > math.MaxInt32 {
		return nil, fmt.Errorf("ARC_CHAIN_ID must be an integer in [1, %d], got %d", math.MaxInt32, c.ChainID)
	}
	if c.StartBlock < 1 {
		return nil, errors.New("START_BLOCK must be >= 1, the block the core contracts were deployed at")
	}
	if c.PollIntervalMillis < 500 {
		return nil, errors.New("POLL_INTERVAL_MS must be >= 500")
	}
	if c.BlockBatchSize == 0 || c.BlockBatchSize > 5000 {
		return nil, errors.New("BLOCK_BATCH_SIZE must be in [1, 5000]")
	}
	addrs := map[string]string{
		"REGISTRY_ADDRESS":        c.RegistryAddress,
		"PAYMENTS_ADDRESS":        c.PaymentsAddress,
		"SUBSCRIPTIONS_ADDRESS":   c.SubscriptionsAddress,
		"AGENT_ESCROW_ADDRESS":    c.AgentEscrowAddress,
		"FEE_COLLECTOR_ADDRESS":   c.FeeCollectorAddress,
		"TOKEN_WHITELIST_ADDRESS": c.TokenWhitelistAddress,
	}
	for name, v := range addrs {
		if !isEvmAddress(v) {
			return nil, fmt.Errorf("%s must be a 0x-prefixed 20-byte hex string, got %q", name, v)
		}
	}
	stablecoins, err := parseStablecoins(c.StablecoinAddresses)
	if err != nil {
		return nil, err
	}
	c.Stablecoins = stablecoins
	return c, nil
}

func parseStablecoins(entries []string) ([]Stablecoin, error) {
	out := make([]Stablecoin, 0, len(entries))
	seenSymbol := map[string]bool{}
	seenAddress := map[string]bool{}
	for i, raw := range entries {
		entry := strings.TrimSpace(raw)
		if entry == "" {
			continue
		}
		symbol, address, ok := strings.Cut(entry, ":")
		if !ok {
			return nil, fmt.Errorf("STABLECOIN_ADDRESSES[%d] must be SYMBOL:address, got %q", i, raw)
		}
		symbol = strings.ToUpper(strings.TrimSpace(symbol))
		address = strings.ToLower(strings.TrimSpace(address))
		if !paymentSymbols[symbol] {
			return nil, fmt.Errorf("STABLECOIN_ADDRESSES[%d] symbol must be USDC or EURC, got %q", i, symbol)
		}
		if !isEvmAddress(address) {
			return nil, fmt.Errorf("STABLECOIN_ADDRESSES[%d] is not a valid EVM address: %q", i, raw)
		}
		if seenSymbol[symbol] {
			return nil, fmt.Errorf("STABLECOIN_ADDRESSES lists %s twice", symbol)
		}
		if seenAddress[address] {
			return nil, fmt.Errorf("STABLECOIN_ADDRESSES lists address %s twice", address)
		}
		seenSymbol[symbol] = true
		seenAddress[address] = true
		out = append(out, Stablecoin{Symbol: symbol, Address: address})
	}
	if len(out) == 0 {
		return nil, errors.New("STABLECOIN_ADDRESSES must list at least one SYMBOL:address entry")
	}
	return out, nil
}

func isEvmAddress(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) != 42 || !strings.HasPrefix(s, "0x") {
		return false
	}
	for _, r := range s[2:] {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return true
}
