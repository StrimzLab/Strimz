# ADR: Strimz UI Library colours on every surface, and a quieter hero

- **Status:** Accepted 2026-11-14
- **Date:** 2026-11-14
- **Scope:**
  - `packages/ui` colour tokens, which reach web, docs, dashboard, admin and checkout;
  - three removals in the marketing hero.

  Fanline keeps its own brand. No component, layout, motion, contract, schema, API or published-package change.

## Context

A teammate said the new homepage "looks vibe coded". The founder asked for exactly three hero changes, and for every surface to use the colours of the Strimz UI Library, the designer's Figma file (81 frames exported). Those colours are recorded in `docs/design/strimz-design-system.md`.

The library follows the Tailwind scale pattern. Its grey and state scales match Flowbite's Tailwind palette (gray-900 `#111928`, red-800 `#9B1C1C`, yellow-900 `#723B13`).

What differs from the code today:

- **Green text.** Green text and links use `#02C76A`. The library uses Primary 80 `#028D4B` for green text, links and borders, and keeps `#02C76A` for fills.
- **Status colours.** Success, warning and danger are ad hoc per screen. The library defines a surface, text and border colour for each.
- **Dark mode.** Every app uses a generic near-black (`#0B0B12`), which is not a Strimz colour.
- **The hero** has three pieces the founder wants gone:
  - the particle animation behind the dashboard card (`stream-field.tsx`);
  - the green radial gradient and grain wash;
  - the rounded border frame around the section.

## Decision

1. **Light tokens (`packages/ui/src/styles/globals.css`).**
   - **Existing tokens:** map them exactly to the library:
     - background and card `#FFFFFF`;
     - muted `#F9FAFB`;
     - secondary `#F3F4F6`;
     - border `#E5E7EB`;
     - foreground `#050020`;
     - muted-foreground `#58556A`;
     - destructive `#B42318`.
   - **New tokens:**
     - `brand-text` `#028D4B`;
     - `tertiary` `#8E8C9C`;
     - success surface, text and border: `#F5FFFA`, `#01753E`, `#94F9C9`;
     - warning: `#FFFAEB`, `#B54708`, `#FEC84B`;
     - danger: `#FEF3F2`, `#B42318`, `#FDA29B`.
2. **Dark tokens.** A navy set built on the brand navy. The values are confirmed with the founder before the change.
3. **Green text.** A codemod changes the text uses of `text-accent` to `text-brand-text`. Fills (`bg-accent`, checked controls, the rotating headline word's colour role) keep `#02C76A` in light mode, as the library does.
4. **Status colours.** Existing status badges and banners move to the new status tokens. Their shapes and layouts stay the same.
5. **Hero.**
   - Delete `stream-field.tsx` and its mount.
   - Remove the two radial glows and the `grain` class from the hero section.
   - Remove the hero wrapper's ring and rounded frame.
   - Nothing else on the page changes: the rotating word, the beams, the buttons, the footer and the motion all stay.

## Architecture

```
docs/design/strimz-design-system.md  →  packages/ui globals.css (tokens)  →  every app via Tailwind classes
                                                                             apps/web hero (3 removals)
```

## Trade-offs

- **Token changes reach every app at once.** Every route is checked in a browser in light and dark before the PR opens.
- **The dark set is derived.** The library has no dark frames, so the founder approves the dark values.

## Verification

- **Tests that fail first, then pass:**
  - the token file carries the library values;
  - no `text-accent` is left;
  - the hero has no stream field, glow, grain or frame.
- `./scripts/preflight.sh` passes in full.
- Every route of every app is checked at 1440 and 390 wide, in light and dark.
