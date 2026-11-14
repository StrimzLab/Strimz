---
date: 2026-11-14
feature: Strimz UI Library colours on every surface, navy dark mode and a quieter hero
scope: web
scenario-impact: none
---

# UI Library colours, navy dark mode and a quieter hero

Closes #471. ADR: `docs/adr/ADR-2026-11-14-design-system-alignment.md` and its plain-English companion. The colour reference, taken from the designer's Figma UI Library, is `docs/design/strimz-design-system.md`.

- **Colour tokens in `packages/ui`.** Light mode uses the library's exact values:
  - text `#050020`, `#58556A` and `#8E8C9C`;
  - surfaces `#FFFFFF`, `#F9FAFB` and `#F3F4F6`;
  - border `#E5E7EB`;
  - focus `#100066`.
- **New status tokens** for success, warning and danger: a surface, text and border colour for each. About 140 hard-coded reds and ambers across the apps now use them.
- **Green text** (150 places) uses Primary 80 `#028D4B` in light mode and `#02C76A` in dark. Buttons and fills keep `#02C76A`.
- **Dark mode is Strimz navy in every app:** page `#050020`, cards `#0D0A27`, panels `#13102D`, borders `#26233F`. It replaces the generic near-black, as do the browser theme colour, the docs theme and the 3D button faces.
- **The hero on the homepage** loses the particle animation behind the dashboard card (`stream-field.tsx` deleted), the green glow and grain, and the border frame around the section. Nothing else on the page is removed.
- **The green lines under the navy "assurances" band** are now its bottom border, inside the rounded box.
- **Dashboard sidebar:**
  - hovering a link uses the secondary surface, not a white overlay that flashed in dark mode;
  - the onboarding card's white "Continue" button keeps navy text in dark mode, where it was white on white.
