# ADR for Dummies: Less code on the homepage, a fuller footer

- **Status:** Accepted 2026-10-22
- **Date:** 2026-10-22

## The Idea

The homepage is for business owners, but the developer section takes more than a whole screen, with install commands, long code files and a 3D keyboard. We shrink it to one compact block and give the footer proper sections.

## What the Person Sees

1. **Developer section:** the same heading and a short paragraph, then:
   - three small links (Server SDK, React pay button, OpenAPI);
   - one code box with two short tabs, about 6 lines each;
   - **Read the docs**.

   It fits on one screen.

2. **The 3D keyboard animation is removed.** If you'd rather keep it, smaller, beside the code, say so.
3. **Closing banner:** the same headline and buttons. The sentence under it no longer mentions "webhooks".
4. **Footer:** five columns, the same groups as the top menu:
   - **Product:** subscriptions, recovery, refunds, invoices, analytics, payment links, storefront, pricing;
   - **Solutions:** SaaS, marketplaces, creators, agencies, global B2B;
   - **Developers:** docs, quickstart, SDKs, API reference, webhooks, GitHub;
   - **Company:** About, Contact;
   - **Legal**.

## What Does Not Change

- The look and motion of the closing banner and footer.
- "Talk to us" stays as it is. We don't say "Talk to sales", because there is no sales team.
- No "Sample" or "Live" labels, no network name, no comparisons.
