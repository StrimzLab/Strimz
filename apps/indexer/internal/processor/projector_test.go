package processor

import (
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"

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

func TestProjector_TokenSymbol_ResolvesConfiguredToken(t *testing.T) {
	usdcAddr := common.HexToAddress("0x000000000000000000000000000000000000usdc")
	p := NewProjector(nil, nil, "testnet", map[string]string{
		usdcAddr.Hex(): "USDC",
	})
	assert.Equal(t, "USDC", p.tokenSymbol(usdcAddr))
}

func TestProjector_TokenSymbol_FallsBackToUSDC(t *testing.T) {
	p := NewProjector(nil, nil, "testnet", nil)
	addr := common.HexToAddress("0x000000000000000000000000000000000000dead")
	assert.Equal(t, "USDC", p.tokenSymbol(addr))
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
