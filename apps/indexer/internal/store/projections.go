package store

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// All write methods return `(rowsAffected int64, err error)` so callers can
// treat 0 rows as a no-op (idempotent re-projection) without confusing it
// with an error.

// ----- Merchant registry -----

// LinkOnchainMerchant sets the on-chain merchant ID on whichever Merchant
// row owns the matching `payoutAddress`. We don't insert a Merchant — that
// row is created off-chain via `/auth/sync` long before the on-chain
// transaction lands.
func (s *Store) LinkOnchainMerchant(ctx context.Context, onchainID *big.Int, payoutAddress string) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "Merchant"
		   SET "onchainMerchantId" = $1
		 WHERE "payoutAddress" = $2
		   AND ("onchainMerchantId" IS NULL OR "onchainMerchantId" = $1)
	`, onchainID.Int64(), payoutAddress)
	if err != nil {
		return 0, fmt.Errorf("link merchant: %w", err)
	}
	return tag.RowsAffected(), nil
}

// UpdateMerchantPayoutAddress mirrors `MerchantPayoutAddressUpdated` —
// keeps the off-chain Merchant.payoutAddress in sync. Match by on-chain id.
func (s *Store) UpdateMerchantPayoutAddress(ctx context.Context, onchainID *big.Int, newPayoutAddress string) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "Merchant" SET "payoutAddress" = $2
		 WHERE "onchainMerchantId" = $1
	`, onchainID.Int64(), newPayoutAddress)
	if err != nil {
		return 0, fmt.Errorf("update payout: %w", err)
	}
	return tag.RowsAffected(), nil
}

// SetMerchantActive flips Merchant.status between `active` / `suspended` to
// reflect the on-chain `active` flag. (`suspended` is the closest off-chain
// status we have.)
func (s *Store) SetMerchantActive(ctx context.Context, onchainID *big.Int, active bool) (int64, error) {
	target := "suspended"
	if active {
		target = "active"
	}
	tag, err := s.pool.Exec(ctx, `
		UPDATE "Merchant" SET status = $2::"MerchantStatus"
		 WHERE "onchainMerchantId" = $1
	`, onchainID.Int64(), target)
	if err != nil {
		return 0, fmt.Errorf("set active: %w", err)
	}
	return tag.RowsAffected(), nil
}

// LogMerchantFeeBpsChange records `MerchantFeeBpsUpdated` to the AuditLog —
// fee bps isn't stored on the Merchant row itself (per-tier defaults +
// per-merchant overrides live elsewhere), so we surface it as an audit
// entry the dashboard can render.
func (s *Store) LogMerchantFeeBpsChange(ctx context.Context, onchainID *big.Int, newFeeBps uint16, txHash string) error {
	return s.appendAudit(ctx, auditEntry{
		Category:   "merchant",
		Action:     "merchant.fee_bps_changed_onchain",
		TargetType: "Merchant",
		TargetID:   fmt.Sprintf("onchain:%s", onchainID.String()),
		Metadata: map[string]any{
			"newFeeBps":      int(newFeeBps),
			"transactionHash": txHash,
		},
	})
}

// LogMerchantOwnerTransfer records `MerchantOwnerTransferred`. Owner is an
// on-chain concept (address); off-chain we map by the dashboard user/email.
// M1 records the event; M2 will reconcile to the off-chain Merchant.privyUserId.
func (s *Store) LogMerchantOwnerTransfer(ctx context.Context, onchainID *big.Int, newOwner, txHash string) error {
	return s.appendAudit(ctx, auditEntry{
		Category:   "merchant",
		Action:     "merchant.owner_transferred_onchain",
		TargetType: "Merchant",
		TargetID:   fmt.Sprintf("onchain:%s", onchainID.String()),
		Metadata: map[string]any{
			"newOwner":        strings.ToLower(newOwner),
			"transactionHash": txHash,
		},
	})
}

// ----- Payments (one-shot) -----

// OneShotTxInput is the parameter for InsertOneShotTransaction.
type OneShotTxInput struct {
	MerchantOnchainID *big.Int
	PayerAddress      string
	MerchantAddress   string
	Amount            string
	FeeAmount         string
	NetAmount         string
	Currency          string // "USDC" / "EURC"
	SessionRef        string // bytes32 → string-decoded; empty if not a session payment
	OnchainTxHash     string
	BlockNumber       uint64
	BlockTimestamp    time.Time
	LogIndex          uint
	Mode              string // "test" / "live"
}

