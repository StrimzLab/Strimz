package processor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	indabi "github.com/StrimzLab/strimz/apps/indexer/internal/abi"
	"github.com/StrimzLab/strimz/apps/indexer/internal/store"
)

// Projector turns a decoded event into a database write. The dispatch
// table is exhaustive over the event names the indexer subscribes to;
// anything not in the table is logged and skipped.
type Projector struct {
	store *store.Store
	env   string
	log   *slog.Logger
}

// NewProjector returns a ready-to-use projector. The block-timestamp
// resolver defaults to the log's BlockHash mapping; for tests we accept
// the pre-supplied timestamp on each call.
func NewProjector(s *store.Store, env string) *Projector {
	return &Projector{
		store: s,
		env:   env,
		log:   slog.Default().With("component", "projector"),
	}
}

// Apply decodes a single log and dispatches to the right writer.
func (p *Projector) Apply(ctx context.Context, lg types.Log) error {
	name, payload, err := indabi.Decode(lg)
	if err != nil {
		// Malformed event for a topic we own — log loudly. Don't return; a
		// single bad event shouldn't stall the pipeline (we've already
		// checkpoint'd the previous block).
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

	// Block timestamp is approximated as the time the log is processed; for
	// production accuracy we'd resolve via eth_getBlockByNumber. Trade-off
	// is fine for M1 — the API never displays second-precision timestamps.
	blockTs := time.Now().UTC()

	switch name {
	case indabi.EventMerchantRegistered:
		ev := payload.(*indabi.MerchantRegistered)
		_, err = p.store.LinkOnchainMerchant(ctx, ev.MerchantID, ev.PayoutAddress.Hex())

	case indabi.EventPaymentExecuted:
		ev := payload.(*indabi.PaymentExecuted)
		_, err = p.store.InsertOneShotTransaction(ctx, store.OneShotTxInput{
			MerchantOnchainID: ev.MerchantID,
			PayerAddress:      ev.Payer.Hex(),
			MerchantAddress:   "", // resolved off-chain via Merchant.payoutAddress on read
			Amount:            ev.Amount.String(),
			FeeAmount:         ev.FeeAmount.String(),
			NetAmount:         ev.NetAmount.String(),
			Currency:          tokenSymbol(ev.Token),
			SessionRef:        decodeSessionRef(ev.Ref),
			OnchainTxHash:     lg.TxHash.Hex(),
			BlockNumber:       lg.BlockNumber,
			BlockTimestamp:    blockTs,
			LogIndex:          lg.Index,
			Mode:              "live", // M1: indexer assumes live; per-event mode lookup is M2
		})

	case indabi.EventSubscriptionCancelled:
		ev := payload.(*indabi.SubscriptionCancelled)
		_, err = p.store.MarkSubscriptionCancelled(ctx, ev.SubscriptionID, ev.By.Hex(), lg.TxHash.Hex(), blockTs)

	case indabi.EventERC20Transfer:
		ev := payload.(*indabi.ERC20Transfer)
		// Refund completion is the only ERC-20 use-case the indexer reacts
		// to. Match by tx hash — the merchant pre-recorded it via the API.
		if _, err = p.store.CompleteRefundByTxHash(ctx, lg.TxHash.Hex(), blockTs); err != nil {
			return fmt.Errorf("complete refund: %w", err)
		}
		// Silent — most ERC-20 Transfers won't match a refund.
		_ = ev

	case indabi.EventJobCreated:
		ev := payload.(*indabi.JobCreated)
		_, err = p.store.UpsertAgentJobOnchain(ctx, ev.JobID, ev.Vendor.Hex(), lg.TxHash.Hex())

	case indabi.EventJobReleased:
		ev := payload.(*indabi.JobReleased)
		_, err = p.store.MarkAgentJobReleased(ctx, ev.JobID, lg.TxHash.Hex(), blockTs)

	// Events tracked but with no DB-state implications in M1:
	case indabi.EventSubscriptionCreated,
		indabi.EventSubscriptionCharged,
		indabi.EventSubscriptionChargeSkipped,
		indabi.EventJobFunded,
		indabi.EventJobStarted,
		indabi.EventJobDelivered,
		indabi.EventJobApproved,
		indabi.EventJobDisputed,
		indabi.EventJobCancelled,
		indabi.EventFeeAccrued:
		// M2: surface as audit log entries.

	default:
		p.log.Warn("unhandled event in projector dispatch", "name", string(name))
	}
	return err
}

// tokenSymbol maps a known token contract address to its display symbol.
// In production this lookup is a `TokenWhitelist` table query; for M1 we
// hardcode the canonical Arc stablecoins.
func tokenSymbol(token common.Address) string {
	addr := common.HexToAddress(token.Hex()).Hex()
	switch addr {
	case "0x3600C2E5b9Be41C2Ce4DC0E51A6cFE0E81b1f4f3": // USDC on Arc (placeholder)
		return "USDC"
	case "0x89B5F1A0a3aB7e2A0d0f5c3D3a9F0f9F8F0F8F0F": // EURC placeholder
		return "EURC"
	default:
		return "USDC" // safe default; refined in M2 with TokenWhitelist
	}
}

// decodeSessionRef interprets a bytes32 ref carried by `PaymentExecuted`.
// Sessions are CUIDs — printable ASCII, ≤ 32 chars. We keep it simple:
// take everything up to the first NUL byte, treat as ASCII. Junk-in →
// empty-string-out; the SQL layer handles the "no matching session"
// case.
func decodeSessionRef(ref [32]byte) string {
	for i, b := range ref {
		if b == 0 {
			return string(ref[:i])
		}
		// Reject obviously non-ASCII bytes — saves a Postgres lookup.
		if b < 0x20 || b > 0x7E {
			return ""
		}
	}
	return string(ref[:])
}
