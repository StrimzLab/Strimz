// Package main is the entrypoint for the Strimz on-chain indexer.
//
// The indexer is a long-running background process. It polls the Arc RPC for
// new blocks, decodes the events emitted by the Strimz contract suite, and
// projects them into the shared Postgres database used by the rest of the
// platform.
//
// It is not the source of truth for transaction state — the on-chain log is.
// The indexer is a derived view; truncating its bookmarks and reprocessing
// from genesis must produce identical Postgres state.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	// Auto-load a sibling .env file when present. Mirrors how the Node
	// services handle `.env` via @nestjs/config so local-dev parity is the
	// default. In production, no .env exists — envconfig reads from the
	// platform-injected environment as before, and this import is a no-op.
	_ "github.com/joho/godotenv/autoload"

	"github.com/spf13/cobra"

	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
	"github.com/StrimzLab/strimz/apps/indexer/internal/health"
	"github.com/StrimzLab/strimz/apps/indexer/internal/processor"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	root := &cobra.Command{
		Use:   "strimz-indexer",
		Short: "Project Strimz Arc contract events into Postgres",
	}
	root.AddCommand(runCmd(), versionCmd())

	if err := root.Execute(); err != nil {
		slog.Error("indexer failed", "err", err)
		os.Exit(1)
	}
}

func runCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "run",
		Short: "Start the indexer loop",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return err
			}

			// Apply the configured log level. The main()-scope logger was
			// pinned at INFO for cobra startup; now that cfg is loaded we
			// swap in a level-aware handler so LOG_LEVEL=debug actually
			// surfaces the per-batch "processed batch" lines.
			level, err := parseSlogLevel(cfg.LogLevel)
			if err != nil {
				return err
			}
			slog.SetDefault(slog.New(slog.NewJSONHandler(
				os.Stdout, &slog.HandlerOptions{Level: level},
			)))

			ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer cancel()

			runner, err := processor.NewRunner(ctx, cfg)
			if err != nil {
				return err
			}
			defer runner.Close()

			// Cursor freshness monitor: polls IndexerCursor and marks
			// /readyz stale when any cursor stalls past the threshold.
			freshness := health.NewFreshnessMonitor(
				runner.Store().Pool(),
				string(cfg.Environment),
				runner.MonitoredAddresses(),
				time.Duration(cfg.StaleCursorSeconds)*time.Second,
			)
			go freshness.Start(ctx)

			healthSrv := health.New(cfg.HTTPPort, freshness)
			go func() {
				if err := healthSrv.Start(ctx); err != nil {
					slog.Error("health server stopped", "err", err)
				}
			}()
			healthSrv.MarkReady()

			return runner.Run(ctx)
		},
	}
}

// parseSlogLevel maps a config string ("info", "debug", …) to a
// `slog.Level`. The config layer already constrains the value to a
// small enum, so a mismatch here is a programmer error rather than a
// user input error — surface it loudly.
func parseSlogLevel(s string) (slog.Level, error) {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("unknown LOG_LEVEL %q", s)
	}
}

func versionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print build version",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Println("strimz-indexer 0.0.0")
		},
	}
}
