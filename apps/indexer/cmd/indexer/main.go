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
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"github.com/StrimzLab/strimz/apps/indexer/internal/config"
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
			ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer cancel()

			runner, err := processor.NewRunner(ctx, cfg)
			if err != nil {
				return err
			}
			defer runner.Close()
			return runner.Run(ctx)
		},
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
