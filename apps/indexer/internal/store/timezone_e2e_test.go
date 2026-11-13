//go:build e2e

package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/StrimzLab/strimz/apps/indexer/internal/testpg"
)

// #419: projections write NOW() into timestamp-without-time-zone columns that
// Prisma reads as UTC, so every indexer connection must run in UTC.
func TestE2E_ConnectionsRunInUTC(t *testing.T) {
	ctx := context.Background()
	dsn := testpg.DSN(t)
	admin, err := New(ctx, dsn)
	require.NoError(t, err)
	defer admin.Close()

	setZone := func(zone string) {
		_, err := admin.pool.Exec(ctx,
			`DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), '`+zone+`'); END $$`)
		require.NoError(t, err)
	}
	setZone("Asia/Tokyo")
	defer setZone("UTC")

	s, err := New(ctx, dsn)
	require.NoError(t, err)
	defer s.Close()

	var tz string
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT current_setting('TimeZone')`).Scan(&tz))
	require.Equal(t, "UTC", tz)
}
