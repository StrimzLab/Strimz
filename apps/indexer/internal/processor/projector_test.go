package processor

import (
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

func TestDecodeSessionRef_ReturnsAsciiUpToNul(t *testing.T) {
	var ref [32]byte
	copy(ref[:], "cmh3lmkw50000xv8d12345678")
	assert.Equal(t, "cmh3lmkw50000xv8d12345678", decodeSessionRef(ref))
}

func TestDecodeSessionRef_RejectsNonAscii(t *testing.T) {
	var ref [32]byte
	copy(ref[:], []byte{0xff, 0xfe, 0xfd})
	assert.Equal(t, "", decodeSessionRef(ref))
}

func TestDecodeSessionRef_TreatsAllNulAsEmpty(t *testing.T) {
	var ref [32]byte
	assert.Equal(t, "", decodeSessionRef(ref))
}

func TestProjector_TokenSymbol_ResolvesConfiguredTokens(t *testing.T) {
	usdcAddr := common.HexToAddress("0x0000000000000000000000000000000000000a01")
	eurcAddr := common.HexToAddress("0x0000000000000000000000000000000000000a02")
	p := NewProjector(nil, nil, "testnet", 5042002, map[string]string{
		usdcAddr.Hex(): "USDC",
		eurcAddr.Hex(): "EURC",
	})
	sym, err := p.tokenSymbol(usdcAddr)
	require.NoError(t, err)
	assert.Equal(t, "USDC", sym)
	sym, err = p.tokenSymbol(eurcAddr)
	require.NoError(t, err)
	assert.Equal(t, "EURC", sym)
}

func TestProjector_TokenSymbol_FailsForUnknownToken(t *testing.T) {
	p := NewProjector(nil, nil, "testnet", 5042002, map[string]string{
		"0x0000000000000000000000000000000000000a01": "USDC",
	})
	addr := common.HexToAddress("0x000000000000000000000000000000000000dead")
	_, err := p.tokenSymbol(addr)
	require.Error(t, err)
	assert.Contains(t, err.Error(), strings.ToLower(addr.Hex()))
}

func TestIntervalFromSeconds_KnownIntervals(t *testing.T) {
	cases := []struct {
		secs uint32
		want string
		n    int32
	}{
		{86_400, "daily", 1},
		{604_800, "weekly", 1},
		{2_592_000, "monthly", 1},
		{7_776_000, "quarterly", 1},
		{31_536_000, "yearly", 1},
	}
	for _, c := range cases {
		got, n := store.IntervalFromSeconds(c.secs)
		assert.Equal(t, c.want, got, "secs %d", c.secs)
		assert.Equal(t, c.n, n, "secs %d", c.secs)
	}
}

func TestIntervalFromSeconds_FallbackBuckets(t *testing.T) {
	// 3 days → daily × 3
	got, n := store.IntervalFromSeconds(3 * 86_400)
	assert.Equal(t, "daily", got)
	assert.Equal(t, int32(3), n)

	// 2 weeks → weekly × 2
	got, n = store.IntervalFromSeconds(2 * 604_800)
	assert.Equal(t, "weekly", got)
	assert.Equal(t, int32(2), n)
}

func TestHexBytes32_HasExpectedLength(t *testing.T) {
	var b [32]byte
	for i := range b {
		b[i] = byte(i)
	}
	got := hexBytes32(b)
	assert.Len(t, got, 2+64)
	assert.Contains(t, got, "0x00010203")
}
