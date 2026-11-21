# Our own sign-up and login screens (plain English)

- **Status:** Accepted 2026-11-21 by the founder. The admin console keeps the Privy modal.
- **Technical version:** [ADR-2026-11-21-custom-auth-screens](ADR-2026-11-21-custom-auth-screens.md)

## What's wrong today

People sign up and log in through a pop-up made by Privy, the company that handles our logins.

- We can't make it look like Strimz.
- It offers "Continue with a wallet", which we don't want.
- When its hidden "are you a robot?" check fails, the person is stuck with no explanation. That already happened to a tester.

## What we'll build

**Our own pages**, built with Privy's tools but designed by us:

- **Sign up:** "Continue with Google", or your email plus a 6-digit code we send you.
- **Log in:** the same two, plus "Sign in with a passkey".
- **No wallet option.**

**Passkeys.** A passkey lets you sign in with your fingerprint, face or device PIN instead of a code.

- New merchants can add one during setup. It's optional, and "Skip for now" always works.
- Anyone can add or remove passkeys in Settings → Security.

## Keeping bots out

There are two robot checks, and each one is enforced by a server:

1. **Privy's hidden check** stops scripts from requesting login codes or sign-ins from Privy in our name. It's on in Privy's dashboard. When it fails, our page now says so in plain words and offers "Try again".
2. **Our own Cloudflare check** guards account creation. Strimz creates a new account only after our server has confirmed it. Existing merchants never see it, and new merchants usually won't notice it.

We also close a side door. Today a background message from Privy can create a Strimz account by itself. After this change it can only update accounts that already exist.

## Who's affected

- **Merchants:** a cleaner sign-in, optional passkeys, and nobody loses access. Strimz has always required an email, so every existing merchant can sign in with an email code, or with Google if that's how they signed up.
- **Admins:** the admin console keeps the Privy pop-up for now, minus the wallet option.
- **Bots:** they can't create Strimz accounts any more without passing a check our server enforces.

## What it costs

- A big update of Privy's tools across three apps.
- New screens to test in light and dark themes and on phones.
- New merchants see a short, usually invisible, robot check once.

The terms-and-conditions checkbox (#508) comes next, on these same screens.
