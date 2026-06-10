// Package health serves the /healthz, /readyz, and /metrics endpoints used by
// Render's load balancer and the Prometheus scraper.
package health

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Server is the HTTP listener. Backed by stdlib net/http so we keep the
// dependency surface tiny.
type Server struct {
	addr string
	srv  *http.Server
	// Ready flips to true once the first successful tick has completed.
	ready atomic.Bool
}

// New returns a non-started server bound to `:port`.
func New(port int) *Server {
	mux := http.NewServeMux()
	s := &Server{addr: fmt.Sprintf(":%d", port)}
	mux.HandleFunc("/healthz", s.healthz)
	mux.HandleFunc("/readyz", s.readyz)
	mux.Handle("/metrics", promhttp.Handler())
	s.srv = &http.Server{
		Addr:              s.addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	return s
}

// Start runs the server until ctx is cancelled. It returns nil on graceful
// shutdown.
func (s *Server) Start(ctx context.Context) error {
	errCh := make(chan error, 1)
	go func() { errCh <- s.srv.ListenAndServe() }()
	select {
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.srv.Shutdown(shutdownCtx); err != nil {
			slog.Warn("health shutdown failed", "err", err)
		}
		return nil
	}
}

// MarkReady flips /readyz to 200. Called by main after the runner has
// validated chain + DB connectivity — at that point the process is
// serving even if the projector hasn't drained its first batch yet.
func (s *Server) MarkReady() { s.ready.Store(true) }

func (s *Server) healthz(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (s *Server) readyz(w http.ResponseWriter, _ *http.Request) {
	if !s.ready.Load() {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"status":"starting"}`))
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ready"}`))
}
