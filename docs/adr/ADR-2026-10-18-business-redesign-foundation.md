# ADR: Cinematic business homepage, motion system and marketing UI kit

- **Status:** Accepted (maintainer approved 2026-10-18)
- **Date:** 2026-10-18
- **Issues:**
  - #270, the foundation.
  - The homepage sections of epic #286: #271 nav, #272 hero, #273 who it's for, #274 how it works,
    #275 features, #277 proof and #279 developers/CTA/footer.
  - The homepage half of #280, the fee calculator.
- **Plan:** `docs/plans/2026-10-18-homepage-redesign-plan.md`, with the benchmark, wireframes and
  motion map.
- **Scope:**
  - Changes: the `apps/web` marketing layout, nav, footer and homepage.
  - Unchanged:
    - The other marketing pages keep their content and get the new nav and footer.
    - The dashboard, auth, checkout, the API and the packages are not touched.

## Context

Checked against `main` at `460261b`.

1. **The maintainer rejected two fresh directions:**
   - an editorial "printed annual" look;
   - a light page with SVG streams.

   The instruction was to start from the live strimz.finance design, keep its identity, and make
   it modern, immersive and cinematic, benchmarked against 17 web3 sites. Those sites are Verona,
   Blockradar, Light, Sui, Arbitrum, Robinhood, Avalanche, Stellar, Chainlink, Arc, Hyperliquid,
   Aave, Stacks, Consensys, Solana, TRON and Base.

