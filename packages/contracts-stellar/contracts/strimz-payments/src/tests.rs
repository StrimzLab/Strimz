use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env,
};

use crate::{StrimzPayments, StrimzPaymentsClient};

struct Setup {
    client: StrimzPaymentsClient<'static>,
    admin: Address,
    fee_collector: Address,
    payer: Address,
    merchant: Address,
    asset: Address,
    asset_admin: StellarAssetClient<'static>,
    token: TokenClient<'static>,
}

fn setup(env: &Env) -> Setup {
    let admin = Address::generate(env);
    let fee_collector = Address::generate(env);
    let payer = Address::generate(env);
    let merchant = Address::generate(env);

    let contract_id = env.register(StrimzPayments, ());
    // Pin a static lifetime by leaking the env reference into the
    // client — fine for tests since `env` outlives the test fn.
    let client: StrimzPaymentsClient<'static> = StrimzPaymentsClient::new(
        unsafe { core::mem::transmute::<&Env, &'static Env>(env) },
        &contract_id,
    );

    let sac = env.register_stellar_asset_contract_v2(Address::generate(env));
    let asset = sac.address();
    let asset_admin: StellarAssetClient<'static> = StellarAssetClient::new(
        unsafe { core::mem::transmute::<&Env, &'static Env>(env) },
        &asset,
    );
    let token: TokenClient<'static> = TokenClient::new(
        unsafe { core::mem::transmute::<&Env, &'static Env>(env) },
        &asset,
    );

    client.init(&admin, &fee_collector);
    Setup {
        client,
        admin,
        fee_collector,
        payer,
        merchant,
        asset,
        asset_admin,
        token,
    }
}

fn ref_id(env: &Env, byte: u8) -> BytesN<32> {
    let raw = [byte; 32];
    BytesN::from_array(env, &raw)
}

#[test]
fn happy_path_splits_amount_and_fee() {
    let env = Env::default();
    env.mock_all_auths();
    let s = setup(&env);

    // Fund the payer with USDC-equivalent. 10_000_000 = 10 USDC (6 dp).
    s.asset_admin.mint(&s.payer, &10_000_000);

    // 1.5% fee on 5 USDC → fee=75_000, net=4_925_000
    s.client.pay(
        &s.payer,
        &s.merchant,
        &s.asset,
        &5_000_000,
        &150,
        &ref_id(&env, 0xaa),
    );

    assert_eq!(s.token.balance(&s.merchant), 4_925_000);
    assert_eq!(s.token.balance(&s.fee_collector), 75_000);
    assert_eq!(s.token.balance(&s.payer), 5_000_000);
    assert!(s.client.is_settled(&ref_id(&env, 0xaa)));
}

#[test]
fn fee_bps_zero_routes_everything_to_merchant() {
    let env = Env::default();
    env.mock_all_auths();
    let s = setup(&env);
    s.asset_admin.mint(&s.payer, &1_000_000);
    s.client.pay(
        &s.payer,
        &s.merchant,
        &s.asset,
        &1_000_000,
        &0,
        &ref_id(&env, 0x01),
    );
    assert_eq!(s.token.balance(&s.merchant), 1_000_000);
    assert_eq!(s.token.balance(&s.fee_collector), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn replay_with_same_ref_id_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let s = setup(&env);
    s.asset_admin.mint(&s.payer, &10_000_000);

    let r = ref_id(&env, 0xbb);
    s.client
        .pay(&s.payer, &s.merchant, &s.asset, &1_000_000, &100, &r);
    // Same ref_id, second call — replay attempt.
    s.client
        .pay(&s.payer, &s.merchant, &s.asset, &1_000_000, &100, &r);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn zero_amount_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let s = setup(&env);
    s.client.pay(
        &s.payer,
        &s.merchant,
        &s.asset,
        &0,
        &100,
        &ref_id(&env, 0x02),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn fee_bps_over_max_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let s = setup(&env);
    s.asset_admin.mint(&s.payer, &1_000_000);
    s.client.pay(
        &s.payer,
        &s.merchant,
        &s.asset,
        &1_000_000,
        &10_001,
        &ref_id(&env, 0x03),
    );
}

#[test]
fn admin_can_rotate_fee_collector() {
    let env = Env::default();
    env.mock_all_auths();
    let s = setup(&env);
    let new_fc = Address::generate(&env);
    s.client.set_fee_collector(&new_fc);
    assert_eq!(s.client.fee_collector(), new_fc);
    // Sanity: original admin still wired.
    assert_eq!(s.client.admin(), s.admin);
}
