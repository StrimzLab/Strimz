---
date: 2026-10-19
feature: Readable legal pages and broadcast editor (typography plugin with a Strimz theme)
scope: fix
scenario-impact: none
---

# Legal pages are readable again

Closes #316.

- **ADR:** `docs/adr/ADR-2026-10-19-legal-prose-styling.md` and its for-dummies companion.

## What shipped

- **The legal pages are formatted.** Terms, Privacy and Acceptable Use now have:
  - Sora section headings;
  - bulleted lists;
  - paragraph spacing;
  - green links that are readable in both themes.

  The "On this page" links land below the floating nav.

- **The admin broadcast editor** formats headings, bold text and lists while you type.
- **`@tailwindcss/typography@0.5.20`** is registered in `apps/web/src/styles/globals.css`. It ships CSS only.
- **`prose-strimz`** is a long-text colour theme on the theme tokens, so it follows the light/dark toggle.
- **A guard test** fails if `prose` classes are used without the plugin, or without `prose-strimz`.

## Operator steps

None. Web only; it deploys with the next Vercel build.
