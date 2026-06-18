//! Strimz protocol fee collector.
//!
//! Holds fees accrued from `strimz-payments` + `strimz-subscription`
//! by virtue of being the destination of their fee-transfer ops. The
//! contract itself does not call the token's `transfer_from` — fees
//! land here via the calling contract's `token.transfer(payer →
//! collector, fee)`. That keeps fee-accrual auth scoped to the payer
//! (who already authorised the parent payment) and avoids a separate
//! allowance dance.
//!
//! Only the `admin` may withdraw. Set once at init, rotatable via
//! `set_admin` (admin-only).
//!
//! ## Events
//!
//! - `(strimz_v1, fee_withdraw)` — `(asset, to, amount)`
//! - `(strimz_v1, admin_rotated)` — `(previous, next)`
//!
//! ## Errors
//!
//! - `Error::AlreadyInitialised` — `init` called twice
//! - `Error::NotInitialised` — any other call before init
//! - `Error::Unauthorised` — non-admin attempt at admin-only op

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
};

const EVENT_TAG: Symbol = symbol_short!("strimz_v1");

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialised = 1,
    NotInitialised = 2,
    Unauthorised = 3,
    InvalidAmount = 4,
}

#[contract]
pub struct StrimzFeeCollector;

#[contractimpl]
impl StrimzFeeCollector {
    /// One-shot init. Sets the admin who can withdraw + rotate.
    /// Subsequent calls revert with `AlreadyInitialised`.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialised);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Returns the current admin. Reverts if the contract hasn't been
    /// initialised (programming bug — uploaded but `init` was never
    /// invoked).
    pub fn admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get::<_, Address>(&DataKey::Admin)
            .ok_or(Error::NotInitialised)
    }

    /// Rotate the admin. Caller must be the current admin.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        let current = Self::admin(env.clone())?;
        current.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.events().publish(
            (EVENT_TAG, symbol_short!("admin_rot")),
            (current, new_admin),
        );
        Ok(())
    }

    /// Withdraw `amount` of `asset` to `to`. Caller must be the admin.
    /// `asset` is the SAC (Stellar Asset Contract) handle for the
    /// token being withdrawn — same address regardless of whether the
    /// token was originally classic or Soroban-native.
    pub fn withdraw(env: Env, asset: Address, to: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let admin = Self::admin(env.clone())?;
        admin.require_auth();

        let token = token::TokenClient::new(&env, &asset);
        token.transfer(&env.current_contract_address(), &to, &amount);

        env.events()
            .publish((EVENT_TAG, symbol_short!("fee_w")), (asset, to, amount));
        Ok(())
    }

    /// Read this collector's balance of `asset`. Convenience for
    /// off-chain dashboards — same value as
    /// `token.balance(env.current_contract_address())`.
    pub fn balance(env: Env, asset: Address) -> i128 {
        let token = token::TokenClient::new(&env, &asset);
        token.balance(&env.current_contract_address())
    }
}

#[cfg(test)]
mod tests;