// InsertOneShotTransaction records a confirmed `PaymentExecuted` event.
// Idempotent on `onchainTxHash` (UNIQUE) — replays no-op.
//
// `SessionRef` carries the bytes32 ref the contract emitted; if it matches
// a PaymentSession.id, we link `sessionId` and flip the session to
// `confirmed` in the same transaction.
func (s *Store) InsertOneShotTransaction(ctx context.Context, in OneShotTxInput) (int64, error) {
	var rows int64
	err := s.withinTx(ctx, func(tx pgxTxLike) error {
		var sessionID *string
		if in.SessionRef != "" {
			var maybeID string
			err := tx.QueryRow(ctx, `SELECT id FROM "PaymentSession" WHERE id = $1`, in.SessionRef).Scan(&maybeID)
			if err == nil {
				sessionID = &maybeID
			}
		}

		merchantID, merchantPayout, err := lookupMerchantByOnchain(ctx, tx, in.MerchantOnchainID)
		if err != nil {
			return err
		}
		merchantAddr := in.MerchantAddress
		if merchantAddr == "" {
			merchantAddr = merchantPayout
		}

		tag, err := tx.Exec(ctx, `
			INSERT INTO "Transaction" (
			  id, "merchantId", kind, status, "sessionId",
			  amount, "feeAmount", "netAmount", currency,
			  "payerAddress", "merchantAddress",
			  "onchainTxHash", "blockNumber", "blockTimestamp", "logIndex",
			  mode, "createdAt"
			) VALUES (
			  gen_random_uuid()::text, $1, 'one_shot'::"TransactionKind", 'confirmed'::"TransactionStatus", $2,
			  $3, $4, $5, $6::"PaymentCurrency",
			  $7, $8,
			  $9, $10, $11, $12,
			  $13::"Mode", NOW()
			)
			ON CONFLICT ("onchainTxHash") DO NOTHING
		`,
			merchantID, sessionID,
			in.Amount, in.FeeAmount, in.NetAmount, in.Currency,
			in.PayerAddress, merchantAddr,
			in.OnchainTxHash, in.BlockNumber, in.BlockTimestamp, in.LogIndex,
			in.Mode,
		)
		if err != nil {
			return fmt.Errorf("insert transaction: %w", err)
		}
		rows = tag.RowsAffected()

		if rows > 0 && sessionID != nil {
			// Stamp the tx hash onto the session row too. The browser
			// loads the session payload directly; without this it
			// would need a follow-up Transaction lookup to render the
			// confirmation tx on the success card. The API also reads
			// this field as part of the double-pay safety net.
			if _, err := tx.Exec(ctx,
				`UPDATE "PaymentSession"
				    SET status = 'confirmed'::"PaymentSessionStatus",
				        "onchainTxHash" = $2
				  WHERE id = $1
				    AND status != 'confirmed'`,
				*sessionID, in.OnchainTxHash); err != nil {
				return fmt.Errorf("confirm session: %w", err)
			}
		}
		return nil
	})
	return rows, err
}

// ----- Subscriptions -----

// SubscriptionCreatedInput drives the full upsert for `SubscriptionCreated`.
//
// The off-chain Subscription model requires `customerId` and `planId`. We
// resolve both deterministically from the event payload:
//   - Customer: upsert by `(merchantId, walletAddress)` — unique.
//   - Plan: find by `(merchantId, amount, currency, interval)`; if no
//     match, auto-create a plan named "On-chain auto · <interval>".
type SubscriptionCreatedInput struct {
	OnchainSubscriptionID *big.Int
	MerchantOnchainID     *big.Int
	PayerAddress          string
	Currency              string
	Amount                string
	Interval              string // "daily" / "weekly" / "monthly" / "quarterly" / "yearly"
	IntervalCount         int32
	StartAt               time.Time
	NextChargeAt          time.Time
	OnchainTxHash         string
	Mode                  string
}

