package processor

import (
	"context"
	"encoding/hex"
	"fmt"
	"log/slog"
	"math/big"
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
	mode     string            // "test" | "live"
	tokens   map[string]string // lowercase token addr → symbol (USDC/EURC)
	log      *slog.Logger
	chainID  int64

	contractNames map[string]string
}

// NewProjector returns a ready-to-use projector. `mode` is fixed by the
// indexer's environment: testnet → "test", mainnet → "live".
func NewProjector(s *store.Store, registry *indabi.Registry, env string, chainID int64, tokens map[string]string) *Projector {
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
		chainID:  chainID,
		tokens:   normalised,
		log:      slog.Default().With("component", "projector"),
	}
}

func (p *Projector) WithContractNames(names map[string]string) *Projector {
	c := *p
	c.contractNames = make(map[string]string, len(names))
	for addr, name := range names {
		c.contractNames[strings.ToLower(addr)] = name
	}
	return &c
}

// WithStore returns a shallow copy of the projector whose writes go
// through the given store (typically a tx-scoped one from RunBatch).
func (p *Projector) WithStore(s *store.Store) *Projector {
	c := *p
	c.store = s
	return &c
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
		return fmt.Errorf("%w: decode %s log %s:%d: %v",
			store.ErrUnresolvable, lg.Address.Hex(), lg.TxHash.Hex(), lg.Index, err)
	}
	if name == "" {
		return nil // not subscribed
	}

	switch name {
	// ----- Registry -----
	case indabi.EventMerchantRegistered:
		ev := payload.(*indabi.MerchantRegistered)
		var linked int64
		linked, err = p.store.LinkOnchainMerchant(ctx, ev.MerchantID, lg.TxHash.Hex(), store.OnchainFee{
			FeeBps: ev.FeeBps, MaxFeeBps: ev.MaxFeeBps, TxHash: lg.TxHash.Hex(), At: blockTime,
		})
		if err == nil && linked == 0 {
			p.log.Warn("MerchantRegistered matched no merchant",
				"onchainMerchantId", ev.MerchantID.String(),
				"owner", strings.ToLower(ev.Owner.Hex()),
				"txHash", lg.TxHash.Hex())
		}

	case indabi.EventMerchantPayoutAddressUpdated:
		ev := payload.(*indabi.MerchantPayoutAddressUpdated)
		_, err = p.store.UpdateMerchantPayoutAddress(ctx, ev.MerchantID, strings.ToLower(ev.NewPayoutAddress.Hex()))

	case indabi.EventMerchantActiveSet:
		ev := payload.(*indabi.MerchantActiveSet)
		_, err = p.store.SetMerchantActive(ctx, ev.MerchantID, ev.Active)

	case indabi.EventMerchantFeeBpsUpdated:
		ev := payload.(*indabi.MerchantFeeBpsUpdated)
		var set int64
		set, err = p.store.SetMerchantOnchainFeeBps(ctx, ev.MerchantID, ev.NewFeeBps, lg.TxHash.Hex(), blockTime)
		if err == nil && set == 0 {
			p.warnUnlinkedFee(ev.MerchantID, lg)
		}
		if err == nil {
			err = p.store.LogMerchantFeeBpsChange(ctx, ev.MerchantID, ev.NewFeeBps, lg.TxHash.Hex())
		}

	case indabi.EventMerchantOwnershipTransferInitiated:
		ev := payload.(*indabi.MerchantOwnershipTransferInitiated)
		current, pending := lowerHex(ev.CurrentOwner), lowerHex(ev.PendingOwner)
		p.log.Warn("merchant ownership transfer initiated on-chain",
			"onchainMerchantId", ev.MerchantID.String(),
			"currentOwner", current,
			"pendingOwner", pending,
			"txHash", lg.TxHash.Hex())
		err = p.alertGovernance(ctx, lg, ev.MerchantID, "merchant.ownership_transfer_initiated_onchain", map[string]any{
			"currentOwner": current,
			"pendingOwner": pending,
			"acceptableAt": blockTime.Add(registryChangeDelay).Unix(),
		})

	case indabi.EventMerchantOwnershipTransferAccepted:
		ev := payload.(*indabi.MerchantOwnershipTransferAccepted)
		err = p.logGovernance(ctx, lg, ev.MerchantID, "merchant.ownership_transfer_accepted_onchain", map[string]any{
			"previousOwner": lowerHex(ev.PreviousOwner),
			"newOwner":      lowerHex(ev.NewOwner),
		})

	case indabi.EventMerchantOwnershipTransferCancelled:
		ev := payload.(*indabi.MerchantOwnershipTransferCancelled)
		err = p.logGovernance(ctx, lg, ev.MerchantID, "merchant.ownership_transfer_cancelled_onchain", nil)

	case indabi.EventMerchantPayoutChangeInitiated:
		ev := payload.(*indabi.MerchantPayoutChangeInitiated)
		newPayout := lowerHex(ev.NewPayoutAddress)
		p.log.Warn("merchant payout change initiated on-chain",
			"onchainMerchantId", ev.MerchantID.String(),
			"newPayoutAddress", newPayout,
			"commitAt", ev.CommitAt,
			"txHash", lg.TxHash.Hex())
		err = p.alertGovernance(ctx, lg, ev.MerchantID, "merchant.payout_change_initiated_onchain", map[string]any{
			"newPayoutAddress": newPayout,
			"commitAt":         ev.CommitAt,
		})

	case indabi.EventMerchantPayoutChangeCancelled:
		ev := payload.(*indabi.MerchantPayoutChangeCancelled)
		err = p.logGovernance(ctx, lg, ev.MerchantID, "merchant.payout_change_cancelled_onchain", nil)

	case indabi.EventMerchantMaxFeeBpsLowered:
		ev := payload.(*indabi.MerchantMaxFeeBpsLowered)
		var set int64
		set, err = p.store.SetMerchantOnchainMaxFeeBps(ctx, ev.MerchantID, ev.NewMaxFeeBps, lg.TxHash.Hex(), blockTime)
		if err == nil && set == 0 {
			p.warnUnlinkedFee(ev.MerchantID, lg)
		}
		if err == nil {
			err = p.logGovernance(ctx, lg, ev.MerchantID, "merchant.max_fee_bps_lowered_onchain", map[string]any{
				"newMaxFeeBps": int(ev.NewMaxFeeBps),
			})
		}

	// ----- Payments -----
	case indabi.EventPaymentExecuted:
		ev := payload.(*indabi.PaymentExecuted)
		currency, symErr := p.tokenSymbol(ev.Token)
		if symErr != nil {
			return fmt.Errorf("PaymentExecuted tx %s: %w", lg.TxHash.Hex(), symErr)
		}
		_, err = p.store.InsertOneShotTransaction(ctx, store.OneShotTxInput{
			MerchantOnchainID: ev.MerchantID,
			PayerAddress:      strings.ToLower(ev.Payer.Hex()),
			Amount:            ev.Amount.String(),
			FeeAmount:         ev.FeeAmount.String(),
			NetAmount:         ev.NetAmount.String(),
			Currency:          currency,
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
		currency, symErr := p.tokenSymbol(ev.Token)
		if symErr != nil {
			return fmt.Errorf("SubscriptionCreated tx %s: %w", lg.TxHash.Hex(), symErr)
		}
		interval, intervalCount := store.IntervalFromSeconds(ev.IntervalSecs)
		startAt := time.Unix(int64(ev.StartAt), 0).UTC()
		// The contract makes the first charge due at enrolment
		// (nextChargeAt = startAt). The first period still runs a full
		// interval, so it ends one interval out — otherwise the dashboard
		// shows a period that ended the moment it began.
		nextCharge := startAt
		periodEnd := startAt.Add(time.Duration(ev.IntervalSecs) * time.Second)
		_, err = p.store.UpsertSubscriptionFromOnchain(ctx, store.SubscriptionCreatedInput{
			OnchainSubscriptionID: ev.SubscriptionID,
			MerchantOnchainID:     ev.MerchantID,
			PayerAddress:          strings.ToLower(ev.Payer.Hex()),
			Currency:              currency,
			Amount:                ev.Amount.String(),
			Interval:              interval,
			IntervalCount:         intervalCount,
			StartAt:               startAt,
			BlockTimestamp:        blockTime,
			CurrentPeriodEndAt:    periodEnd,
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

	case indabi.EventSubscriptionPeriodsSkipped:
		ev := payload.(*indabi.SubscriptionPeriodsSkipped)
		_, err = p.store.RecordSubscriptionPeriodsSkipped(ctx, store.SubscriptionPeriodsSkippedInput{
			OnchainSubscriptionID: ev.SubscriptionID,
			PeriodsSkipped:        ev.PeriodsSkipped,
			PaidPeriodStart:       time.Unix(int64(ev.PaidPeriodStart), 0).UTC(),
			OnchainTxHash:         lg.TxHash.Hex(),
		})

	case indabi.EventSubscriptionChargeSkipped:
		ev := payload.(*indabi.SubscriptionChargeSkipped)
		_, err = p.store.InsertSubscriptionChargeSkip(ctx, store.SubscriptionChargeSkippedInput{
			OnchainSubscriptionID: ev.SubscriptionID,
			ChargeAttemptID:       hexBytes32(ev.ChargeAttemptID),
			Outcome:               ev.Outcome.DBString(),
			IsPaymentFailure:      ev.Outcome.IsPaymentFailure(),
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
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "funded",
			BlockTimestamp: blockTime,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.funded", map[string]any{
				"amount": ev.Amount.String(),
				"txHash": lg.TxHash.Hex(),
			})
		}

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
				"by":     strings.ToLower(ev.By.Hex()),
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

	case indabi.EventJobRefunded:
		ev := payload.(*indabi.JobRefunded)
		err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.refunded", map[string]any{
			"to":     strings.ToLower(ev.To.Hex()),
			"amount": ev.Amount.String(),
			"txHash": lg.TxHash.Hex(),
		})

	case indabi.EventJobResolved:
		ev := payload.(*indabi.JobResolved)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "resolved",
			ReleaseTxHash:  lg.TxHash.Hex(),
			BlockTimestamp: blockTime,
			CompletedAt:    true,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.resolved", map[string]any{
				"resolver": strings.ToLower(ev.Resolver.Hex()),
				"toVendor": ev.ToVendor.String(),
				"toClient": ev.ToClient.String(),
				"txHash":   lg.TxHash.Hex(),
			})
		}

	case indabi.EventJobReclaimed:
		ev := payload.(*indabi.JobReclaimed)
		_, err = p.store.SetAgentJobStatus(ctx, store.AgentJobStatusInput{
			OnchainJobID:   ev.JobID,
			NewStatus:      "reclaimed",
			ReleaseTxHash:  lg.TxHash.Hex(),
			BlockTimestamp: blockTime,
			CompletedAt:    true,
		})
		if err == nil {
			err = p.store.LogAgentJobEvent(ctx, ev.JobID, "job.reclaimed", map[string]any{
				"to":         strings.ToLower(ev.To.Hex()),
				"amount":     ev.Amount.String(),
				"fromStatus": ev.FromStatus,
				"txHash":     lg.TxHash.Hex(),
			})
		}

	// ----- Fees -----
	case indabi.EventFeeAccrued:
		ev := payload.(*indabi.FeeAccrued)
		err = p.store.LogFeeAccrued(ctx, ev.MerchantID,
			strings.ToLower(ev.Token.Hex()),
			ev.Amount.String(),
			lg.TxHash.Hex())

	case indabi.EventPaused:
		ev := payload.(*indabi.Paused)
		err = p.logAdminEvent(ctx, lg, "contract.paused", map[string]any{"account": lowerHex(ev.Account)})

	case indabi.EventUnpaused:
		ev := payload.(*indabi.Unpaused)
		err = p.logAdminEvent(ctx, lg, "contract.unpaused", map[string]any{"account": lowerHex(ev.Account)})

	case indabi.EventRoleGranted, indabi.EventRoleRevoked:
		ev := payload.(*indabi.RoleChanged)
		action := "contract.role_granted"
		if name == indabi.EventRoleRevoked {
			action = "contract.role_revoked"
		}
		role := common.Hash(ev.Role)
		err = p.logAdminEvent(ctx, lg, action, map[string]any{
			"role":     role.Hex(),
			"roleName": indabi.RoleName(role),
			"account":  lowerHex(ev.Account),
			"sender":   lowerHex(ev.Sender),
		})

	case indabi.EventRoleAdminChanged:
		ev := payload.(*indabi.RoleAdminChanged)
		role, previous, next := common.Hash(ev.Role), common.Hash(ev.PreviousAdminRole), common.Hash(ev.NewAdminRole)
		err = p.logAdminEvent(ctx, lg, "contract.role_admin_changed", map[string]any{
			"role":                  role.Hex(),
			"roleName":              indabi.RoleName(role),
			"previousAdminRole":     previous.Hex(),
			"previousAdminRoleName": indabi.RoleName(previous),
			"newAdminRole":          next.Hex(),
			"newAdminRoleName":      indabi.RoleName(next),
		})

	case indabi.EventUpgraded:
		ev := payload.(*indabi.Upgraded)
		err = p.logAdminEvent(ctx, lg, "contract.upgraded", map[string]any{"implementation": lowerHex(ev.Implementation)})

	case indabi.EventCallScheduled:
		ev := payload.(*indabi.CallScheduled)
		err = p.logAdminEvent(ctx, lg, "timelock.call_scheduled", map[string]any{
			"operationId": common.Hash(ev.ID).Hex(),
			"index":       ev.Index.String(),
			"target":      lowerHex(ev.Target),
			"value":       ev.Value.String(),
			"data":        "0x" + hex.EncodeToString(ev.Data),
			"predecessor": common.Hash(ev.Predecessor).Hex(),
			"delay":       ev.Delay.String(),
		})

	case indabi.EventCallExecuted:
		ev := payload.(*indabi.CallExecuted)
		err = p.logAdminEvent(ctx, lg, "timelock.call_executed", map[string]any{
			"operationId": common.Hash(ev.ID).Hex(),
			"index":       ev.Index.String(),
			"target":      lowerHex(ev.Target),
			"value":       ev.Value.String(),
			"data":        "0x" + hex.EncodeToString(ev.Data),
		})

	case indabi.EventCancelled:
		ev := payload.(*indabi.Cancelled)
		err = p.logAdminEvent(ctx, lg, "timelock.cancelled", map[string]any{"operationId": common.Hash(ev.ID).Hex()})

	case indabi.EventMinDelayChange:
		ev := payload.(*indabi.MinDelayChange)
		err = p.logAdminEvent(ctx, lg, "timelock.min_delay_changed", map[string]any{
			"oldDuration": ev.OldDuration.String(),
			"newDuration": ev.NewDuration.String(),
		})

	case indabi.EventAgentRegistered:
		ev := payload.(*indabi.AgentRegistered)
		err = p.logAgentRegistry(ctx, lg, ev.Agent, "agent.registered", map[string]any{
			"controller":       lowerHex(ev.Controller),
			"credentialDigest": common.Hash(ev.CredentialDigest).Hex(),
			"name":             ev.Name,
			"version":          ev.Version,
		})

	case indabi.EventAgentCredentialRotated:
		ev := payload.(*indabi.AgentCredentialRotated)
		err = p.logAgentRegistry(ctx, lg, ev.Agent, "agent.credential_rotated", map[string]any{
			"newCredentialDigest": common.Hash(ev.NewCredentialDigest).Hex(),
		})

	case indabi.EventAgentReputationAdjusted:
		ev := payload.(*indabi.AgentReputationAdjusted)
		err = p.logAgentRegistry(ctx, lg, ev.Agent, "agent.reputation_adjusted", map[string]any{
			"delta":    ev.Delta.String(),
			"newScore": ev.NewScore.String(),
		})

	case indabi.EventAgentDeactivated:
		ev := payload.(*indabi.AgentStatusChanged)
		err = p.logAgentRegistry(ctx, lg, ev.Agent, "agent.deactivated", map[string]any{})

	case indabi.EventAgentActivated:
		ev := payload.(*indabi.AgentStatusChanged)
		err = p.logAgentRegistry(ctx, lg, ev.Agent, "agent.activated", map[string]any{})

	case indabi.EventDependencyUpdated:
		ev := payload.(*indabi.DependencyUpdated)
		err = p.logContractOperation(ctx, lg, "contract.dependency_updated", map[string]any{
			"name":       ev.Name,
			"newAddress": lowerHex(ev.NewAddress),
		})

	case indabi.EventFeeWithdrawn:
		ev := payload.(*indabi.FeeWithdrawn)
		err = p.logContractOperation(ctx, lg, "fees.withdrawn", map[string]any{
			"token":  lowerHex(ev.Token),
			"to":     lowerHex(ev.To),
			"amount": ev.Amount.String(),
		})

	case indabi.EventTokenAdded:
		ev := payload.(*indabi.TokenAdded)
		token := lowerHex(ev.Token)
		if _, known := p.tokens[token]; !known {
			p.log.Error("whitelisted token is not in STABLECOIN_ADDRESSES; its payments will park until the config lists it",
				"token", token,
				"txHash", lg.TxHash.Hex())
		}
		err = p.logContractOperation(ctx, lg, "token_whitelist.token_added", map[string]any{"token": token})

	case indabi.EventTokenRemoved:
		ev := payload.(*indabi.TokenRemoved)
		err = p.logContractOperation(ctx, lg, "token_whitelist.token_removed", map[string]any{"token": lowerHex(ev.Token)})

	case indabi.EventTokenCapabilitiesSet:
		ev := payload.(*indabi.TokenCapabilitiesSet)
		err = p.logContractOperation(ctx, lg, "token_whitelist.capabilities_set", map[string]any{
			"token":        lowerHex(ev.Token),
			"capabilities": ev.Capabilities,
		})

	default:
		p.log.Warn("unhandled subscribed event in dispatch", "name", string(name))
	}

	if err != nil {
		return fmt.Errorf("project %s: %w", name, err)
	}
	return nil
}

