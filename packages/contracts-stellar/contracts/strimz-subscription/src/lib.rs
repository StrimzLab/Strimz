//! Strimz recurring subscriptions on Soroban.
//!
//! Mirrors the EVM `StrimzSubscriptions` contract, adapted for SEP-41
//! semantics:
//!
//! - **Enrolment** happens after the payer has called `token.approve`
//!   for an amount sufficient to cover the planned charges. The
//!   contract records the subscription's terms and emits an event the
//!   off-chain scheduler tracks.
//! - **Charging** is a `transfer_from` from the payer to the merchant
//!   plus a `transfer_from` to the fee collector, both pulled by THIS
//!   contract as the SEP-41 `spender`. Per-period idempotency keys
//!   (`attempt_id`) are persisted so a re-broadcast can never charge
//!   the same period twice.
//!
//! ## Allowance expiry
//!
//! SEP-41 `approve` carries a `live_until_ledger` — at that ledger the
//! allowance ceases to exist. The contract does NOT track this
//! directly (the SAC enforces it); the off-chain scheduler reads the
//! allowance state and warns the merchant before expiry. See
//! `OnchainAllowance` in the Strimz Postgres schema.
//!
//! ## Cancellation
//!
//! Either the payer (always) or the merchant (always) can cancel —
//! both are valid lifecycle endpoints. Cancellation marks the
//! subscription `cancelled`; the contract refuses to charge a
//! cancelled subscription. The payer can additionally revoke by
//! setting their on-chain allowance to zero, which causes future
//! charges to fail at the SAC layer.
//!
//! ## Events
//!
//! - `(strimz_v1, sub_enrol)` — `(subscription_id, payer, merchant, asset, amount, period_seconds)`
//! - `(strimz_v1, sub_chrg)` — `(subscription_id, attempt_id, period_end_at, amount, fee, net)`
//! - `(strimz_v1, sub_canc)` — `(subscription_id, cancelled_by)`

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
    Admin,
    FeeCollector,
    /// Monotonically increasing subscription counter.
    NextId,
    /// Subscription state by id.
    Sub(u64),
    /// `(subscription_id, attempt_id)` → () set of already-executed
    /// charges. Persistent — outlives instance TTL because the
    /// subscription's full life is much longer than the contract's
    /// idle TTL.
    Attempt(u64, BytesN<32>),
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum Status {
    Active,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Subscription {
    pub payer: Address,
    pub merchant: Address,
    pub asset: Address,
    /// Amount pulled per period (token smallest unit).
    pub amount_per_period: i128,
    pub period_seconds: u64,
    /// Fee charged per period, in bps of `amount_per_period`.
    pub fee_bps: u32,
    /// Optional end timestamp; `None` = open-ended.
    pub end_at: Option<u64>,
    pub status: Status,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialised = 1,
    NotInitialised = 2,
    InvalidAmount = 3,
    InvalidPeriod = 4,
    NotFound = 5,
    AlreadyCharged = 6,
    AlreadyCancelled = 7,
    NotAuthorised = 8,
    EndedSubscription = 9,
}

#[contract]
pub struct StrimzSubscription;

#[contractimpl]
impl StrimzSubscription {
    pub fn init(env: Env, admin: Address, fee_collector: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialised);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::FeeCollector, &fee_collector);
        env.storage().instance().set(&DataKey::NextId, &1u64);
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

    pub fn set_fee_collector(env: Env, fee_collector: Address) -> Result<(), Error> {
        let admin = Self::admin(env.clone())?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::FeeCollector, &fee_collector);
        Ok(())
    }

    pub fn get(env: Env, subscription_id: u64) -> Result<Subscription, Error> {
        env.storage()
            .persistent()
            .get::<_, Subscription>(&DataKey::Sub(subscription_id))
            .ok_or(Error::NotFound)
    }

    /// Records a new subscription. The payer's auth covers the
    /// enrolment (a no-money state change); the actual fund pull
    /// happens later via `charge()` and depends on the SEP-41
    /// allowance the payer separately granted.
    pub fn enrol(
        env: Env,
        payer: Address,
        merchant: Address,
        asset: Address,
        amount_per_period: i128,
        period_seconds: u64,
        fee_bps: u32,
        end_at: Option<u64>,
    ) -> Result<u64, Error> {
        if amount_per_period <= 0 || fee_bps > BPS_DENOMINATOR as u32 {
            return Err(Error::InvalidAmount);
        }
        if period_seconds == 0 {
            return Err(Error::InvalidPeriod);
        }

        payer.require_auth();

        let next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .ok_or(Error::NotInitialised)?;
        env.storage()
            .instance()
            .set(&DataKey::NextId, &(next_id + 1));

        let sub = Subscription {
            payer: payer.clone(),
            merchant: merchant.clone(),
            asset: asset.clone(),
            amount_per_period,
            period_seconds,
            fee_bps,
            end_at,
            status: Status::Active,
        };
        env.storage().persistent().set(&DataKey::Sub(next_id), &sub);

        env.events().publish(
            (EVENT_TAG, symbol_short!("sub_enrol")),
            (
                next_id,
                payer,
                merchant,
                asset,
                amount_per_period,
                period_seconds,
            ),
        );
        Ok(next_id)
    }

    /// Pulls a recurring charge. The merchant is the only party who
    /// can initiate; the contract uses its SEP-41 `transfer_from`
    /// allowance to draw from the payer. `attempt_id` is unique per
    /// (subscription, period) so a retry cannot double-charge.
    pub fn charge(
        env: Env,
        subscription_id: u64,
        period_end_at: u64,
        attempt_id: BytesN<32>,
    ) -> Result<(), Error> {
        let sub = Self::get(env.clone(), subscription_id)?;
        if let Status::Cancelled = sub.status {
            return Err(Error::AlreadyCancelled);
        }
        if let Some(end_at) = sub.end_at {
            if period_end_at > end_at {
                return Err(Error::EndedSubscription);
            }
        }
        let attempt_key = DataKey::Attempt(subscription_id, attempt_id.clone());
        if env.storage().persistent().has(&attempt_key) {
            return Err(Error::AlreadyCharged);
        }

        // The merchant initiates. The payer's authority for the
        // transfer is supplied by the SEP-41 allowance set up at
        // enrolment time, NOT by `require_auth` here.
        sub.merchant.require_auth();

        let fee_collector = Self::fee_collector(env.clone())?;
        let fee = sub.amount_per_period * (sub.fee_bps as i128) / BPS_DENOMINATOR;
        let net = sub.amount_per_period - fee;

        let token_client = token::TokenClient::new(&env, &sub.asset);
        let spender = env.current_contract_address();
        if net > 0 {
            token_client.transfer_from(&spender, &sub.payer, &sub.merchant, &net);
        }
        if fee > 0 {
            token_client.transfer_from(&spender, &sub.payer, &fee_collector, &fee);
        }

        env.storage().persistent().set(&attempt_key, &());

        env.events().publish(
            (EVENT_TAG, symbol_short!("sub_chrg")),
            (
                subscription_id,
                attempt_id,
                period_end_at,
                sub.amount_per_period,
                fee,
                net,
            ),
        );
        Ok(())
    }

    /// Cancel a subscription. Either the payer or the merchant may
    /// cancel. Subsequent `charge()` calls revert with `AlreadyCancelled`.
    pub fn cancel(env: Env, subscription_id: u64, cancelled_by: Address) -> Result<(), Error> {
        let mut sub = Self::get(env.clone(), subscription_id)?;
        if let Status::Cancelled = sub.status {
            return Err(Error::AlreadyCancelled);
        }
        if cancelled_by != sub.payer && cancelled_by != sub.merchant {
            return Err(Error::NotAuthorised);
        }
        cancelled_by.require_auth();

        sub.status = Status::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Sub(subscription_id), &sub);

        env.events().publish(
            (EVENT_TAG, symbol_short!("sub_canc")),
            (subscription_id, cancelled_by),
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests;