// UpsertSubscriptionFromOnchain projects `SubscriptionCreated`. Idempotent
// on `onchainSubscriptionId` (UNIQUE) — replays no-op.
func (s *Store) UpsertSubscriptionFromOnchain(ctx context.Context, in SubscriptionCreatedInput) (int64, error) {
	var rows int64
	err := s.withinTx(ctx, func(tx pgxTxLike) error {
		merchantID, _, err := lookupMerchantByOnchain(ctx, tx, in.MerchantOnchainID)
		if err != nil {
			return err
		}

		customerID, err := upsertCustomer(ctx, tx, merchantID, in.PayerAddress)
		if err != nil {
			return err
		}

		planID, err := findOrCreatePlan(ctx, tx, merchantID, in.Amount, in.Currency, in.Interval, in.IntervalCount)
		if err != nil {
			return err
		}

		tag, err := tx.Exec(ctx, `
			INSERT INTO "Subscription" (
			  id, "onchainSubscriptionId", "enrolmentTxHash", "merchantId", "customerId", "planId",
			  status, "payerAddress", currency, amount, interval, "intervalCount",
			  "currentPeriodStartAt", "currentPeriodEndAt", "nextChargeAt",
			  "gracePeriodHours", mode, "createdAt", "updatedAt"
			) VALUES (
			  gen_random_uuid()::text, $1, $2, $3, $4, $5,
			  'active'::"SubscriptionStatus", $6, $7::"PaymentCurrency", $8, $9::"SubscriptionInterval", $10,
			  $11, $12, $13,
			  48, $14::"Mode", NOW(), NOW()
			)
			ON CONFLICT ("onchainSubscriptionId") DO NOTHING
		`,
			in.OnchainSubscriptionID.Int64(), in.OnchainTxHash, merchantID, customerID, planID,
			in.PayerAddress, in.Currency, in.Amount, in.Interval, in.IntervalCount,
			in.StartAt, in.NextChargeAt, in.NextChargeAt,
			in.Mode,
		)
		if err != nil {
			return fmt.Errorf("insert subscription: %w", err)
		}
		rows = tag.RowsAffected()
		return nil
	})
	return rows, err
}

// SubscriptionChargedInput drives the projection of a successful
// `SubscriptionCharged` event.
type SubscriptionChargedInput struct {
	OnchainSubscriptionID *big.Int
	ChargeAttemptID       string // 0x-prefixed 32-byte hex
	Amount                string
	FeeAmount             string
	NetAmount             string
	NextChargeAt          time.Time
	OnchainTxHash         string
	BlockNumber           uint64
	BlockTimestamp        time.Time
	LogIndex              uint
	Mode                  string
}

