---
date: 2026-10-20
feature: Contact form explains what to fix, and accepts a blank company
scope: fix
scenario-impact: none
---

# The contact form says what to fix

Closes #321.

## What shipped

- **Plain messages:** the contact form no longer shows zod's default text such as "String must contain at least 2 character(s)". Each field says what to do:
  - **Name:** "Enter your name."
  - **Email:** "Enter an email we can reply to."
  - **Message:**
    - empty: "Tell us a little about what you need.";
    - fewer than 20 characters: "Add a little more detail (20 characters or more)."
  - **Too long:** each field gives its own limit, for example "Keep your message under 4,000 characters."
- **Linked errors:** each message has an id. Its input points at it with `aria-describedby` and is marked `aria-invalid`, so screen readers read the error with the field.
- **Dark mode:** error text uses a lighter red, so it stays readable.
- **Bug fix:** leaving the optional Company field empty no longer blocks sending. The empty input sent `""`, which the shared schema rejects (`min(1)`). The form now treats a blank company as not given.

## Not changed

- The API and the shared `contactRequestInputSchema` in `@strimz/shared-types`. The form builds on it in `apps/web/src/lib/contact-form.ts`, so no published package changes.
- The form's fields, the topics, Turnstile, and what gets sent to `POST /v1/contact`.
