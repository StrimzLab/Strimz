# ADR: Register the typography plugin and theme `prose` with Strimz tokens

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19
- **Issue:** #316 (part of #286)

## Context

`LegalDoc` (`apps/web/src/components/marketing/legal-doc.tsx`) renders Terms, Privacy and Acceptable Use. It styles them with `prose prose-neutral prose-h2:* prose-a:*`. The admin broadcast editor (`components/admin/rich-text-editor.tsx`) uses `prose prose-sm` on its editable area.

These classes come from `@tailwindcss/typography`. That plugin is not a dependency of `apps/web` and is not registered in `globals.css`, so Tailwind emits nothing for them:

- **What readers get:**
  - section headings look like body text;
  - lists have no bullets or indent;
  - paragraphs have no spacing.
- **Where it shows:** the three legal pages and the broadcast editor.
- **Checked on main `c709c88`:** at 1440 and 390 px, in light and dark.
- **This is not a recent regression.** `legal-doc.tsx` has used these classes since #68.

## Decision

1. **Add `@tailwindcss/typography@0.5.20`** to `apps/web` devDependencies, at an exact version. Register it with `@plugin '@tailwindcss/typography';` in `apps/web/src/styles/globals.css`. It ships CSS only, with no runtime JavaScript.
2. **Define one colour theme, `prose-strimz`,** as a `@utility` in `globals.css`.
   - It maps every `--tw-prose-*` variable to the existing theme tokens: `foreground`, `muted-foreground`, `border`, `accent` and `accent-ink`.
   - Those tokens already switch under `.dark`, so the theme follows the light/dark toggle.
   - No `dark:prose-invert` and no hex colours in markup, so the theme-surface guard test stays meaningful.
3. **`LegalDoc`** uses `prose prose-strimz max-w-none` and keeps its heading modifiers:
   - Sora for `h2`;
   - `scroll-mt-28`, so "On this page" anchors land below the floating nav;
   - links in `accent-ink`, which reads at about 5:1 on white, underlined on hover.

   The closing note stays inside the article.

4. **The broadcast editor** uses `prose prose-sm prose-strimz`.
5. **A guard test** fails when any file in `apps/web/src` uses a `prose` class unless the plugin is in `package.json` and registered in `globals.css`. It also requires those surfaces to use `prose-strimz` rather than the default grey palette.

```
apps/web/package.json ── devDependency @tailwindcss/typography@0.5.20
        │
apps/web/src/styles/globals.css
  @plugin '@tailwindcss/typography'
  @utility prose-strimz { --tw-prose-* → hsl(var(--foreground)) … }
        │                        (tokens flip under .dark)
        ├── LegalDoc  <article class="prose prose-strimz …">  → /legal/terms, /privacy, /acceptable-use
        └── RichTextEditor  class="prose prose-sm prose-strimz …"  → /admin/broadcasts
```

## Consequences

- The legal pages get proper headings, bullets, spacing and link styling in both themes. So does the admin editor.
- There is one new devDependency, used only at build time. The CSS added is limited to the `prose` utilities the app actually uses, since Tailwind v4 generates on demand.
- Future rich text, such as release notes or blog posts, can reuse `prose prose-strimz`.

## Alternatives considered

- **Hand-written `.legal-prose` CSS.** It avoids a dependency, but it re-implements lists, nested lists, spacing rhythm and code styling, and the admin editor would still be broken. Rejected.
- **`prose-neutral` with `dark:prose-invert`.** This uses Tailwind's grey palette instead of our tokens, so dark mode would look off-brand. Rejected.
- **Deleting the `prose` classes and styling each element on the pages.** That means 30 headings and 54 list items across three files, and every future legal edit has to remember the classes. Rejected.

## Verification

- Red then green: the new guard test fails on main and passes after the change.
- `./scripts/preflight.sh` passes in full.
- Chrome: all three legal pages at 1440 and 390 px in light and dark, checking headings, bullets, links and anchor offsets. The broadcast editor renders formatted text.
- No new console errors, and no horizontal overflow.
