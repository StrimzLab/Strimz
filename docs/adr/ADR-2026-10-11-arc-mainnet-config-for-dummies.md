# ADR for Dummies: Point Strimz at the real Arc mainnet

- **Status:** Accepted (2026-10-11, C1–C7 as recommended)
- **Date:** 2026-10-11

## The Idea

Strimz keeps one shared address book for Arc: the network's number, where to send
requests, where the explorer is, and the address of each coin and bridge contract. The
mainnet page of that book was written before Circle published mainnet, so it holds
guesses:

- the wrong network number (5040001 instead of 5042);
- web addresses for the network and the explorer that do not exist;
- testnet coin and bridge addresses, where nothing lives on mainnet. A euro payment on
  mainnet would have gone to an empty address.

It also says the gas coin has 6 decimal places when it has 18, so a wallet using our
definition would show balances a trillion times too large.

We replace the guesses with Circle's published values, each checked against the live
network, and add guard rails:

1. The address book throws an error when asked for a network it does not know, instead
   of handing back nothing.
2. In production, every service must be told which network it is on. Today a missing
   setting quietly means "testnet".
3. At startup in production, the API and the scheduler ask their network connection which
   network it is, and refuse to start if it is the wrong one.
4. The API takes coin addresses from the address book. If the server settings name a
   different address in production, it refuses to start.
5. The website stops being stuck on testnet: logins, checkout wallets, withdrawals and
   explorer links follow the network setting.

## What the Person Sees

- Merchants and payers on testnet: nothing changes.
- On mainnet: payments, withdrawals and links work from day one.
- The maintainer: the website's network setting (`NEXT_PUBLIC_ARC_ENVIRONMENT`) must be
  set on Vercel, or the next website build fails. The server settings must name the
  network, which the Lightsail settings already do.

## Important Limitation

If the network connection is down while the API or the scheduler restarts in production,
that service waits down until the connection is back. The indexer already works this
way. Checking contracts on the mainnet explorer is not proven yet; we find out at the
first mainnet deploy.

## Choices for the maintainer

- **C1.** Use Circle's published values, checked on the live network. Recommended.
- **C2.** Keep our own network definitions rather than upgrading the shared blockchain
  library everywhere. Recommended.
- **C3.** Unknown network names are errors, and production must name its network.
  Recommended. The alternative keeps "missing means testnet".
- **C4.** Coin addresses come from the address book; a contradicting server setting stops
  production. Recommended. The alternative removes the setting altogether.
- **C5.** Startup network check for the API and the scheduler, in production only.
  Recommended.
- **C6.** The website follows the network setting. Recommended. The alternative leaves the
  website testnet-only for now.
- **C7.** Update every doc and tool to the new web addresses now. Recommended.
