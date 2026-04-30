// Package abi defines the event signatures the indexer cares about and
// provides a single decoder used by the projector layer.
//
// We don't pull in `abigen`-generated bindings because we only consume
// events (read-side); a hand-rolled decoder keeps the dependency surface
// minimal and the topic hashes auditable in source.
package abi

import (
	"errors"
	"fmt"
	"math/big"

	ethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// EventID is a topic[0] keccak hash of an event signature.
type EventID = common.Hash

// EventName is the canonical short name used in projector switch statements.
type EventName string

const (
	// Registry
	EventMerchantRegistered EventName = "MerchantRegistered"

	// Payments (one-shot)
	EventPaymentExecuted EventName = "PaymentExecuted"

	// Subscriptions
	EventSubscriptionCreated      EventName = "SubscriptionCreated"
	EventSubscriptionCharged      EventName = "SubscriptionCharged"
	EventSubscriptionChargeSkipped EventName = "SubscriptionChargeSkipped"
	EventSubscriptionCancelled    EventName = "SubscriptionCancelled"

	// Agent escrow (ERC-8183-style)
	EventJobCreated   EventName = "JobCreated"
	EventJobFunded    EventName = "JobFunded"
	EventJobStarted   EventName = "JobStarted"
	EventJobDelivered EventName = "JobDelivered"
	EventJobApproved  EventName = "JobApproved"
	EventJobReleased  EventName = "JobReleased"
	EventJobDisputed  EventName = "JobDisputed"
	EventJobCancelled EventName = "JobCancelled"

	// Fees (ledger-only at M1)
	EventFeeAccrued EventName = "FeeAccrued"

	// ERC-20 (used only for refund-completion detection)
	EventERC20Transfer EventName = "Transfer"
)

// Signatures maps each `EventName` to its canonical Solidity signature.
//
// Order of fields and types must match the Solidity event declarations in
// `packages/contracts/src/interfaces/*.sol` exactly. Any drift would cause
// silent decode failures, so changes here MUST be paired with the
// `TestEventTopicHashes_AreStable` regression test.
var Signatures = map[EventName]string{
	EventMerchantRegistered:        "MerchantRegistered(uint256,address,address,uint16)",
	EventPaymentExecuted:           "PaymentExecuted(uint256,address,address,uint256,uint256,uint256,bytes32)",
	EventSubscriptionCreated:       "SubscriptionCreated(uint256,uint256,address,address,uint256,uint32,uint64)",
	EventSubscriptionCharged:       "SubscriptionCharged(uint256,bytes32,uint256,uint256,uint256,uint64)",
	EventSubscriptionChargeSkipped: "SubscriptionChargeSkipped(uint256,bytes32,uint8)",
	EventSubscriptionCancelled:     "SubscriptionCancelled(uint256,address)",
	EventJobCreated:                "JobCreated(uint256,address,address,address,uint256)",
	EventJobFunded:                 "JobFunded(uint256,uint256)",
	EventJobStarted:                "JobStarted(uint256)",
	EventJobDelivered:              "JobDelivered(uint256,bytes32)",
	EventJobApproved:               "JobApproved(uint256,address)",
	EventJobReleased:               "JobReleased(uint256,address,uint256)",
	EventJobDisputed:               "JobDisputed(uint256,string)",
	EventJobCancelled:              "JobCancelled(uint256,string)",
	EventFeeAccrued:                "FeeAccrued(address,uint256,uint256)",
	EventERC20Transfer:             "Transfer(address,address,uint256)",
}

// TopicByName returns the keccak-256 of the event signature.
func TopicByName(n EventName) EventID {
	sig, ok := Signatures[n]
	if !ok {
		panic("abi: unknown event name " + string(n))
	}
	return crypto.Keccak256Hash([]byte(sig))
}

// NameByTopic resolves a topic[0] back to its event name. Cached at package
// init for O(1) lookup on the hot path.
func NameByTopic(topic EventID) (EventName, bool) {
	n, ok := topicLookup[topic]
	return n, ok
}

var topicLookup = func() map[EventID]EventName {
	m := make(map[EventID]EventName, len(Signatures))
	for name := range Signatures {
		m[TopicByName(name)] = name
	}
	return m
}()

// AllTopics returns every topic the indexer subscribes to. Used to build the
// `eth_getLogs` filter so the RPC node only returns logs we will actually
// decode.
func AllTopics() []EventID {
	out := make([]EventID, 0, len(Signatures))
	for name := range Signatures {
		out = append(out, TopicByName(name))
	}
	return out
}

// ----- Decoded payloads -----

// MerchantRegistered carries the on-chain merchant create event.
type MerchantRegistered struct {
	MerchantID    *big.Int
	Owner         common.Address
	PayoutAddress common.Address
	FeeBps        uint16
}

type PaymentExecuted struct {
	MerchantID *big.Int
	Payer      common.Address
	Token      common.Address
	Amount     *big.Int
	FeeAmount  *big.Int
	NetAmount  *big.Int
	Ref        [32]byte
}

type SubscriptionCreated struct {
	SubscriptionID *big.Int
	MerchantID     *big.Int
	Payer          common.Address
	Token          common.Address
	Amount         *big.Int
	IntervalSecs   uint32
	StartAt        uint64
}

type SubscriptionCharged struct {
	SubscriptionID  *big.Int
	ChargeAttemptID [32]byte
	Amount          *big.Int
	FeeAmount       *big.Int
	NetAmount       *big.Int
	NextChargeAt    uint64
}

type SubscriptionChargeSkipped struct {
	SubscriptionID  *big.Int
	ChargeAttemptID [32]byte
	Outcome         uint8 // ChargeOutcome enum
}

type SubscriptionCancelled struct {
	SubscriptionID *big.Int
	By             common.Address
}

type JobCreated struct {
	JobID  *big.Int
	Client common.Address
	Vendor common.Address
	Token  common.Address
	Amount *big.Int
}

type JobFunded struct {
	JobID  *big.Int
	Amount *big.Int
}

type JobStarted struct {
	JobID *big.Int
}

type JobDelivered struct {
	JobID            *big.Int
	DeliverableHash [32]byte
}

type JobApproved struct {
	JobID    *big.Int
	Assessor common.Address
}

type JobReleased struct {
	JobID  *big.Int
	Vendor common.Address
	Amount *big.Int
}

type JobDisputed struct {
	JobID  *big.Int
	Reason string
}

type JobCancelled struct {
	JobID  *big.Int
	Reason string
}

type FeeAccrued struct {
	Token      common.Address
	MerchantID *big.Int
	Amount     *big.Int
}

type ERC20Transfer struct {
	From  common.Address
	To    common.Address
	Value *big.Int
}

// ----- Decoder -----

// Decode parses a raw log into the typed payload appropriate for its
// topic[0]. Returns `(name, payload, true)` on success and `(_, _, false)`
// when the topic isn't one we care about (caller should skip silently).
func Decode(log types.Log) (EventName, interface{}, error) {
	if len(log.Topics) == 0 {
		return "", nil, errors.New("log has no topics")
	}
	name, ok := NameByTopic(log.Topics[0])
	if !ok {
		return "", nil, nil // not an event we subscribe to
	}
	payload, err := decoderFor(name)(log)
	if err != nil {
		return name, nil, fmt.Errorf("decode %s: %w", name, err)
	}
	return name, payload, nil
}

type decoder func(types.Log) (interface{}, error)

func decoderFor(n EventName) decoder {
	switch n {
	case EventMerchantRegistered:
		return decodeMerchantRegistered
	case EventPaymentExecuted:
		return decodePaymentExecuted
	case EventSubscriptionCreated:
		return decodeSubscriptionCreated
	case EventSubscriptionCharged:
		return decodeSubscriptionCharged
	case EventSubscriptionChargeSkipped:
		return decodeSubscriptionChargeSkipped
	case EventSubscriptionCancelled:
		return decodeSubscriptionCancelled
	case EventJobCreated:
		return decodeJobCreated
	case EventJobFunded:
		return decodeJobFunded
	case EventJobStarted:
		return decodeJobStarted
	case EventJobDelivered:
		return decodeJobDelivered
	case EventJobApproved:
		return decodeJobApproved
	case EventJobReleased:
		return decodeJobReleased
	case EventJobDisputed:
		return decodeJobDisputed
	case EventJobCancelled:
		return decodeJobCancelled
	case EventFeeAccrued:
		return decodeFeeAccrued
	case EventERC20Transfer:
		return decodeERC20Transfer
	default:
		return func(types.Log) (interface{}, error) {
			return nil, fmt.Errorf("no decoder for %s", n)
		}
	}
}

// ----- Per-event decoders -----
//
// Pattern:
//   - indexed args come from log.Topics[1..]
//   - non-indexed args come from log.Data, decoded via go-ethereum's `abi.Arguments.UnpackValues`

var (
	uint256Type, _ = ethabi.NewType("uint256", "", nil)
	uint64Type, _  = ethabi.NewType("uint64", "", nil)
	uint32Type, _  = ethabi.NewType("uint32", "", nil)
	uint16Type, _  = ethabi.NewType("uint16", "", nil)
	uint8Type, _   = ethabi.NewType("uint8", "", nil)
	addressType, _ = ethabi.NewType("address", "", nil)
	bytes32Type, _ = ethabi.NewType("bytes32", "", nil)
	stringType, _  = ethabi.NewType("string", "", nil)
)

func unpack(args ethabi.Arguments, data []byte) ([]interface{}, error) {
	return args.UnpackValues(data)
}

func decodeMerchantRegistered(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: addressType}, {Type: uint16Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &MerchantRegistered{
		MerchantID:    new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Owner:         common.BytesToAddress(log.Topics[2].Bytes()),
		PayoutAddress: vals[0].(common.Address),
		FeeBps:        vals[1].(uint16),
	}, nil
}

func decodePaymentExecuted(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 4); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: uint256Type}, {Type: uint256Type}, {Type: uint256Type}, {Type: bytes32Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &PaymentExecuted{
		MerchantID: new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Payer:      common.BytesToAddress(log.Topics[2].Bytes()),
		Token:      common.BytesToAddress(log.Topics[3].Bytes()),
		Amount:     vals[0].(*big.Int),
		FeeAmount:  vals[1].(*big.Int),
		NetAmount:  vals[2].(*big.Int),
		Ref:        vals[3].([32]byte),
	}, nil
}

