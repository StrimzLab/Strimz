package chain

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/core/types"
)

// stubClient reports a fixed id via BlockNumber and can be toggled to fail.
type stubClient struct {
	id     uint64
	fail   bool
	calls  int
	closed bool
}

func (s *stubClient) BlockNumber(context.Context) (uint64, error) {
	s.calls++
	if s.fail {
		return 0, errors.New("down")
	}
	return s.id, nil
}
func (s *stubClient) FilterLogs(context.Context, ethereum.FilterQuery) ([]types.Log, error) {
	return nil, nil
}
func (s *stubClient) BlockTime(context.Context, uint64) (time.Time, error) { return time.Time{}, nil }
func (s *stubClient) BlockHash(context.Context, uint64) (string, error)    { return "", nil }
func (s *stubClient) Close()                                               { s.closed = true }

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
	got := redactURL("https://arc-testnet.g.alchemy.com/v2/secretkey")
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
