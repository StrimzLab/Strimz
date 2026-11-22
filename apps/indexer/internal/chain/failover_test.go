package chain

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/core/types"
)

// stubClient reports a fixed id via BlockNumber and can be toggled to fail.
type stubClient struct {
	id      uint64
	fail    bool
	calls   int
	closed  bool
	logsErr error
	queries []ethereum.FilterQuery
}

func (s *stubClient) BlockNumber(context.Context) (uint64, error) {
	s.calls++
	if s.fail {
		return 0, errors.New("down")
	}
	return s.id, nil
}
func (s *stubClient) FilterLogs(_ context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	s.queries = append(s.queries, q)
	return nil, s.logsErr
}
func (s *stubClient) BlockTime(context.Context, uint64) (time.Time, error) { return time.Time{}, nil }
func (s *stubClient) BlockHash(context.Context, uint64) (string, error)    { return "", nil }
func (s *stubClient) ChainID(context.Context) (uint64, error) {
	if s.fail {
		return 0, errors.New("down")
	}
	return s.id, nil
}
func (s *stubClient) Close() { s.closed = true }

func newFailover(clients ...Client) *FailoverClient {
	urls := make([]string, len(clients))
	for i := range clients {
		urls[i] = "http://stub"
	}
	return &FailoverClient{clients: clients, urls: urls, log: slog.Default()}
}

func TestFailover_AdvancesPastDeadEndpoint(t *testing.T) {
	a := &stubClient{id: 1, fail: true}
	b := &stubClient{id: 2}
	fc := newFailover(a, b)

	got, err := fc.BlockNumber(context.Background())
	if err != nil || got != 2 {
		t.Fatalf("want 2/nil, got %d/%v", got, err)
	}
	// The healthy endpoint should now be sticky — next call skips the dead one.
	a.calls, b.calls = 0, 0
	if _, err := fc.BlockNumber(context.Background()); err != nil {
		t.Fatalf("second call: %v", err)
	}
	if a.calls != 0 {
		t.Fatalf("expected dead endpoint skipped, got %d calls", a.calls)
	}
}

func TestFailover_AllDownReturnsError(t *testing.T) {
	fc := newFailover(&stubClient{fail: true}, &stubClient{fail: true})
	if _, err := fc.BlockNumber(context.Background()); err == nil {
		t.Fatal("expected error when every endpoint is down")
	}
}

func TestRedactURL_DropsPath(t *testing.T) {
	got := RedactURL("https://arc-testnet.g.alchemy.com/v2/secretkey")
	want := "https://arc-testnet.g.alchemy.com/…"
	if got != want {
		t.Fatalf("want %q, got %q", want, got)
	}
}

func TestFailover_PinnedSessionStaysOnOneEndpoint(t *testing.T) {
	a := &stubClient{id: 1}
	b := &stubClient{id: 2}
	fc := newFailover(a, b)

	pinned := fc.Pin()
	for i := 0; i < 3; i++ {
		if got, err := pinned.BlockNumber(context.Background()); err != nil || got != 1 {
			t.Fatalf("call %d: want 1/nil, got %d/%v", i, got, err)
		}
	}
	if b.calls != 0 {
		t.Fatalf("pinned session reached a second endpoint %d times", b.calls)
	}
}

func TestFailover_PinnedSessionFailsInsteadOfSwitching(t *testing.T) {
	a := &stubClient{id: 1}
	b := &stubClient{id: 2}
	fc := newFailover(a, b)

	pinned := fc.Pin()
	a.fail = true
	if _, err := pinned.BlockNumber(context.Background()); err == nil {
		t.Fatal("a pinned session must surface the error, not move to another endpoint")
	}
	if b.calls != 0 {
		t.Fatalf("pinned session switched endpoints mid-batch")
	}

	next := fc.Pin()
	if got, err := next.BlockNumber(context.Background()); err != nil || got != 2 {
		t.Fatalf("the next session should start on the next endpoint, got %d/%v", got, err)
	}
}

func TestVerifyChainID_DropsAnEndpointThatErrors(t *testing.T) {
	down := &stubClient{id: 5042002, fail: true}
	up := &stubClient{id: 5042002}
	fc := newFailover(down, up)

	if err := fc.VerifyChainID(context.Background(), 5042002); err != nil {
		t.Fatalf("want nil, got %v", err)
	}
	if len(fc.clients) != 1 || fc.clients[0] != up {
		t.Fatalf("want only the answering endpoint kept, got %d clients", len(fc.clients))
	}
	if !down.closed {
		t.Fatal("the dropped endpoint was not closed")
	}
}

func TestVerifyChainID_FailsWhenAnEndpointServesAnotherChain(t *testing.T) {
	fc := newFailover(&stubClient{id: 5042002}, &stubClient{id: 5042})
	err := fc.VerifyChainID(context.Background(), 5042002)
	if err == nil {
		t.Fatal("want an error for an endpoint on another chain")
	}
	for _, want := range []string{"5042002", "5042", "http://stub"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q does not name %s", err, want)
		}
	}
}

func TestVerifyChainID_FailsWhenNoEndpointAnswers(t *testing.T) {
	fc := newFailover(&stubClient{fail: true}, &stubClient{fail: true})
	if err := fc.VerifyChainID(context.Background(), 5042002); err == nil {
		t.Fatal("want an error when every endpoint fails eth_chainId")
	}
}

// ADR-2026-11-22-rpc-per-service: a free keyed endpoint caps eth_getLogs at a few blocks.
func TestVerifyLogRange_FailsNamingTheEndpointThatRejectsTheRange(t *testing.T) {
	narrow := &stubClient{id: 1000, logsErr: errors.New("eth_getLogs is limited to a 5 range")}
	fc := &FailoverClient{
		clients: []Client{&stubClient{id: 1000}, narrow},
		urls:    []string{"https://rpc.mainnet.arc.io", "https://free.quiknode.pro/secret-token/"},
		log:     slog.Default(),
	}
	err := fc.VerifyLogRange(context.Background(), 500, nil)
	if err == nil {
		t.Fatal("want an error for an endpoint that rejects the batch range")
	}
	if !strings.Contains(err.Error(), "free.quiknode.pro") || !strings.Contains(err.Error(), "500") {
		t.Fatalf("error %q should name the endpoint and the range", err)
	}
	if strings.Contains(err.Error(), "secret-token") {
		t.Fatalf("error %q leaks the endpoint key", err)
	}
}

func TestVerifyLogRange_QueriesOneBatchEndingAtHead(t *testing.T) {
	wide := &stubClient{id: 1000}
	fc := newFailover(wide)
	if err := fc.VerifyLogRange(context.Background(), 500, nil); err != nil {
		t.Fatalf("want nil, got %v", err)
	}
	if len(wide.queries) != 1 {
		t.Fatalf("want one probe, got %d", len(wide.queries))
	}
	q := wide.queries[0]
	if q.FromBlock.Uint64() != 501 || q.ToBlock.Uint64() != 1000 {
		t.Fatalf("want blocks 501-1000, got %d-%d", q.FromBlock.Uint64(), q.ToBlock.Uint64())
	}
}