2. **The live page sold to developers.** The audience is business owners and finance leads
   (#286).
3. **What the live design owns:**
   - a light page with navy bands;
   - Sora headlines with a green accent;
   - pill labels with a green dot;
   - an animated dashboard window in the hero;
   - a "Built for" strip;
   - four colour-coded steps;
   - a navy band with 3D coin art and the triple green stripe;
   - alternating feature panels with mocks;
   - four plan cards;
   - a navy closing panel with circuit lines and the logo tile.
4. **The benchmark** shows the same patterns again and again:
   - a live hero background (12 of 17 sites: WebGL, video or particles);
   - product UI as proof;
   - large, tight display type;
   - glass or floating navs;
   - inset rounded "sheet" sections;
   - one or two scroll-pinned moments;
   - grain and tinted glows on dark sections.
5. **Explicit maintainer requirements:**
   - use the installed skills and MCPs, and Vengeance UI;
   - do the deep animation work rather than the easy version;
   - handle every state, with success and error;
   - use Skeleton-style placeholders;
   - build our own toast if we can.
6. **The truth constraints still apply:**
   - the honesty test (#154);
   - pricing CTAs go to `/login` (#250);
   - fees come from `PLANS`;
   - every input is labelled `(required) *` or `(optional)`;
   - every surface has the light/dark toggle.
7. **A type-resolution hazard.** Adding dependencies changed the hoisted `@types/react` (19.1.0 →
   19.2.14) and produced about 400 JSX type errors. CI installs from the same lockfile.

## Decision

### D1. Structure: the live page, upgraded

| #   | Section                  | From the live site                   | What changes                                                                                                                                      |
| --- | ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Nav                      | Logo, the five links, Get started    | A floating glass bar that tightens on scroll, a spotlight hover glow, the theme toggle, Sign in, and a full-height phone sheet                    |
| 2   | Hero (#272)              | Headline left, live dashboard right  | An inset stage, pale in light mode and navy in dark, with WebGL streams converging on the dashboard; "Stablecoin billing for {morphing audience}" |
| 3   | Built for (#273)         | Sector chips                         | Two edge-faded marquee rows with Solar icons                                                                                                      |
| 4   | Manifesto                | (new)                                | What Strimz does in one statement that unblurs line by line as you scroll                                                                         |
| 5   | How it works (#274)      | Four colour-coded steps              | Pinned on desktop. One scrubbed timeline plays four product scenes: create, share, approve, paid                                                  |
| 6   | Assurances (#275)        | Navy band, 3D coins, triple stripe   | Coins float with depth parallax over green light lines. Copy rewritten for owners                                                                 |
| 7   | Billing tools (#275)     | Alternating panels with mocks        | Five stacking sheets (subscriptions, recovery, refunds, invoices, analytics), each with a live mock that plays on arrival                         |
| 8   | Developers (#279)        | SDK rows and two code samples        | A 3D keyboard typing a real Strimz flow onto a glowing terminal, copyable install rows and tabbed code                                            |
| 9   | Pricing (#280, homepage) | Four plan cards                      | Spotlight cards, a border beam on the recommended plan, and a first-year calculator of Strimz fees only                                           |
| 10  | FAQ                      | The #154-audited answers             | A sticky title and accordion rows with an accent rail                                                                                             |
| 11  | Closing (#279)           | Navy panel, circuit lines, logo tile | Light pulses travel the traced circuit routes into the glowing logo tile                                                                          |
| 12  | Footer (#279)            | Navy footer and stripe               | Follows the theme on the page background, well clear of the closing panel; ASCII coins and a fading wordmark                                      |

- **#276 (product tour)** is covered by the pinned how-it-works chapter.
- **#277 (proof):** the hero facts and the assurances band are true by construction. There are no
  logos, testimonials or volume.

### D2. Visual system

- **Colours** are the existing theme tokens: `background`, `muted`, `card`, `ink`,
  `ink-muted`, `accent`, `accent-bright`, `accent-soft` and the step colours.
  - The `--mk-*` palette from the rejected pass is removed.
  - Small green text in light mode uses a local `accent-ink` token (#027a43, about 5:1 on white).
    Brand green alone measures about 2.2:1.
  - The hero stage follows the theme: `bg-muted` with a hairline ring in light mode, `bg-ink` in
    dark. The particles switch to deep green with normal blending on the pale stage.
  - The assurances band and closing panel stay `bg-ink` in both themes.
  - The footer has no stage. It sits on the page background below generous space, so it never
    reads as a twin of the navy closing panel. Its ASCII coins and wordmark follow the theme.
- **Type:**
  - Sora 600 for display: 40–80px, tracking -0.035 to -0.045em.
  - Poppins for body text.
- **Radii:**
  - stages 28–36px;
  - sheets 32px;
  - cards 22–28px;
  - controls 12–14px.
- **Icons** are Solar via Iconify. The 3D coin art and the logo are the existing brand assets.
- **`PopLink`** is every marketing CTA: Vengeance UI's Pop Button as a keycap that sinks when
  pressed. Primary is a green key with navy text; secondary is a neutral key in the theme's card
  colours (a dark key on navy panels). It echoes the typing keyboard further down the page.

### D3. Motion system

- **GSAP 3.15** with `@gsap/react` (`useGSAP`, `gsap.matchMedia`), ScrollTrigger, SplitText (for
  the gooey reveal) and CustomEase.
- **Lenis is the only smooth-scroll engine.** `startSmoothScroll` creates it and attaches it to
  GSAP's ticker in one call, so the ticker can never miss the instance. It is not created under
  reduced motion, and `html.lenis` forces `scroll-behavior: auto`.
- **`ScrollRefresh`** watches the document height and re-measures ScrollTrigger after lazy
  sections and fonts settle. Chrome caught triggers left stale without it.
- **The pre-paint gate** hides `[data-intro]` items only when motion is allowed. The class is
  removed after a 3s failsafe.
- **The WebGL stream field** (raw WebGL, no Three.js):
  - 12k particles on desktop and 4k on phones. Positions are computed on the GPU along Bézier
    lanes into the dashboard.
  - Pointer repulsion on fine pointers.
  - DPR capped at 2.
  - Pauses off-screen and in hidden tabs.
  - Handles context loss.
  - Under reduced motion it draws a single frame.
  - Without WebGL, or on error, it shows a static poster.
- **The pinned chapter:**
  - Each scene's choreography is a timeline builder.
  - Desktop nests all four in one scrubbed master timeline; phones play each once on arrival.
- **Scroll triggers never use `once: true`.** A once trigger that starts already passed (a reload
  that restores the scroll position) kills itself during ScrollTrigger's refresh and throws, which
  stopped every later trigger. `PLAY_ONCE` (`toggleActions: 'play none none none'`) replaces it,
  and a guard test keeps it out.
- **CSS keyframes, all off under reduced motion,** carry the marquee, light lines, border beam,
  morph word, circuit pulses, keyboard caret and toast timer.

### D4. Adapted Vengeance UI components (MIT, credited in each file)

| Component         | Changes made here                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Morph Text        | Inline word in the hero; no Space Grotesk import; tuned for five words; first word only under reduced motion                                                             |
| Pop Button        | Strimz green and neutral keys from theme tokens, sentence case, depth by an `@property`, hover only on fine pointers                                                     |
| Border Beam       | `<style jsx>` removed; the keyframe moved to global CSS                                                                                                                  |
| Light Lines       | CSS-driven (no rAF loop), recoloured green                                                                                                                               |
| Spotlight Navbar  | The hover glow only, without framer-motion                                                                                                                               |
| Gooey Text Reveal | Uses our GSAP registration; guards for an undefined entry                                                                                                                |
| Typing Keyboard   | Themed for light and dark through CSS variables, `textContent` instead of `innerHTML`, scales to its container, pauses off-screen, full text under reduced motion        |
| Animated Footer   | The coins replace the stock hand photos; transparent pixels are skipped; colour by luminance; pauses off-screen; no motion under reduced motion; image errors are logged |
| FAQ Accordion     | Row styling on the accessible Radix accordion                                                                                                                            |

- **Not used:**
  - the 133 blocks, which are static layouts with fake logos and filler copy;
  - the duplicate smooth-scroll;
  - the heavy Three.js items.

### D5. State handling

- **Pure, tested state machines** (`components/marketing/state.ts`):
  - `canvasStatus`: loading, live, still, unsupported or error.
  - `copyReducer`: idle, copying, copied, or failed with a reason. Late results are ignored after
    a reset.
  - `mediaReducer`: loading, loaded or failed, and it never flips back.
- **`SectionBoundary`** wraps every homepage section. On a render error it logs the error and shows
  an inline alert with "Try again", and the rest of the page keeps working.
- **Skeleton-style placeholders** (lines, circles and blocks on `@strimz/ui`'s `Skeleton`) show
  while:
  - the lazy keyboard and ASCII art load;
  - the coin art loads.

  The coin art falls back to an icon if its image fails.

- **Our own toaster** (`components/marketing/toast`):
  - a typed store with a tested reducer: newest first, limit 4, an id replaces rather than stacks;
  - stacked cards that fan out on hover or focus;
  - a CSS timer that pauses with them;
  - GSAP enter and exit;
  - errors use `role="alert"` and everything else `role="status"`.
- **The copy buttons** use the state machine and the toaster for both success and failure.

### D6. Removals and fixes

- **Removed:**
  - the rejected pass's sections (facts, who-for, previews, checkout builder, comparison, stream
    SVG and its test);
  - the old homepage components;
  - the marquee and hover-button effects;
  - `react-scroll` and `react-fast-marquee`;
  - the MotionPath plugin and the `--mk-*` tokens.
- **Restored from `main`:** `dashboard-preview.tsx` and `padded-lines.tsx`.
- **`apps/web/tsconfig.json`** maps `react`, `react-dom` and their subpaths to the app's own
  `@types` (Context 7).

## Diagram

```
(marketing)/layout.tsx
  ├─ <script> gate ─► html.mk-motion  (motion allowed only; 3 s failsafe)
  ├─ <SmoothScroll/> Lenis on gsap.ticker ─► ScrollTrigger.update   (absent under reduced motion)
  ├─ <ScrollRefresh/> ResizeObserver(body) + fonts.ready ─► ScrollTrigger.refresh (debounced)
  ├─ <MarketingNav/>  glass bar · spotlight · ThemeToggle · Sheet
  ├─ page.tsx: each section inside <SectionBoundary name>
  │    Hero ─ StreamField(WebGL, canvasStatus) ─► sinkRef = DashboardPreview
  │    Sectors ▸ Manifesto(GooeyTextReveal scrub) ▸ HowItWorks(pin; sceneTimeline × 4)
  │    Assurances(LightLines, ArtImage/mediaReducer) ▸ BillingTools(sticky sheets; playMock)
  │    Developers(TypingKeyboard lazy+skeleton; CopyButton/copyReducer ─► toast)
  │    Pricing(PLANS ─► firstYearFees ─► Odometer) ▸ Faq ▸ Closing(circuit pulses)
  ├─ <MarketingFooter/> AsciiStage(lazy+skeleton) · wordmark unmask
  └─ <Toaster/> useSyncExternalStore(store) · stacked · role=status|alert
```

## Consequences

- **The homepage speaks to the business first.** Developer content is one section plus the docs.
- **The page is long:** about 15k px on desktop and 17k on a phone. The pinned chapter accounts for
  about three screens of it.
- **The homepage is heavier than the rejected pass.** The production build measures 42.8 kB route
  JS and 334 kB first load, against 202 kB before. Most of it is GSAP with SplitText, Lenis, and
  framer-motion for the original hero dashboard. The code highlighter, keyboard and ASCII art load
  lazily.
- **Two animation libraries ship in `apps/web`.** GSAP and Lenis are used on marketing routes and
  framer-motion in the dashboard and the hero dashboard mock.
- **No comparisons with other processors.** The homepage shows what Strimz does. It quotes no
  card rates or terms, and a guard test bans that wording on the homepage. The calculator shows
  the first year's Strimz fees, the effective rate and what the business keeps.
- **The sample figures** describe one plausible small business and are labelled as samples.
- **The other marketing pages keep their old bodies** under the new nav and footer until #280
  (pricing page), #281 and #282.

## Alternatives considered

- **The two earlier directions.** Both rejected by the maintainer.
- **Three.js or react-three-fiber for the hero.** It adds about 150 kB for a points field that raw
  WebGL renders in about 250 lines.
- **Vengeance UI's blocks as layouts.** They are static, full of fake social proof, and conflict
  with the honesty rules.
- **Sonner for toasts.** It is available in `@strimz/ui`, but the maintainer asked for our own. The
  custom store is small, tested and theme-native.
- **A pnpm lockfile rewrite instead of the tsconfig pins.** Riskier.

## Verification

- **Unit tests, written red first:**
  - `marketing-states.test.ts` (13 tests);
  - `marketing-toast.test.ts` (5 tests);
  - `fee-estimate.test.ts`;
  - `marketing-odometer.test.ts`.
- **The existing guards pass:** honesty, theme surfaces, docs links and pricing CTAs.
- **Chrome (DevTools MCP)** at 1440×900 and 390×844 (touch), in light and dark:
  - no horizontal overflow;
  - every animated item ends visible after a full scroll;
  - the pinned chapter changes scenes and the active step follows;
  - copy success and forced failure produce the right button label and toast role;
  - under forced reduced motion there is no gate, no Lenis, no pins, the canvas is "still", and
    nothing is hidden.
- **Bugs Chrome caught, now fixed:**
  - black squares from the particles at DPR 3;
  - stale ScrollTrigger positions that left the plan cards on their first frame;
  - the gooey filter erasing semi-transparent text;
  - a stamp covering the invoice total;
  - an uncached server snapshot in the toaster.
- **The full preflight.**
