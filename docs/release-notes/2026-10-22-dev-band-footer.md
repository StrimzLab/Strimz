---
date: 2026-10-22
feature: Compact developer band, business closing copy, fuller footer
scope: feat
scenario-impact: none
---

# Compact developer band, business closing copy, fuller footer

Closes #279.

## What shipped

- **Developer band:** now 517 px tall at 1440 × 900, down from 983 px. It has:
  - the same heading and a one-line paragraph;
  - three links (Server SDK, React pay button, OpenAPI) to their docs pages;
  - one code card with two short tabs (`checkout.tsx`, `webhooks.ts`);
  - **Read the docs**.

  The install cards and the 3D typing-keyboard animation are removed, along with its CSS.

- **Closing banner:** the sentence under the headline no longer mentions webhooks. The headline and the **Start free** / **Talk to us** buttons are unchanged.
- **Footer:** five columns (Product, Solutions, Developers, Company, Legal), built from the same list as the top nav, so the two stay in step.

## Not changed

- The look and motion of the closing banner and footer.
- The tour's typing caret, which keeps blinking through a renamed `caret-blink` keyframe.
