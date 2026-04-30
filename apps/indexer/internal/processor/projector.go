package processor

import (
	"context"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	indabi "github.com/StrimzLab/strimz/apps/indexer/internal/abi"
	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

// Projector turns a decoded event into a database write. The dispatch table
// is exhaustive over `indabi.SubscribedEvents`; anything else is logged and
// skipped without failing the pipeline.
type Projector struct {
	store    *store.Store
	registry *indabi.Registry
	mode     string // "test" | "live"
	tokens   map[string]string // lowercase token addr → symbol (USDC/EURC)
	log      *slog.Logger
}

// NewProjector returns a ready-to-use projector. `mode` is fixed by the
// indexer's environment: testnet → "test", mainnet → "live".
func NewProjector(s *store.Store, registry *indabi.Registry, env string, tokens map[string]string) *Projector {
	mode := "test"
	if env == "mainnet" {
		mode = "live"
	}
	normalised := make(map[string]string, len(tokens))
	for k, v := range tokens {
		normalised[strings.ToLower(k)] = v
	}
	return &Projector{
		store:    s,
		registry: registry,
		mode:     mode,
		tokens:   normalised,
		log:      slog.Default().With("component", "projector"),
	}
}

// Apply decodes a single log and dispatches to the right writer.
//
// `blockTime` is supplied by the runner (resolved once per block, cached
// across all logs in that block).
func (p *Projector) Apply(ctx context.Context, lg types.Log, blockTime time.Time) error {
	name, payload, err := p.registry.Decode(lg)
	if err != nil {
		// Malformed event for a topic we own. Log and continue — a single
		// bad log shouldn't stall the whole pipeline.
		p.log.Warn("decode failed",
			"contract", lg.Address.Hex(),
			"tx", lg.TxHash.Hex(),
			"index", lg.Index,
			"err", err)
		return nil
	}
	if name == "" {
		return nil // not subscribed
	}

	switch name {
	// ----- Registry -----
	case indabi.EventMerchantRegistered:
		ev := payload.(*indabi.MerchantRegistered)
		_, err = p.store.LinkOnchainMerchant(ctx, ev.MerchantID, strings.ToLower(ev.PayoutAddress.Hex()))

	case indabi.EventMerchantPayoutAddressUpdated:
		ev := payload.(*indabi.MerchantPayoutAddressUpdated)
		_, err = p.store.UpdateMerchantPayoutAddress(ctx, ev.MerchantID, strings.ToLower(ev.NewPayoutAddress.Hex()))

	case indabi.EventMerchantActiveSet:
		ev := payload.(*indabi.MerchantActiveSet)
		_, err = p.store.SetMerchantActive(ctx, ev.MerchantID, ev.Active)

	case indabi.EventMerchantFeeBpsUpdated:
		ev := payload.(*indabi.MerchantFeeBpsUpdated)
		err = p.store.LogMerchantFeeBpsChange(ctx, ev.MerchantID, ev.NewFeeBps, lg.TxHash.Hex())

	case indabi.EventMerchantOwnerTransferred:
		ev := payload.(*indabi.MerchantOwnerTransferred)
		err = p.store.LogMerchantOwnerTransfer(ctx, ev.MerchantID, ev.NewOwner.Hex(), lg.TxHash.Hex())

	// ----- Payments -----
	case indabi.EventPaymentExecuted:
		ev := payload.(*indabi.PaymentExecuted)
		_, err = p.store.InsertOneShotTransaction(ctx, store.OneShotTxInput{
			MerchantOnchainID: ev.MerchantID,
			PayerAddress:      strings.ToLower(ev.Payer.Hex()),
			Amount:            ev.Amount.String(),
			FeeAmount:         ev.FeeAmount.String(),
			NetAmount:         ev.NetAmount.String(),
			Currency:          p.tokenSymbol(ev.Token),
			SessionRef:        decodeSessionRef(ev.Ref),
			OnchainTxHash:     lg.TxHash.Hex(),
			BlockNumber:       lg.BlockNumber,
			BlockTimestamp:    blockTime,
			LogIndex:          lg.Index,
			Mode:              p.mode,
		})

	// ----- Subscriptions -----
	case indabi.EventSubscriptionCreated:
		ev := payload.(*indabi.SubscriptionCreated)
		interval, intervalCount := store.IntervalFromSeconds(ev.IntervalSecs)
		startAt := time.Unix(int64(ev.StartAt), 0).UTC()
		nextCharge := startAt.Add(time.Duration(ev.IntervalSecs) * time.Second)
		_, err = p.store.UpsertSubscriptionFromOnchain(ctx, store.SubscriptionCreatedInput{
			OnchainSubscriptionID: ev.SubscriptionID,
			MerchantOnchainID:     ev.MerchantID,
			PayerAddress:          strings.ToLower(ev.Payer.Hex()),
			Currency:              p.tokenSymbol(ev.Token),
			Amount:                ev.Amount.String(),
			Interval:              interval,
			IntervalCount:         intervalCount,
			StartAt:               startAt,
			NextChargeAt:          nextCharge,
			OnchainTxHash:         lg.TxHash.Hex(),
			Mode:                  p.mode,
		})

	case indabi.EventSubscriptionCharged:
		ev := payload.(*indabi.SubscriptionCharged)
		_, err = p.store.InsertSubscriptionCharge(ctx, store.SubscriptionChargedInput{
			OnchainSubscriptionID: ev.SubscriptionID,
			ChargeAttemptID:       hexBytes32(ev.ChargeAttemptID),
			Amount:                ev.Amount.String(),
			FeeAmount:             ev.FeeAmount.String(),
			NetAmount:             ev.NetAmount.String(),
			NextChargeAt:          time.Unix(int64(ev.NextChargeAt), 0).UTC(),
			OnchainTxHash:         lg.TxHash.Hex(),
			BlockNumber:           lg.BlockNumber,
			BlockTimestamp:        blockTime,
			LogIndex:              lg.Index,
			Mode:                  p.mode,
		})

	case indabi.EventSubscriptionChargeSkipped:
		ev := payload.(*indabi.SubscriptionChargeSkipped)
		_, err = p.store.InsertSubscriptionChargeSkip(ctx, store.SubscriptionChargeSkippedInput{
			OnchainSubscriptionID: ev.SubscriptionID,
			ChargeAttemptID:       hexBytes32(ev.ChargeAttemptID),
			Outcome:               ev.Outcome.DBString(),
			BlockTimestamp:        blockTime,
		})

	case indabi.EventSubscriptionCancelled:
		ev := payload.(*indabi.SubscriptionCancelled)
		_, err = p.store.MarkSubscriptionCancelled(ctx, ev.SubscriptionID, strings.ToLower(ev.By.Hex()), lg.TxHash.Hex(), blockTime)

	// ----- Refunds (via ERC-20 Transfer) -----
	case indabi.EventERC20Transfer:
		_, err = p.store.CompleteRefundByTxHash(ctx, lg.TxHash.Hex(), blockTime)
		// Most ERC-20 Transfers won't match any pending refund — that's
		// fine. CompleteRefundByTxHash returns 0 rows in that case.

	// ----- Agent escrow (full lifecycle) -----
	case indabi.EventJobCreated:
		ev := payload.(*indabi.JobCreated)
		_, err = p.store.LinkAgentJobOnchain(ctx, ev.JobID, strings.ToLower(ev.Vendor.Hex()), lg.TxHash.Hex(), blockTime)
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.created", map[string]any{
				"client": strings.ToLower(ev.Client.Hex()),
				"vendor": strings.ToLower(ev.Vendor.Hex()),
				"token":  strings.ToLower(ev.Token.Hex()),
				"amount": ev.Amount.String(),
				"txHash": lg.TxHash.Hex(),
			})
		}

	case indabi.EventJobFunded:
		ev := payload.(*indabi.JobFunded)
		err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.funded", map[string]any{
			"amount": ev.Amount.String(),
			"txHash": lg.TxHash.Hex(),
		})

	case indabi.EventJobStarted:
		ev := payload.(*indabi.JobStarted)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "in_progress",
			BlockTimestamp: blockTime,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.started", map[string]any{"txHash": lg.TxHash.Hex()})
		}

	case indabi.EventJobDelivered:
		ev := payload.(*indabi.JobDelivered)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:    ev.JobID,
			NewStatus:       "delivered",
			DeliverableHash: hexBytes32(ev.DeliverableHash),
			BlockTimestamp:  blockTime,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.delivered", map[string]any{
				"deliverableHash": hexBytes32(ev.DeliverableHash),
				"txHash":          lg.TxHash.Hex(),
			})
		}

	case indabi.EventJobApproved:
		ev := payload.(*indabi.JobApproved)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "approved",
			BlockTimestamp: blockTime,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.approved", map[string]any{
				"assessor": strings.ToLower(ev.Assessor.Hex()),
				"txHash":   lg.TxHash.Hex(),
			})
		}

	case indabi.EventJobReleased:
		ev := payload.(*indabi.JobReleased)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "completed",
			ReleaseTxHash:  lg.TxHash.Hex(),
			BlockTimestamp: blockTime,
			CompletedAt:    true,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.released", map[string]any{
				"vendor": strings.ToLower(ev.Vendor.Hex()),
				"amount": ev.Amount.String(),
				"txHash": lg.TxHash.Hex(),
			})
		}

	case indabi.EventJobDisputed:
		ev := payload.(*indabi.JobDisputed)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "disputed",
			BlockTimestamp: blockTime,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.disputed", map[string]any{
				"reason": ev.Reason,
				"txHash": lg.TxHash.Hex(),
			})
		}

	case indabi.EventJobCancelled:
		ev := payload.(*indabi.JobCancelled)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "cancelled",
			BlockTimestamp: blockTime,
			CompletedAt:    true,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.cancelled", map[string]any{
				"reason": ev.Reason,
				"txHash": lg.TxHash.Hex(),
			})
		}

	// ----- Fees -----
	case indabi.EventFeeAccrued:
		ev := payload.(*indabi.FeeAccrued)
		err = p.store.LogFeeAccrued(ctx, ev.MerchantID,
			strings.ToLower(ev.Token.Hex()),
			ev.Amount.String(),
			lg.TxHash.Hex())

	default:
		p.log.Warn("unhandled subscribed event in dispatch", "name", string(name))
	}

	if err != nil {
		return fmt.Errorf("project %s: %w", name, err)
	}
	return nil
}

// tokenSymbol resolves a token contract address to its display symbol via
// the configured token map. Falls back to "USDC" when unknown.
func (p *Projector) tokenSymbol(token common.Address) string {
	if sym, ok := p.tokens[strings.ToLower(token.Hex())]; ok {
		return sym
	}
	return "USDC"
}

// decodeSessionRef interprets the bytes32 ref carried by `PaymentExecuted`.
// PaymentSession ids are CUIDs — printable ASCII, ≤ 32 chars. Anything that
// fails the ASCII check returns "" so the SQL layer treats it as "no
// matching session".
func decodeSessionRef(ref [32]byte) string {
	for i, b := range ref {
		if b == 0 {
			return string(ref[:i])
		}
		if b < 0x20 || b > 0x7E {
			return ""
		}
	}
	return string(ref[:])
}

func hexBytes32(b [32]byte) string {
	return "0x" + hex.EncodeToString(b[:])
}
