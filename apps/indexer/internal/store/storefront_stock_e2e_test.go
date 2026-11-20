//go:build e2e

package store

import (
	"context"
	"math/big"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The expiry cron hands the unit back; a payment that still lands must take it again.
func TestE2E_LatePaymentOnExpiredStorefrontSessionRetakesStock(t *testing.T) {
	s := startTestPostgres(t)
	ctx := context.Background()
	seedMerchantOnchain(t, s, "m_shop", "shop@x.io", "0x000000000000000000000000000000000000d0d0", big.NewInt(320))
	mustExec(t, s, ctx, `
		INSERT INTO "Storefront" (id, "merchantId", slug, name, status, "createdAt", "updatedAt")
		VALUES ('sf_1', 'm_shop', 'shop', 'Shop', 'published', NOW(), NOW())`)
	mustExec(t, s, ctx, `
		INSERT INTO "StorefrontProduct" (id, "storefrontId", name, price, currency, type, stock, "isActive", "createdAt", "updatedAt")
		VALUES ('prod_1', 'sf_1', 'Last one', '100000', 'USDC', 'one_time', 1, true, NOW(), NOW())`)
	mustExec(t, s, ctx, `
		INSERT INTO "PaymentSession" (id, "merchantId", amount, currency, "feeAmount", "netAmount",
		  description, "checkoutUrl", mode, status, "storefrontProductId", "expiresAt", "createdAt", "updatedAt")
		VALUES ('sess_late', 'm_shop', '100000', 'USDC', '1500', '98500', 'Last one', 'https://x', 'live',
		  'expired', 'prod_1', NOW() - INTERVAL '1 minute', NOW(), NOW())`)

	rows, err := s.InsertOneShotTransaction(ctx, oneShotInput(320, "sess_late", "0x"+repeatStr("e", 64)))
	require.NoError(t, err)
	require.Equal(t, int64(1), rows)

	var stock int
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT stock FROM "StorefrontProduct" WHERE id = 'prod_1'`).Scan(&stock))
	assert.Equal(t, 0, stock)

	rows, err = s.InsertOneShotTransaction(ctx, oneShotInput(320, "sess_late", "0x"+repeatStr("e", 64)))
	require.NoError(t, err)
	require.Equal(t, int64(0), rows)
	require.NoError(t, s.pool.QueryRow(ctx, `SELECT stock FROM "StorefrontProduct" WHERE id = 'prod_1'`).Scan(&stock))
	assert.Equal(t, 0, stock)
}
