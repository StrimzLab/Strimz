# The Safe page, in plain English

## The situation

Strimz's contracts are controlled by a shared account called a Safe. It has three keys: yours, your teammate's, and a recovery key kept offline. Any two must agree before anything happens. Safe's own website doesn't support Arc, so today the only way to use it is typing commands.

## What we're building

A **Safe page in the admin app**:

1. One of you picks an action from a short list:
   - pause the system;
   - withdraw fees;
   - turn the system back on;
   - change a role;
   - change who the owners are.
2. You approve it with your own wallet. Approving is a signature, not a payment, so it costs nothing.
3. Your teammate opens it, sees in plain words what it does, and approves too.
4. Either of you presses Execute. Strimz's own server wallet sends it and pays the small network fee, so neither of you needs funds in your wallet.

## Things to know

- **Emergency pause is instant.** As guardian, you can pause on your own, from your own wallet. It costs a fraction of a cent, the one fee you ever pay. Contracts only accept a pause from the guardian's own wallet.
- **Turning things back on is quick.** It needs two approvals, like everything else, but no waiting.
- **The deepest changes wait 48 hours.** Changing who holds top-level powers is built into the contracts to wait two days, so a stolen key can't quietly take over. You approve it, wait 48 hours, then approve it again to run it. Everyday roles, such as the server wallets' permissions, change at once with two approvals.

## Why it's safe

- There's no free-form "sign this code": only the actions on the list.
- One stolen key can do nothing, because every action needs two keys.
- The server wallet can only send what two of you have already signed.