func decodeSubscriptionCreated(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 4); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: addressType}, {Type: uint256Type}, {Type: uint32Type}, {Type: uint64Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &SubscriptionCreated{
		SubscriptionID: new(big.Int).SetBytes(log.Topics[1].Bytes()),
		MerchantID:     new(big.Int).SetBytes(log.Topics[2].Bytes()),
		Payer:          common.BytesToAddress(log.Topics[3].Bytes()),
		Token:          vals[0].(common.Address),
		Amount:         vals[1].(*big.Int),
		IntervalSecs:   vals[2].(uint32),
		StartAt:        vals[3].(uint64),
	}, nil
}

func decodeSubscriptionCharged(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: uint256Type}, {Type: uint256Type}, {Type: uint256Type}, {Type: uint64Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &SubscriptionCharged{
		SubscriptionID:  new(big.Int).SetBytes(log.Topics[1].Bytes()),
		ChargeAttemptID: bytes32From(log.Topics[2]),
		Amount:          vals[0].(*big.Int),
		FeeAmount:       vals[1].(*big.Int),
		NetAmount:       vals[2].(*big.Int),
		NextChargeAt:    vals[3].(uint64),
	}, nil
}

func decodeSubscriptionChargeSkipped(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: uint8Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &SubscriptionChargeSkipped{
		SubscriptionID:  new(big.Int).SetBytes(log.Topics[1].Bytes()),
		ChargeAttemptID: bytes32From(log.Topics[2]),
		Outcome:         vals[0].(uint8),
	}, nil
}

