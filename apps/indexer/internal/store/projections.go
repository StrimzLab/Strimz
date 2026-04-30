package store

import (
	"context"
	"fmt"
	"math/big"
	"time"
)

// All write methods return `(rowsAffected int64, err error)` — callers can
// log "0 rows affected" as a no-op (idempotent re-projection) without
// confusing it with an error.

// LinkOnchainMerchant sets the on-chain merchant ID on whichever Merchant
// row owns the matching `payoutAddress`. We don't insert: a Merchant row
// is created off-chain via `/auth/sync` long before the on-chain transaction
// lands.
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

// InsertOneShotTransaction records a confirmed `PaymentExecuted` event.
// Idempotent on `(onchainTxHash, logIndex)` — replays no-op.
//
// `sessionRef` carries the bytes32 ref the contract emitted; if it matches a
// PaymentSession.id (cuid), we link `sessionId` and flip the session's
// status to `confirmed` in the same transaction.
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

		// Look up the merchant by on-chain id.
		var merchantID string
		if err := tx.QueryRow(ctx, `SELECT id FROM "Merchant" WHERE "onchainMerchantId" = $1`, in.MerchantOnchainID).Scan(&merchantID); err != nil {
			return fmt.Errorf("merchant lookup for onchain id %s: %w", in.MerchantOnchainID, err)
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
			in.PayerAddress, in.MerchantAddress,
			in.OnchainTxHash, in.BlockNumber, in.BlockTimestamp, in.LogIndex,
			in.Mode,
		)
		if err != nil {
			return fmt.Errorf("insert transaction: %w", err)
		}
		rows = tag.RowsAffected()

		if rows > 0 && sessionID != nil {
			// Confirm the session — if it was created off-chain, it now has
			// a real on-chain hit.
			if _, err := tx.Exec(ctx,
				`UPDATE "PaymentSession" SET status = 'confirmed'::"PaymentSessionStatus" WHERE id = $1 AND status != 'confirmed'`,
				*sessionID); err != nil {
				return fmt.Errorf("confirm session: %w", err)
			}
		}
		return nil
	})
	return rows, err
}

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

// MarkSubscriptionCancelled flips the on-chain-driven cancellation flag.
// Off-chain cancellation already happens in the API; this catches the
// case where the customer (the only other party with cancel rights)
// invokes the contract directly.
func (s *Store) MarkSubscriptionCancelled(ctx context.Context, onchainSubID *big.Int, by, txHash string, blockTimestamp time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "Subscription"
		   SET status = 'cancelled'::"SubscriptionStatus",
		       "cancelledAt" = COALESCE("cancelledAt", $3),
		       "cancellationReason" = COALESCE("cancellationReason", $2)
		 WHERE "onchainSubscriptionId" = $1
		   AND status NOT IN ('cancelled', 'lapsed')
	`, onchainSubID.Int64(), fmt.Sprintf("on-chain cancel by %s in tx %s", by, txHash), blockTimestamp)
	if err != nil {
		return 0, fmt.Errorf("cancel sub: %w", err)
	}
	return tag.RowsAffected(), nil
}

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

// UpsertAgentJobOnchain links an `AgentJob` row to its on-chain job id, or
// creates a stub if the off-chain row doesn't exist yet (rare — happens if
// the API and chain race on a job created directly by an agent).
func (s *Store) UpsertAgentJobOnchain(ctx context.Context, onchainJobID *big.Int, vendor, escrowTxHash string) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "AgentJob"
		   SET "onchainJobId" = $1,
		       "escrowTxHash" = $2,
		       status = 'in_progress'::"AgentJobStatus"
		 WHERE "vendorAddress" = $3 AND "onchainJobId" IS NULL
		 RETURNING id
	`, onchainJobID.Int64(), escrowTxHash, vendor)
	if err != nil {
		return 0, fmt.Errorf("link job: %w", err)
	}
	return tag.RowsAffected(), nil
}

// MarkAgentJobReleased sets the release tx and flips status when the
// vendor receives funds.
func (s *Store) MarkAgentJobReleased(ctx context.Context, onchainJobID *big.Int, releaseTxHash string, blockTimestamp time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE "AgentJob"
		   SET status = 'released'::"AgentJobStatus",
		       "releaseTxHash" = $2,
		       "completedAt" = $3
		 WHERE "onchainJobId" = $1
	`, onchainJobID.Int64(), releaseTxHash, blockTimestamp)
	if err != nil {
		return 0, fmt.Errorf("release job: %w", err)
	}
	return tag.RowsAffected(), nil
}

// pgxTxLike is the subset of pgx.Tx used by this package; declared
// explicitly so test fakes can stand in.
type pgxTxLike interface {
	Exec(ctx context.Context, sql string, args ...any) (pgxCommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgxRow
}

type pgxCommandTag interface {
	RowsAffected() int64
}

type pgxRow interface {
	Scan(dest ...any) error
}
