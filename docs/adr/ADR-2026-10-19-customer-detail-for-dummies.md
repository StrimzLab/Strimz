# ADR for Dummies: A page for each customer

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19

## The Idea

The Customers page lists everyone who has paid you, but you can't click into one person. Our help page says you can, and that you'll see everything they've done. We'll build that page, and fix the help page where it describes things we don't do.

## What the Merchant Sees

1. **Click a customer** (their name, wallet, or "View customer" in the menu) to open their page.
2. **At the top:**
   - their name or email;
   - their full wallet address, with a copy button;
   - the email their receipts go to;
   - when you first saw them and when they were last active.
3. **Below, one box each for:**
   - their payments;
   - subscriptions;
   - transactions;
   - refunds;
   - invoices.

   Each item opens its own page. An empty box says what will show up there.

4. **Developers can do the same through the API and SDK:** they can ask for "this customer's payments" (or subscriptions, transactions, refunds, invoices), and find a customer by wallet address.

## Important Limitation

- **No lifetime value total:** USDC and EURC are different money, and we never add them together. A proper total per currency is a separate piece of work.
- **The latest 25 per box:** each box shows the newest 25 items, enough for most customers today.

## The Help Page Gets Corrected

- **No "Lifetime value" column.**
- **One email per customer:** we keep the first email a wallet gives you, and receipts go to that email. The help page currently says otherwise.

## What Changes

- A new customer page.
- Links from the Customers list.
- Customer filters in the API and SDK.
- Two database indexes so those filters stay fast.

## What Does Not Change

- How customers and their emails are recorded at checkout, how receipts are sent, and anything about payments themselves.
