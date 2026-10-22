---
date: 2026-10-22
feature: Inline code renders as a chip without backticks
scope: fix
scenario-impact: none
---

# Inline code without backticks

Closes #334.

## What shipped

- **No backticks:** the Tailwind typography plugin put a literal backtick before and after every inline `code` in `.prose`. `globals.css` now drops them for every prose surface: the docs, the legal pages and the admin broadcast editor.
- **The chip shows:** the docs code-chip rule in `docs.css` targeted `[data-fd-content]`, which fumadocs 14.7.7 doesn't render, so it never applied. It now targets `#nd-page .prose`. Inline code gets the light grey chip with a border in light mode, and the dark chip in dark mode.
- **Code blocks:** unchanged.

## Not changed

- The other `docs.css` rules that target elements fumadocs doesn't render (the h2 divider and the active "On this page" colour). They are tracked in #343.
