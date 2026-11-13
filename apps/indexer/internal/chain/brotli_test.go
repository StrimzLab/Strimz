package chain

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andybalholm/brotli"
	"github.com/stretchr/testify/require"
)

// #411: Blockdaemon answers with Content-Encoding br whatever the client asks for.
func TestDial_DecodesBrotliReplies(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Encoding", "br")
		bw := brotli.NewWriter(w)
		_, _ = bw.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"0x4ce6c2"}`))
		require.NoError(t, bw.Close())
	}))
	defer srv.Close()

	c, err := Dial(context.Background(), srv.URL)
	require.NoError(t, err)

	n, err := c.BlockNumber(context.Background())
	require.NoError(t, err)
	require.Equal(t, uint64(0x4ce6c2), n)
}
