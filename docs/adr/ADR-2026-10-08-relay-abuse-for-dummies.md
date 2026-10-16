# ADR for Dummies: Stop strangers from spending Strimz's gas money

- **Status:** Accepted 2026-10-10
- **Date:** 2026-10-08

## The Idea

When a customer pays through Strimz, Strimz sends the blockchain transaction and pays
the network fee ("gas") itself, so the customer does not need any. Today anyone with a
merchant API key can ask Strimz to send payments for any merchant, including fake
payments of a millionth of a dollar, and Strimz pays the gas every time. We make every
request prove which merchant and which checkout it belongs to, refuse payments under
1.00, and cap how many transactions Strimz will pay for per merchant per day.

## What the Person Sees

1. A customer opens a merchant's checkout page and pays, exactly as today. Behind the
   scenes the page talks to Strimz directly instead of going through a shared Strimz
   key.
2. A customer subscribing to a plan of any merchant can do so again. Today this only
   works for one merchant account, because of the shared key.
3. Someone who sends many payment requests in a short time from one internet address
   is told to slow down after 20 a minute.
4. A merchant whose own server sends payments to Strimz must now say which checkout each
   payment belongs to, and can only send payments to itself.
5. A merchant cannot create a product, plan, invoice or checkout under 1.00 any more.
6. If one merchant's checkouts suddenly ask Strimz for far more transactions than
   normal, Strimz emails an operator at 80% of the daily allowance and stops paying gas
   for that merchant at 100% until midnight UTC.

## Important Limitation

- Someone who is willing to really pay a merchant 1.00 at a time, or to put money in many
  wallets, can still use up that merchant's daily allowance and block its checkout for
  the rest of the day. The email alert is there so a person can act first.
- Limits per internet address are only as reliable as the server in front of Strimz,
  which must not let a visitor fake their address.
- Checkouts and plans already created below 1.00 stay where they are but can no longer
  be paid. We will count them before release.

## What Changes

- The checkout page sends payments to new public Strimz addresses tied to that one
  checkout or plan. The shared secret key the website used is deleted and switched off.
- Merchants calling Strimz's payment-sending API directly must include the checkout or
  plan id and can only pay themselves.
- Minimum payment and plan price of 1.00.
- A customer subscribing must hold at least one period's price in their wallet.
- Rate limits: 20 a minute per internet address on the checkout page, 60 a minute per
  merchant on the API.
- A daily allowance per merchant: 500 transactions on Free, 5,000 on Growth, 50,000 on
  Business and Enterprise, with an operator email at 80% and 100%.
- One new database table that counts each merchant's transactions and gas per day.

## What Does Not Change

- The smart contracts.
- What the customer signs in their wallet.
- Fees, payouts, webhooks and the SDK.
- Payments already sent.
