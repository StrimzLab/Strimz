package abi

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

var roleNames = func() map[common.Hash]string {
	names := map[common.Hash]string{{}: "DEFAULT_ADMIN_ROLE"}
	for constant, preimage := range map[string]string{
		"ADMIN_ROLE":              "STRIMZ_ADMIN_ROLE",
		"UPGRADER_ROLE":           "STRIMZ_UPGRADER_ROLE",
		"CHARGER_ROLE":            "STRIMZ_CHARGER_ROLE",
		"TOKEN_MANAGER_ROLE":      "STRIMZ_TOKEN_MANAGER_ROLE",
		"MERCHANT_REGISTRAR_ROLE": "STRIMZ_MERCHANT_REGISTRAR_ROLE",
		"FEE_ACCRUER_ROLE":        "STRIMZ_FEE_ACCRUER_ROLE",
		"TREASURY_ROLE":           "STRIMZ_TREASURY_ROLE",
		"AGENT_ADMIN_ROLE":        "STRIMZ_AGENT_ADMIN_ROLE",
		"PAUSER_ROLE":             "STRIMZ_PAUSER_ROLE",
		"FEE_MANAGER_ROLE":        "STRIMZ_FEE_MANAGER_ROLE",
		"DISPUTE_RESOLVER_ROLE":   "STRIMZ_DISPUTE_RESOLVER_ROLE",
		"PROPOSER_ROLE":           "PROPOSER_ROLE",
		"EXECUTOR_ROLE":           "EXECUTOR_ROLE",
		"CANCELLER_ROLE":          "CANCELLER_ROLE",
	} {
		names[crypto.Keccak256Hash([]byte(preimage))] = constant
	}
	return names
}()

func RoleName(role common.Hash) string {
	if name, ok := roleNames[role]; ok {
		return name
	}
	return role.Hex()
}
