package store

import (
	"context"
	"errors"
	"fmt"
	"math/big"

	"github.com/jackc/pgx/v5"
)

type OnchainLogRef struct {
	ChainID     int64
	TxHash      string
	LogIndex    uint
	BlockNumber uint64
}

func (r OnchainLogRef) auditID() string {
	return fmt.Sprintf("onchain:%d:%s:%d", r.ChainID, r.TxHash, r.LogIndex)
}

func (r OnchainLogRef) metadata(extra map[string]any) map[string]any {
	out := make(map[string]any, len(extra)+3)
	for k, v := range extra {
		out[k] = v
	}
	out["transactionHash"] = r.TxHash
	out["logIndex"] = r.LogIndex
	out["blockNumber"] = r.BlockNumber
	return out
}

type MerchantGovernanceInput struct {
	Log               OnchainLogRef
	OnchainMerchantID *big.Int
	Action            string
	Metadata          map[string]any
}

type ContractOperationInput struct {
	Log      OnchainLogRef
	Contract string
	Action   string
	Metadata map[string]any
}

func (s *Store) LogMerchantGovernance(ctx context.Context, in MerchantGovernanceInput) error {
	var merchantID *string
	targetID := fmt.Sprintf("onchain:%s", in.OnchainMerchantID.String())
	var linked string
	err := s.db().QueryRow(ctx,
		`SELECT id FROM "Merchant" WHERE "onchainMerchantId" = $1`,
		in.OnchainMerchantID.Int64()).Scan(&linked)
	switch {
	case err == nil:
		merchantID = &linked
		targetID = linked
	case errors.Is(err, pgx.ErrNoRows):
	default:
		return fmt.Errorf("governance merchant lookup: %w", err)
	}
	metadata := in.Log.metadata(in.Metadata)
	metadata["onchainMerchantId"] = in.OnchainMerchantID.String()
	return s.insertOnchainAudit(ctx, in.Log.auditID(), merchantID, auditEntry{
		Category:   "merchant",
		Action:     in.Action,
		TargetType: "Merchant",
		TargetID:   targetID,
		Metadata:   metadata,
	})
}

func (s *Store) LogContractOperation(ctx context.Context, in ContractOperationInput) error {
	return s.insertOnchainAudit(ctx, in.Log.auditID(), nil, auditEntry{
		Category:   "admin",
		Action:     in.Action,
		TargetType: "Contract",
		TargetID:   in.Contract,
		Metadata:   in.Log.metadata(in.Metadata),
	})
}

func (s *Store) insertOnchainAudit(ctx context.Context, id string, merchantID *string, e auditEntry) error {
	_, err := s.db().Exec(ctx, `
		INSERT INTO "AuditLog" (
		  id, "merchantId", category, action, "targetType", "targetId", metadata, "createdAt"
		) VALUES (
		  $1, $2, $3::"AuditActionCategory", $4, $5, $6, $7::jsonb, NOW()
		)
		ON CONFLICT (id) DO NOTHING
	`, id, merchantID, e.Category, e.Action, e.TargetType, e.TargetID, jsonOrEmpty(e.Metadata))
	if err != nil {
		return fmt.Errorf("insert %s audit row: %w", e.Action, err)
	}
	return nil
}
