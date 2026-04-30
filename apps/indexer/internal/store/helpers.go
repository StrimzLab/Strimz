package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// auditEntry is the internal shape used by helpers that write to AuditLog.
type auditEntry struct {
	MerchantID string
	Category   string // "system" / "merchant" / "agent" / "compliance"
	Action     string
	TargetType string
	TargetID   string
	Metadata   map[string]any
}

// appendAudit writes an AuditLog row when the merchantId is unknown (no
// FK link). Used for system-level events that affect a merchant by their
// on-chain id only.
func (s *Store) appendAudit(ctx context.Context, e auditEntry) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "AuditLog" (
		  id, "merchantId", category, action, "targetType", "targetId", metadata, "createdAt"
		) VALUES (
		  gen_random_uuid()::text, NULL, $1::"AuditActionCategory", $2, $3, $4, $5::jsonb, NOW()
		)
	`, e.Category, e.Action, e.TargetType, e.TargetID, jsonOrEmpty(e.Metadata))
	return err
}

// appendAuditWithMerchant writes an AuditLog row scoped to a specific
// off-chain merchant (FK populated).
func (s *Store) appendAuditWithMerchant(ctx context.Context, merchantID string, e auditEntry) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "AuditLog" (
		  id, "merchantId", category, action, "targetType", "targetId", metadata, "createdAt"
		) VALUES (
		  gen_random_uuid()::text, $1, $2::"AuditActionCategory", $3, $4, $5, $6::jsonb, NOW()
		)
	`, merchantID, e.Category, e.Action, e.TargetType, e.TargetID, jsonOrEmpty(e.Metadata))
	return err
}

// lookupMerchantByOnchain finds a Merchant by its on-chain id within a
// transaction, returning `(id, payoutAddress)`.
func lookupMerchantByOnchain(ctx context.Context, tx pgxTxLike, onchainID *big.Int) (string, string, error) {
	var id, payout string
	err := tx.QueryRow(ctx,
		`SELECT id, COALESCE("payoutAddress", '') FROM "Merchant" WHERE "onchainMerchantId" = $1`,
		onchainID.Int64()).Scan(&id, &payout)
	if err != nil {
		return "", "", fmt.Errorf("merchant lookup for onchain id %s: %w", onchainID, err)
	}
	return id, payout, nil
}

// lookupMerchantByOnchainPool is the same lookup but outside a transaction.
func lookupMerchantByOnchainPool(ctx context.Context, pool *pgxpool.Pool, onchainID *big.Int) (string, string, error) {
	var id, payout string
	err := pool.QueryRow(ctx,
		`SELECT id, COALESCE("payoutAddress", '') FROM "Merchant" WHERE "onchainMerchantId" = $1`,
		onchainID.Int64()).Scan(&id, &payout)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", err
		}
		return "", "", fmt.Errorf("merchant lookup: %w", err)
	}
	return id, payout, nil
}

// upsertCustomer inserts or returns the existing Customer row keyed on
// `(merchantId, walletAddress)`.
func upsertCustomer(ctx context.Context, tx pgxTxLike, merchantID, walletAddress string) (string, error) {
	wallet := strings.ToLower(walletAddress)
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO "Customer" (id, "merchantId", "walletAddress", "firstSeenAt", "lastSeenAt")
		VALUES (gen_random_uuid()::text, $1, $2, NOW(), NOW())
		ON CONFLICT ("merchantId", "walletAddress")
		DO UPDATE SET "lastSeenAt" = NOW()
		RETURNING id
	`, merchantID, wallet).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("upsert customer: %w", err)
	}
	return id, nil
}

// findOrCreatePlan finds a SubscriptionPlan matching the on-chain attrs or
// creates a synthetic auto-discovered plan if none exists.
func findOrCreatePlan(ctx context.Context, tx pgxTxLike, merchantID, amount, currency, interval string, intervalCount int32) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		SELECT id FROM "SubscriptionPlan"
		 WHERE "merchantId" = $1
		   AND amount = $2
		   AND currency = $3::"PaymentCurrency"
		   AND interval = $4::"SubscriptionInterval"
		   AND "intervalCount" = $5
		   AND status = 'active'::"SubscriptionPlanStatus"
		 LIMIT 1
	`, merchantID, amount, currency, interval, intervalCount).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !isNoRows(err) {
		return "", fmt.Errorf("plan lookup: %w", err)
	}

	// No matching plan — auto-create.
	name := fmt.Sprintf("On-chain auto · %s × %d", interval, intervalCount)
	if err := tx.QueryRow(ctx, `
		INSERT INTO "SubscriptionPlan" (
		  id, "merchantId", name, description, amount, currency, interval, "intervalCount",
		  status, metadata, "createdAt", "updatedAt"
		) VALUES (
		  gen_random_uuid()::text, $1, $2, $3, $4, $5::"PaymentCurrency", $6::"SubscriptionInterval", $7,
		  'active'::"SubscriptionPlanStatus", $8::jsonb, NOW(), NOW()
		)
		RETURNING id
	`, merchantID, name,
		"Auto-discovered by indexer from on-chain SubscriptionCreated event",
		amount, currency, interval, intervalCount,
		`{"autoCreated":true,"source":"indexer"}`,
	).Scan(&id); err != nil {
		return "", fmt.Errorf("create plan: %w", err)
	}
	return id, nil
}

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

func jsonOrEmpty(m map[string]any) string {
	if len(m) == 0 {
		return "{}"
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// IntervalFromSeconds maps an on-chain interval (in seconds) to the
// off-chain `SubscriptionInterval` enum + `intervalCount` so that
// SubscriptionPlan and Subscription rows carry the same canonical shape
// the API uses.
//
// Returns ("monthly", 1) as a defensive default for unrecognised values
// — the on-chain row remains correct (we still store the raw seconds in
// the on-chain id lookup); the off-chain enum is informational for the
// dashboard.
func IntervalFromSeconds(seconds uint32) (string, int32) {
	switch seconds {
	case 86_400:
		return "daily", 1
	case 604_800:
		return "weekly", 1
	case 2_592_000:
		return "monthly", 1
	case 7_776_000:
		return "quarterly", 1
	case 31_536_000:
		return "yearly", 1
	default:
		// Best-fit by closest canonical interval.
		switch {
		case seconds < 604_800:
			n := int32(seconds / 86_400)
			if n < 1 {
				n = 1
			}
			return "daily", n
		case seconds < 2_592_000:
			n := int32(seconds / 604_800)
			if n < 1 {
				n = 1
			}
			return "weekly", n
		case seconds < 31_536_000:
			n := int32(seconds / 2_592_000)
			if n < 1 {
				n = 1
			}
			return "monthly", n
		default:
			n := int32(seconds / 31_536_000)
			if n < 1 {
				n = 1
			}
			return "yearly", n
		}
	}
}
