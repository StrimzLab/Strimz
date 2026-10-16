//go:build e2e

package testpg

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"

	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

var (
	once      sync.Once
	dsn       string
	terminate func()
	startErr  error
)

func DSN(t *testing.T) string {
	t.Helper()
	once.Do(func() {
		ctx := context.Background()
		pg, err := tcpostgres.Run(ctx,
			"postgres:16-alpine",
			tcpostgres.WithDatabase("strimz_test"),
			tcpostgres.WithUsername("postgres"),
			tcpostgres.WithPassword("postgres"),
			tcpostgres.BasicWaitStrategies(),
			tcpostgres.WithSQLDriver("pgx"),
		)
		if err != nil {
			startErr = err
			return
		}
		terminate = func() { _ = pg.Terminate(ctx) }

		conn, err := pg.ConnectionString(ctx, "sslmode=disable")
		if err != nil {
			startErr = err
			return
		}
		root, err := repoRoot()
		if err != nil {
			startErr = err
			return
		}
		migrate := exec.Command("pnpm", "db:migrate:deploy")
		migrate.Dir = filepath.Join(root, "packages", "db")
		migrate.Env = append(os.Environ(), "DATABASE_URL="+conn)
		if out, err := migrate.CombinedOutput(); err != nil {
			startErr = &migrateError{err: err, output: string(out)}
			return
		}
		dsn = conn
	})
	if startErr != nil {
		t.Fatalf("test postgres: %v", startErr)
	}
	return dsn
}

func Terminate() {
	if terminate != nil {
		terminate()
	}
}

func Main(m *testing.M) {
	if os.Getenv("DOCKER_HOST") == "" {
		_ = os.Setenv("DOCKER_HOST", "unix://"+os.Getenv("HOME")+"/.docker/run/docker.sock")
	}
	code := m.Run()
	Terminate()
	os.Exit(code)
}

type migrateError struct {
	err    error
	output string
}

func (e *migrateError) Error() string {
	return "prisma migrate deploy: " + e.err.Error() + "\n" + e.output
}

func repoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for i := 0; i < 8; i++ {
		if _, err := os.Stat(filepath.Join(dir, "pnpm-workspace.yaml")); err == nil {
			return dir, nil
		}
		dir = filepath.Dir(dir)
	}
	return "", os.ErrNotExist
}
