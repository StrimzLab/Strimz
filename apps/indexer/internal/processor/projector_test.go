package processor

import (
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
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
	var ref [32]byte // zero-valued
	assert.Equal(t, "", decodeSessionRef(ref))
}

func TestTokenSymbol_FallsBackToUSDC(t *testing.T) {
	addr := common.HexToAddress("0x000000000000000000000000000000000000dead")
	assert.Equal(t, "USDC", tokenSymbol(addr))
}