// InsertSubscriptionCharge writes:
//
//   - `SubscriptionCharge` (idempotent on `chargeAttemptId @unique`)
//   - `Transaction` (kind=subscription_charge, idempotent on `onchainTxHash`)
//   - bumps `Subscription.nextChargeAt`
//
// All in a single serialisable transaction.
func (s *Store) InsertSubscriptionCharge(ctx context.Context, in SubscriptionChargedInput) (int64, error) {
	var rows int64
	err := s.withinTx(ctx, func(tx pgxTxLike) error {
		var subID, merchantID, currency, payerAddress string
		var periodStart time.Time
		err := tx.QueryRow(ctx, `
			SELECT id, "merchantId", currency::text, "payerAddress", "currentPeriodEndAt"
			  FROM "Subscription"
			 WHERE "onchainSubscriptionId" = $1
		`, in.OnchainSubscriptionID.Int64()).Scan(&subID, &merchantID, &currency, &payerAddress, &periodStart)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// SubscriptionCreated may not have been processed yet (e.g.
				// out-of-order event delivery from RPC). Skip silently — a
				// later replay or reorg will resolve.
				return nil
			}
			return fmt.Errorf("subscription lookup: %w", err)
		}

		// 1) Insert SubscriptionCharge.
		var chargeID string
		err = tx.QueryRow(ctx, `
			INSERT INTO "SubscriptionCharge" (
			  id, "subscriptionId", "merchantId", "chargeAttemptId",
			  "periodStartAt", "periodEndAt",
			  amount, currency,
			  status, outcome, "scheduledAt", "executedAt", "onchainTxHash",
			  "createdAt", "updatedAt"
			) VALUES (
			  gen_random_uuid()::text, $1, $2, $3,
			  $4, $5,
			  $6, $7::"PaymentCurrency",
			  'succeeded'::"SubscriptionChargeStatus", 'charged'::"SubscriptionChargeOutcome",
			  $8, $8, $9,
			  NOW(), NOW()
			)
			ON CONFLICT ("chargeAttemptId") DO NOTHING
			RETURNING id
		`,
			subID, merchantID, in.ChargeAttemptID,
			periodStart, in.NextChargeAt,
			in.Amount, in.Currency(currency),
			in.BlockTimestamp, in.OnchainTxHash,
		).Scan(&chargeID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("insert charge: %w", err)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			// Existing row — fetch its id so the Transaction can link to it.
			if err := tx.QueryRow(ctx,
				`SELECT id FROM "SubscriptionCharge" WHERE "chargeAttemptId" = $1`,
				in.ChargeAttemptID).Scan(&chargeID); err != nil {
				return fmt.Errorf("lookup existing charge: %w", err)
			}
		}

		// 2) Insert Transaction(kind=subscription_charge), linked to both
		// the subscription and the charge.
		tag, err := tx.Exec(ctx, `
			INSERT INTO "Transaction" (
			  id, "merchantId", kind, status, "subscriptionId", "subscriptionChargeId",
			  amount, "feeAmount", "netAmount", currency,
			  "payerAddress", "merchantAddress",
			  "onchainTxHash", "blockNumber", "blockTimestamp", "logIndex",
			  mode, "createdAt"
			) VALUES (
			  gen_random_uuid()::text, $1, 'subscription_charge'::"TransactionKind",
			  'confirmed'::"TransactionStatus", $2, $3,
			  $4, $5, $6, $7::"PaymentCurrency",
			  $8, '',
			  $9, $10, $11, $12,
			  $13::"Mode", NOW()
			)
			ON CONFLICT ("onchainTxHash") DO NOTHING
		`,
			merchantID, subID, chargeID,
			in.Amount, in.FeeAmount, in.NetAmount, currency,
			payerAddress,
			in.OnchainTxHash, in.BlockNumber, in.BlockTimestamp, in.LogIndex,
			in.Mode,
		)
		if err != nil {
			return fmt.Errorf("insert tx: %w", err)
		}
		rows = tag.RowsAffected()

		// 3) Bump nextChargeAt + currentPeriod window.
		if _, err := tx.Exec(ctx, `
			UPDATE "Subscription"
			   SET "currentPeriodStartAt" = "currentPeriodEndAt",
			       "currentPeriodEndAt"   = $2,
			       "nextChargeAt"         = $2,
			       "updatedAt"            = NOW()
			 WHERE id = $1
		`, subID, in.NextChargeAt); err != nil {
			return fmt.Errorf("bump period: %w", err)
		}
		return nil
	})
	return rows, err
}

// Currency normalises possibly-null `currency` reads.
func (in SubscriptionChargedInput) Currency(fallback string) string {
	if fallback != "" {
		return fallback
	}
	return "USDC"
}

// SubscriptionChargeSkippedInput projects a failed-charge attempt.
type SubscriptionChargeSkippedInput struct {
	OnchainSubscriptionID *big.Int
	ChargeAttemptID       string
	Outcome               string // "insufficient_funds" / "revoked_approval" / "cancelled" / "skipped"
	BlockTimestamp        time.Time
}