func (p *Projector) warnUnlinkedFee(onchainMerchantID *big.Int, lg types.Log) {
	p.log.Warn("registry fee event matched no merchant",
		"onchainMerchantId", onchainMerchantID.String(),
		"txHash", lg.TxHash.Hex())
}

func (p *Projector) logRef(lg types.Log) store.OnchainLogRef {
	return store.OnchainLogRef{
		ChainID:     p.chainID,
		TxHash:      lg.TxHash.Hex(),
		LogIndex:    lg.Index,
		BlockNumber: lg.BlockNumber,
	}
}

func (p *Projector) logGovernance(ctx context.Context, lg types.Log, onchainMerchantID *big.Int, action string, metadata map[string]any) error {
	return p.store.LogMerchantGovernance(ctx, store.MerchantGovernanceInput{
		Log:               p.logRef(lg),
		OnchainMerchantID: onchainMerchantID,
		Action:            action,
		Metadata:          metadata,
	})
}

// registryChangeDelay matches StrimzRegistry.PAYOUT_CHANGE_DELAY, which also
// gates ownership acceptance.
const registryChangeDelay = 24 * time.Hour

// alertGovernance also queues an admin alert and, for a linked merchant, an email.
func (p *Projector) alertGovernance(ctx context.Context, lg types.Log, onchainMerchantID *big.Int, action string, metadata map[string]any) error {
	return p.store.LogMerchantGovernance(ctx, store.MerchantGovernanceInput{
		Log:               p.logRef(lg),
		OnchainMerchantID: onchainMerchantID,
		Action:            action,
		Metadata:          metadata,
		Alert:             true,
	})
}

