# ADR (plain English): Keep Strimz's signing keys in Privy, with strict rules

- **Status:** Accepted 2026-11-22 by the founder. Only mainnet uses Privy; testnet keeps its current keys.
- **Date:** 2026-11-22
- **Issue:** #455

## What's the problem?

Strimz has three "robot" wallets that send transactions on their own:

- the **relayer**, which pays the network fee so customers can pay without gas;
- the **scheduler**, which charges subscriptions and sets fees;
- the **refund wallet**, which pays back the fee on a business's first $1,000.

On testnet their keys sit in a file on our server. That isn't good enough for real money. The server is shared with another project, and anyone who got in could copy the keys and use them from anywhere. We planned to use Amazon's key service, but Strimz isn't on Amazon any more, and the other key services cost money.

## What are we doing?

- **Privy holds the keys.** We already use Privy, and it's free for up to 50,000 signatures a month. The keys never come to our server.
- **Strict rules on each wallet.** Privy only signs what we allow:
  - the relayer only calls our payment, subscription and registry contracts;
  - the scheduler only charges, cancels and sets fees;
  - the refund wallet only sends USDC or EURC, at most 5 at a time.

  Anything else is refused.

- **Two keys for Privy:**
  - the **owner key** is held by the founder, never on the server. It's the only key that can change the rules;
  - the **server key** is on the server, and can only ask for signatures the rules allow.

  If someone broke into the server, they still couldn't change the rules or take the keys.

- **We tested it.** Privy signed real Arc transactions, testnet and mainnet. It refused a transaction the rules didn't allow.
- **We stay under the free limit.** We lower the daily number of fees Strimz pays to 1,500. Past that, customers pay their own small fee, so no sale is lost.

## What does it change?

- **Mainnet launches without paying for a key service** and without keys on the server.
- **If Privy is down,** customers pay their own small network fee for a while, and subscription charges and refunds wait a few minutes.
- **The founder does a one-time setup:**
  1. create two keys in the Privy dashboard;
  2. run one setup script;
  3. keep the owner key safe in the password manager.