func decodeSubscriptionCancelled(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	return &SubscriptionCancelled{
		SubscriptionID: new(big.Int).SetBytes(log.Topics[1].Bytes()),
		By:             common.BytesToAddress(log.Topics[2].Bytes()),
	}, nil
}

func decodeJobCreated(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 4); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: addressType}, {Type: uint256Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &JobCreated{
		JobID:  new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Client: common.BytesToAddress(log.Topics[2].Bytes()),
		Vendor: common.BytesToAddress(log.Topics[3].Bytes()),
		Token:  vals[0].(common.Address),
		Amount: vals[1].(*big.Int),
	}, nil
}

func decodeJobFunded(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 2); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: uint256Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &JobFunded{
		JobID:  new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Amount: vals[0].(*big.Int),
	}, nil
}

func decodeJobStarted(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 2); err != nil {
		return nil, err
	}
	return &JobStarted{
		JobID: new(big.Int).SetBytes(log.Topics[1].Bytes()),
	}, nil
}

func decodeJobDelivered(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 2); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: bytes32Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &JobDelivered{
		JobID:           new(big.Int).SetBytes(log.Topics[1].Bytes()),
		DeliverableHash: vals[0].([32]byte),
	}, nil
}

func decodeJobApproved(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	return &JobApproved{
		JobID:    new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Assessor: common.BytesToAddress(log.Topics[2].Bytes()),
	}, nil
}

func decodeJobReleased(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: uint256Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &JobReleased{
		JobID:  new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Vendor: common.BytesToAddress(log.Topics[2].Bytes()),
		Amount: vals[0].(*big.Int),
	}, nil
}

func decodeJobDisputed(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 2); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: stringType}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &JobDisputed{
		JobID:  new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Reason: vals[0].(string),
	}, nil
}

func decodeJobCancelled(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 2); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: stringType}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &JobCancelled{
		JobID:  new(big.Int).SetBytes(log.Topics[1].Bytes()),
		Reason: vals[0].(string),
	}, nil
}

func decodeFeeAccrued(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: uint256Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &FeeAccrued{
		Token:      common.BytesToAddress(log.Topics[1].Bytes()),
		MerchantID: new(big.Int).SetBytes(log.Topics[2].Bytes()),
		Amount:     vals[0].(*big.Int),
	}, nil
}

func decodeERC20Transfer(log types.Log) (interface{}, error) {
	if err := mustTopics(log, 3); err != nil {
		return nil, err
	}
	args := ethabi.Arguments{{Type: uint256Type}}
	vals, err := unpack(args, log.Data)
	if err != nil {
		return nil, err
	}
	return &ERC20Transfer{
		From:  common.BytesToAddress(log.Topics[1].Bytes()),
		To:    common.BytesToAddress(log.Topics[2].Bytes()),
		Value: vals[0].(*big.Int),
	}, nil
}

func mustTopics(log types.Log, n int) error {
	if len(log.Topics) < n {
		return fmt.Errorf("expected %d topics, got %d", n, len(log.Topics))
	}
	return nil
}

func bytes32From(h common.Hash) [32]byte {
	var out [32]byte
	copy(out[:], h.Bytes())
	return out
}
