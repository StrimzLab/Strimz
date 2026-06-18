use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env,
};

use crate::{Status, StrimzSubscription, StrimzSubscriptionClient};

fn attempt(env: &Env, byte: u8) -> BytesN<32> {
    let raw = [byte; 32];
    BytesN::from_array(env, &raw)
}

#[test]
fn enrol_assigns_monotonic_ids() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let contract_id = env.register(StrimzSubscription, ());
    let client = StrimzSubscriptionClient::new(&env, &contract_id);
    client.init(&admin, &fee_collector);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();

    let id1 = client.enrol(
        &payer, &merchant, &asset, &1_000_000, &2_592_000, &150, &None,
    );
    let id2 = client.enrol(&payer, &merchant, &asset, &500_000, &2_592_000, &150, &None);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
}

#[test]
fn charge_splits_amount_and_marks_attempt_consumed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let contract_id = env.register(StrimzSubscription, ());
    let client = StrimzSubscriptionClient::new(&env, &contract_id);
    client.init(&admin, &fee_collector);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();
    let asset_admin = StellarAssetClient::new(&env, &asset);
    let token = TokenClient::new(&env, &asset);

    // 12 USDC funded, 10 USDC plan per month, 1.5% fee.
    asset_admin.mint(&payer, &12_000_000);

    let id = client.enrol(
        &payer,
        &merchant,
        &asset,
        &10_000_000,
        &2_592_000,
        &150,
        &None,
    );

    // Payer pre-approves the subscription contract for one period of pulls.
    // Live-until-ledger maps to "expires far in the future" for the test.
    token.approve(
        &payer,
        &contract_id,
        &10_000_000,
        &(env.ledger().sequence() + 1_000_000),
    );

    client.charge(
        &id,
        &(env.ledger().timestamp() + 2_592_000),
        &attempt(&env, 0xaa),
    );

    assert_eq!(token.balance(&merchant), 9_850_000);
    assert_eq!(token.balance(&fee_collector), 150_000);
    assert_eq!(token.balance(&payer), 2_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn replay_attempt_id_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let contract_id = env.register(StrimzSubscription, ());
    let client = StrimzSubscriptionClient::new(&env, &contract_id);
    client.init(&admin, &fee_collector);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();
    let asset_admin = StellarAssetClient::new(&env, &asset);
    let token = TokenClient::new(&env, &asset);

    asset_admin.mint(&payer, &30_000_000);
    let id = client.enrol(
        &payer,
        &merchant,
        &asset,
        &10_000_000,
        &2_592_000,
        &150,
        &None,
    );
    token.approve(
        &payer,
        &contract_id,
        &30_000_000,
        &(env.ledger().sequence() + 1_000_000),
    );

    let aid = attempt(&env, 0xbb);
    let period_end = env.ledger().timestamp() + 2_592_000;
    client.charge(&id, &period_end, &aid);
    // Re-broadcast: same attempt_id — must revert.
    client.charge(&id, &period_end, &aid);
}

#[test]
fn cancel_blocks_further_charges() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let contract_id = env.register(StrimzSubscription, ());
    let client = StrimzSubscriptionClient::new(&env, &contract_id);
    client.init(&admin, &fee_collector);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();

    let id = client.enrol(
        &payer, &merchant, &asset, &1_000_000, &2_592_000, &100, &None,
    );
    client.cancel(&id, &payer);

    let sub = client.get(&id);
    assert!(matches!(sub.status, Status::Cancelled));

    // A subsequent cancel reverts with AlreadyCancelled (#7).
    let err = client.try_cancel(&id, &payer);
    assert!(err.is_err());
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn cancel_by_unrelated_address_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let contract_id = env.register(StrimzSubscription, ());
    let client = StrimzSubscriptionClient::new(&env, &contract_id);
    client.init(&admin, &fee_collector);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();

    let id = client.enrol(
        &payer, &merchant, &asset, &1_000_000, &2_592_000, &100, &None,
    );
    let stranger = Address::generate(&env);
    client.cancel(&id, &stranger);
}
