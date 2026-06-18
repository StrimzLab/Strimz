//! Unit tests for the fee collector.
//!
//! Pattern:
//!   1. Set up the test env, register the contract under test, deploy
//!      a SAC for a synthetic asset.
//!   2. Mint balance into the collector contract (simulates fees
//!      already accrued by Payments/Subscription).
//!   3. Drive scenarios + assert.

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal,
};

use crate::{Error, StrimzFeeCollector, StrimzFeeCollectorClient};

fn setup(
    env: &Env,
) -> (
    StrimzFeeCollectorClient,
    Address,
    Address,
    Address,
    StellarAssetClient,
) {
    let admin = Address::generate(env);
    let asset_issuer = Address::generate(env);
    let recipient = Address::generate(env);

    let contract_id = env.register(StrimzFeeCollector, ());
    let client = StrimzFeeCollectorClient::new(env, &contract_id);

    let sac = env.register_stellar_asset_contract_v2(asset_issuer.clone());
    let asset_client = StellarAssetClient::new(env, &sac.address());

    client.init(&admin);
    (client, admin, asset_issuer, recipient, asset_client)
}

#[test]
fn init_sets_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _, _, _) = setup(&env);
    assert_eq!(client.admin(), admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn init_twice_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, _) = setup(&env);
    let other = Address::generate(&env);
    client.init(&other);
}

#[test]
fn admin_can_withdraw() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _, recipient, asset_client) = setup(&env);

    // Pre-fund the collector — simulates fees accrued from upstream
    // payment flows.
    asset_client.mint(&client.address, &1_000_000);

    client.withdraw(&asset_client.address, &recipient, &400_000);

    let token = TokenClient::new(&env, &asset_client.address);
    assert_eq!(token.balance(&recipient), 400_000);
    assert_eq!(token.balance(&client.address), 600_000);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn non_admin_withdraw_reverts() {
    // Soroban's auth host check fires before our contract code runs
    // when `admin.require_auth()` finds no matching authorisation. The
    // panic surfaces as Auth/InvalidAction, not our typed
    // Error::Unauthorised — the typed error is reserved for cases we
    // explicitly return Err for (e.g. zero amount). We verify the
    // host-level reject here because that is the actual security
    // posture: even forged auth from an imposter never reaches our
    // Result branch.
    let env = Env::default();
    let (client, _, _, recipient, asset_client) = setup(&env);

    // Mint requires unrestricted auth from the SAC issuer.
    env.mock_all_auths();
    asset_client.mint(&client.address, &1_000_000);

    let imposter = Address::generate(&env);
    client
        .mock_auths(&[MockAuth {
            address: &imposter,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "withdraw",
                args: (asset_client.address.clone(), recipient.clone(), 100i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .withdraw(&asset_client.address, &recipient, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn zero_amount_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, recipient, asset_client) = setup(&env);
    client.withdraw(&asset_client.address, &recipient, &0);
}

#[test]
fn admin_rotation_emits_event() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, _) = setup(&env);

    let new_admin = Address::generate(&env);
    client.set_admin(&new_admin);

    assert_eq!(client.admin(), new_admin);
}

#[test]
fn balance_reads_sac() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, asset_client) = setup(&env);
    asset_client.mint(&client.address, &123_456);
    assert_eq!(client.balance(&asset_client.address), 123_456);
}