func (p *Projector) logContractOperation(ctx context.Context, lg types.Log, action string, metadata map[string]any) error {
	return p.store.LogContractOperation(ctx, store.ContractOperationInput{
		Log:      p.logRef(lg),
		Contract: lowerHex(lg.Address),
		Action:   action,
		Metadata: p.withContractName(lg, metadata),
	})
}

func (p *Projector) logAdminEvent(ctx context.Context, lg types.Log, action string, metadata map[string]any) error {
	return p.store.LogContractOperation(ctx, store.ContractOperationInput{
		Log:      p.logRef(lg),
		Contract: lowerHex(lg.Address),
		Action:   action,
		Metadata: p.withContractName(lg, metadata),
		Alert:    true,
	})
}

func (p *Projector) logAgentRegistry(ctx context.Context, lg types.Log, agent common.Address, action string, metadata map[string]any) error {
	return p.store.LogAgentRegistryEvent(ctx, store.AgentRegistryInput{
		Log:      p.logRef(lg),
		Agent:    lowerHex(agent),
		Action:   action,
		Metadata: p.withContractName(lg, metadata),
	})
}

func (p *Projector) withContractName(lg types.Log, metadata map[string]any) map[string]any {
	if name, ok := p.contractNames[lowerHex(lg.Address)]; ok {
		metadata["contractName"] = name
	}
	return metadata
}

func lowerHex(a common.Address) string {
	return strings.ToLower(a.Hex())
}

// tokenSymbol resolves a token contract address to its display symbol via
// the configured token map. Falls back to "USDC" when unknown.
func (p *Projector) tokenSymbol(token common.Address) (string, error) {
	addr := strings.ToLower(token.Hex())
	if sym, ok := p.tokens[addr]; ok {
		return sym, nil
	}
	return "", fmt.Errorf("%w: token %s is not in STABLECOIN_ADDRESSES", store.ErrUnresolvable, addr)
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