// InsertSubscriptionChargeSkip persists a failed-charge attempt as a
// `SubscriptionCharge` with `status=failed`. Used for at-risk dashboards.
// Idempotent on `chargeAttemptId`.
func (s *Store) InsertSubscriptionChargeSkip(ctx context.Context, in SubscriptionChargeSkippedInput) (int64, error) {
	var rows int64
	err := s.withinTx(ctx, func(tx pgxTxLike) error {
		var subID, merchantID, currency string
		var amount string
		var periodStart, periodEnd time.Time
		err := tx.QueryRow(ctx, `
			SELECT id, "merchantId", currency::text, amount, "currentPeriodStartAt", "currentPeriodEndAt"
			  FROM "Subscription"
			 WHERE "onchainSubscriptionId" = $1
		`, in.OnchainSubscriptionID.Int64()).Scan(&subID, &merchantID, &currency, &amount, &periodStart, &periodEnd)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil
			}
			return fmt.Errorf("subscription lookup: %w", err)
		}

		tag, err := tx.Exec(ctx, `
			INSERT INTO "SubscriptionCharge" (
			  id, "subscriptionId", "merchantId", "chargeAttemptId",
			  "periodStartAt", "periodEndAt",
			  amount, currency,
			  status, outcome, "scheduledAt", "executedAt",
			  "createdAt", "updatedAt"
			) VALUES (
			  gen_random_uuid()::text, $1, $2, $3,
			  $4, $5,
			  $6, $7::"PaymentCurrency",
			  'failed'::"SubscriptionChargeStatus", $8::"SubscriptionChargeOutcome",
			  $9, $9,
			  NOW(), NOW()
			)
			ON CONFLICT ("chargeAttemptId") DO NOTHING
		`,
			subID, merchantID, in.ChargeAttemptID,
			periodStart, periodEnd, amount, currency,
			in.Outcome, in.BlockTimestamp,
		)
		if err != nil {
			return fmt.Errorf("insert charge skip: %w", err)
		}
		rows = tag.RowsAffected()

		// Move the subscription to `at_risk` — but only if the same
		// period doesn't already have a successful charge. Background:
		// the scheduler cron runs every minute. The chain confirms a
		// successful batchCharge in < 1s, but the indexer may take
		// several seconds to project the success. If the next sweep
		// fires in that window, the worker calls batchCharge again,
		// the contract recognises the chargeAttemptId as already used
		// and emits `SubscriptionChargeSkipped`. Naively projecting
		// that skip downgrades a payer who DID pay this period to
		// `at_risk` on the dashboard. Filter by the period boundaries
		// so an in-period success masks the duplicate skip.
		if _, err := tx.Exec(ctx, `
			UPDATE "Subscription"
			   SET status = 'at_risk'::"SubscriptionStatus",
			       "updatedAt" = NOW()
			 WHERE id = $1
			   AND status = 'active'::"SubscriptionStatus"
			   AND NOT EXISTS (
			     SELECT 1 FROM "SubscriptionCharge"
			      WHERE "subscriptionId" = $1
			        AND "periodStartAt" = $2
			        AND "periodEndAt" = $3
			        AND status = 'succeeded'::"SubscriptionChargeStatus"
			   )
		`, subID, periodStart, periodEnd); err != nil {
			return fmt.Errorf("flag at_risk: %w", err)
		}
		return nil
	})
	return rows, err
}

// MarkSubscriptionCancelled flips the on-chain-driven cancellation flag.
// Off-chain cancellation already happens in the API; this catches the
// case where the customer (or anyone authorised) invokes the contract
// directly.
func (s *Store) MarkSubscriptionCancelled(ctx context.Context, onchainSubID *big.Int, by, txHash string, blockTimestamp time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "Subscription"
		   SET status = 'cancelled'::"SubscriptionStatus",
		       "cancelledAt" = COALESCE("cancelledAt", $3),
		       "cancellationReason" = COALESCE("cancellationReason", $2),
		       "updatedAt" = NOW()
		 WHERE "onchainSubscriptionId" = $1
		   AND status NOT IN ('cancelled', 'lapsed')
	`, onchainSubID.Int64(), fmt.Sprintf("on-chain cancel by %s in tx %s", by, txHash), blockTimestamp)
	if err != nil {
		return 0, fmt.Errorf("cancel sub: %w", err)
	}
	return tag.RowsAffected(), nil
}

// ----- Refunds -----

// CompleteRefundByTxHash flips a Refund from `submitted` → `completed` once
// the on-chain ERC-20 Transfer is observed. Match is done by `refundTxHash`
// the merchant submitted via `POST /v1/refunds/:id/signature`.
func (s *Store) CompleteRefundByTxHash(ctx context.Context, refundTxHash string, blockTimestamp time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "Refund"
		   SET status = 'completed'::"RefundStatus",
		       "completedAt" = $2
		 WHERE "refundTxHash" = $1 AND status = 'submitted'::"RefundStatus"
	`, refundTxHash, blockTimestamp)
	if err != nil {
		return 0, fmt.Errorf("complete refund: %w", err)
	}
	return tag.RowsAffected(), nil
}

// ----- Agent jobs -----

// AgentJobStatusInput drives a single status transition.
type AgentJobStatusInput struct {
	OnchainJobID    *big.Int
	NewStatus       string // matches AgentJobStatus enum
	DeliverableHash string // optional, non-empty only for JobDelivered
	EscrowTxHash    string // non-empty only for JobCreated
	ReleaseTxHash   string // non-empty only for JobReleased
	BlockTimestamp  time.Time
	CompletedAt     bool // true for terminal states (JobReleased, JobCancelled)
}

