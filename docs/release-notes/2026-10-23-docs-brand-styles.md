---
date: 2026-10-23
feature: The docs pick up the Strimz palette, a rule above each section and the green "On this page" item
scope: fix
scenario-impact: none
---

# Docs brand styles

Closes #343.

## What shipped

- **The palette applies:**
  - **Before:** the docs layout imported `fumadocs-ui/style.css` and then `docs.css`, but Next decided the order. In dev it put fumadocs' theme after ours, so its neutral `:root` and `.dark` colours won. Older production builds split the two into separate CSS files.
  - **Now:** `docs.css` imports fumadocs itself, as its first line. The Strimz colours always come after it, in one file. A production build now shows fumadocs' `--fd-primary` first and ours last. On every docs page, in both themes:
  - links, the active sidebar item and the active "On this page" item are Strimz green;
  - dark mode uses the Strimz navy surfaces instead of fumadocs grey.
- **Section rule:** a soft line above each h2 after the first, in light and dark. The rule now targets `#nd-page .prose h2`.
- **Removed:** rules that matched nothing. The font rules (`.fd-page`, `[data-fd-content]`, `article`) are gone because `globals.css` already sets Sora and Poppins. The h1 weight rule is gone because fumadocs already renders 700. The `[data-fd-toc]` colour rule is gone because fumadocs colours the active item with the primary.

## Verification

- **New tests in `docs-surface.test.ts`:** they failed before the fix.
  - fumadocs is imported from `docs.css`, not from the layout.
  - Every id and data attribute in a `docs.css` selector appears in fumadocs' built output, and any class it uses is one of ours.
  - The h2 rule exists in both themes.
- **In the browser, light and dark:** the primary is green, the active TOC item is green, and the h2 rule shows. All 70 docs pages load.
