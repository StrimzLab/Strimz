//! Strimz one-shot payments on Soroban.
//!
//! Mirrors the EVM `StrimzPayments` contract: the payer authorises a
//! single `pay()` call; the contract atomically transfers the net
//! amount to the merchant + the protocol fee to the fee collector +
//! emits the projection event the indexer relies on.
//!
//! ## Auth model
//!
//! - `payer.require_auth()` covers BOTH the merchant transfer and the
//!   fee transfer in one authorisation. The payer's wallet (smart
//!   wallet or classic account) signs the contract invocation; the
//!   SAC's `transfer(payer, …)` checks that same auth context. No
//!   separate `approve` required.
//!
//! ## Idempotency
//!
//! - `ref_id` is the off-chain session id (32 bytes). The contract
//!   stores `(ref_id → ())` in persistent storage and rejects reuse,
//!   so a webhook retry, a relayer re-broadcast, or a malicious replay
//!   all converge on "exactly one settlement per session."
//!
//! ## Events
//!
//! - `(strimz_v1, payment)` — `(ref_id, payer, merchant, asset,
//!   amount, fee, net)`. Indexer-readable; tail-friendly so the
//!   projector can ignore the prefix when filtering.
//!
//! ## Errors
//!
//! - `Error::AlreadyInitialised` — `init` called twice
//! - `Error::NotInitialised` — any other call before init
//! - `Error::InvalidAmount` — amount ≤ 0 or fee_bps > 10_000
//! - `Error::AlreadySettled` — `ref_id` already used

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    Symbol,
};

const EVENT_TAG: Symbol = symbol_short!("strimz_v1");
const BPS_DENOMINATOR: i128 = 10_000;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    /// The fee collector contract that receives the protocol fee on
    /// every `pay()` call. Configured at init; rotatable by the admin.
    FeeCollector,
    /// Admin authorised to rotate the fee collector.
    Admin,
    /// `(ref_id → ())` set of settled payments. Persistent — these
    /// rows must outlive the contract instance's TTL, since a payment
    /// session is a once-in-a-lifetime event.
    Settled(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialised = 1,
    NotInitialised = 2,
    InvalidAmount = 3,
    AlreadySettled = 4,
}

#[contract]
pub struct StrimzPayments;

#[contractimpl]
impl StrimzPayments {
    /// One-shot init. Sets the admin + the fee-collector contract id.
    pub fn init(env: Env, admin: Address, fee_collector: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialised);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::FeeCollector, &fee_collector);
        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get::<_, Address>(&DataKey::Admin)
            .ok_or(Error::NotInitialised)
    }

    pub fn fee_collector(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get::<_, Address>(&DataKey::FeeCollector)
            .ok_or(Error::NotInitialised)
    }

    /// Rotate the fee collector. Admin-only.
    pub fn set_fee_collector(env: Env, fee_collector: Address) -> Result<(), Error> {
        let admin = Self::admin(env.clone())?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::FeeCollector, &fee_collector);
        Ok(())
    }

    /// True when this `ref_id` has already been settled.
    pub fn is_settled(env: Env, ref_id: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Settled(ref_id))
    }

    /// Settle a one-shot payment. The payer's auth covers both
    /// transfers (net to merchant, fee to fee collector). Idempotent
    /// on `ref_id`.
    pub fn pay(
        env: Env,
        payer: Address,
        merchant: Address,
        asset: Address,
        amount: i128,
        fee_bps: u32,
        ref_id: BytesN<32>,
    ) -> Result<(), Error> {
        if amount <= 0 || fee_bps > BPS_DENOMINATOR as u32 {
            return Err(Error::InvalidAmount);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Settled(ref_id.clone()))
        {
            return Err(Error::AlreadySettled);
        }

        payer.require_auth();

        let fee_collector = Self::fee_collector(env.clone())?;
        let fee = amount * (fee_bps as i128) / BPS_DENOMINATOR;
        let net = amount - fee;

        let token = token::TokenClient::new(&env, &asset);
        if net > 0 {
            token.transfer(&payer, &merchant, &net);
        }
        if fee > 0 {
            token.transfer(&payer, &fee_collector, &fee);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Settled(ref_id.clone()), &());

        env.events().publish(
            (EVENT_TAG, symbol_short!("payment")),
            (ref_id, payer, merchant, asset, amount, fee, net),
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests;