// LinkAgentJobOnchain corresponds to `JobCreated`. Matches the off-chain
// AgentJob row by `vendorAddress` + missing `onchainJobId` (the API created
// the row with status=accepted before signing). If no off-chain row exists,
// we don't synthesise one — that path is owned by the API.
func (s *Store) LinkAgentJobOnchain(ctx context.Context, onchainJobID *big.Int, vendor, escrowTxHash string, blockTimestamp time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "AgentJob"
		   SET "onchainJobId" = $1,
		       "escrowTxHash" = $2,
		       status = 'in_progress'::"AgentJobStatus"
		 WHERE LOWER("vendorAddress") = LOWER($3)
		   AND "onchainJobId" IS NULL
	`, onchainJobID.Int64(), escrowTxHash, vendor)
	if err != nil {
		return 0, fmt.Errorf("link job: %w", err)
	}
	return tag.RowsAffected(), nil
}

// SetAgentJobStatus is the generic single-state transition used by every
// job lifecycle event after `JobCreated`. Idempotent (no-op when the
// status is already at-or-past target).
func (s *Store) SetAgentJobStatus(ctx context.Context, in AgentJobStatusInput) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "AgentJob"
		   SET status = $2::"AgentJobStatus",
		       "deliverableHash" = COALESCE(NULLIF($3, ''), "deliverableHash"),
		       "releaseTxHash"   = COALESCE(NULLIF($4, ''), "releaseTxHash"),
		       "completedAt"     = CASE WHEN $5 THEN COALESCE("completedAt", $6) ELSE "completedAt" END
		 WHERE "onchainJobId" = $1
		   AND status != $2::"AgentJobStatus"
	`,
		in.OnchainJobID.Int64(), in.NewStatus, in.DeliverableHash, in.ReleaseTxHash,
		in.CompletedAt, in.BlockTimestamp)
	if err != nil {
		return 0, fmt.Errorf("set job status: %w", err)
	}
	return tag.RowsAffected(), nil
}

// LogAgentJobEvent appends an `AuditLog` entry for every job lifecycle
// event so the merchant dashboard can render a chronological on-chain
// timeline. We use AuditLog (free-text action) rather than
// `AgentActivityLog` (constrained enum) because the indexer is mirroring
// on-chain state rather than recording actions the agent service itself
// took.
func (s *Store) LogAgentJobEvent(ctx context.Context, onchainJobID *big.Int, action string, metadata map[string]any) error {
	var jobID, merchantID string
	if err := s.pool.QueryRow(ctx,
		`SELECT id, "merchantId" FROM "AgentJob" WHERE "onchainJobId" = $1`,
		onchainJobID.Int64()).Scan(&jobID, &merchantID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // job not yet linked off-chain; log skipped
		}
		return fmt.Errorf("job lookup: %w", err)
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadata["onchainJobId"] = onchainJobID.String()
	return s.appendAuditWithMerchant(ctx, merchantID, auditEntry{
		Category:   "agent",
		Action:     action,
		TargetType: "AgentJob",
		TargetID:   jobID,
		Metadata:   metadata,
	})
}

// ----- Fee accruals -----

// LogFeeAccrued records `FeeAccrued` to AuditLog so the merchant dashboard
// can render a fee history. The on-chain ledger is the source of truth;
// this is just a denormalised view.
func (s *Store) LogFeeAccrued(ctx context.Context, onchainMerchantID *big.Int, token, amount, txHash string) error {
	merchantID, _, err := lookupMerchantByOnchainPool(ctx, s.pool, onchainMerchantID)
	if err != nil {
		// Merchant not linked yet (e.g., MerchantRegistered hasn't been
		// processed). No-op; a replay will pick this up after that lands.
		return nil
	}
	return s.appendAuditWithMerchant(ctx, merchantID, auditEntry{
		Category:   "agent",
		Action:     "fees.accrued",
		TargetType: "Merchant",
		TargetID:   merchantID,
		Metadata: map[string]any{
			"token":           strings.ToLower(token),
			"amount":          amount,
			"transactionHash": txHash,
		},
	})
}
