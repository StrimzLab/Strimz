# Homepage redesign plan (#270, #272–#280)

## Brief

- **Start from the live design.** The maintainer rejected two fresh directions and asked to
  start from the original strimz.finance page and make it modern, immersive and cinematic.
- **Keep what the live page owns:**
  - a light page with navy bands;
  - Sora headlines with one green accent word;
  - pill labels with a green dot;
  - the animated dashboard window in the hero;
  - the "Built for" strip;
  - the four colour-coded steps;
  - the navy band with the 3D coin art and the triple green stripe;
  - the alternating feature panels with product mocks;
  - the four plan cards;
  - the navy closing panel with circuit lines and the logo tile.
- **Change two things:**
  - **The words.** They now speak to the business owner first; developers get one section and
    the docs.
  - **The staging.** The page should feel like a 2026 site.
- **The reader** is the owner, operator or finance lead of an online business. They should leave
  believing:
  1. I get paid in seconds, into my own wallet.
  2. It fits how I sell.
  3. The fee is small and gets smaller as I grow.

## Benchmark (17 sites, measured at 1440×900)

- **Closest fits:**
  - **Stellar:** regulated payments, a particle field hero and a sticky morphing visual.
  - **Blockradar:** stablecoin infrastructure, a real dashboard in the hero and live UI in a bento.
  - **Solana:** a cinematic dark hero, a glass nav and hairline stats.
  - **Aave:** inset rounded sheets and phone mocks.
  - **Chainlink:** a rolling word in the hero and grid hairlines.
- **What they share, and what we take:**
  - **The hero background is alive.** 12 of 17 use WebGL, video or particles. Ours is a GPU
    particle field of payment streams.
  - **The product is the proof.** We keep the original animated dashboard.
  - **Headlines are big and tight:** 72–128px, tracking -0.03 to -0.065em. Sora 600 at up to 88px,
    -0.04em.
  - **Navs are glass or floating at 56–64px.** Ours is a floating glass bar that tightens on
    scroll.
  - **Scroll storytelling, used sparingly:** one pinned chapter, one scrubbed manifesto and
    stacking cards.
  - **Grain and soft tinted glows on dark sections,** not neon.
- **What we avoid:**
  - long blank lead-ins;
  - more than one WebGL canvas;
  - all-caps condensed type;
  - scroll-jacking beyond two pinned moments;
  - cookie walls.

## Wireframe (desktop 1440)

```
┌ glass nav (floats 16px, 64px tall; tightens and blurs after 24px of scroll) ─────────────┐
│ [Strimz]        About  Pricing  Customers  Docs  Contact          (◐)  [● Get started]  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
╔══ HERO 100svh · WebGL payment streams flowing right, toward the dashboard ═══════════════╗
║                                                   ┌─ dashboard (original, 3 scenes) ──┐ ║
║ Stablecoin billing                                │ tilts with the pointer            │ ║
║ for [SaaS teams.]  ← rolling green word           │                                   │ ║
║ Take one-time and recurring payments in USDC…     └───────────────────────────────────┘ ║
║ [Start free →]  [See how it works]             ↖ toasts: "+49.00 USDC · Pro renewed" …  ║
║ Free to start · 0% on your first $1,000 · USDC and EURC                                 ║
╚═══════════════════════════════════════════════════════════════════════════════════════════╝
 BUILT FOR  ‹‹ SaaS · Marketplaces · Subscription apps · Agencies · Cross-border B2B · Creators ››
            ›› (second row runs the other way, edges fade)                                  ‹‹
 MANIFESTO (sticky, words light up as you scroll)
 "One link. One approval. Every renewal charged on schedule, in USDC or EURC.
  Each payment settles on Arc and the money is in your own wallet in seconds."
 HOW IT WORKS · pinned on desktop
 ● How it works                              ┌ stage: morphs per step ────────────┐
 From link to paid, in seconds.              │ 1 plan card · 2 share link + QR     │
 01 CREATE  ← active (green tile)            │ 3 wallet approval · 4 money landed  │
 02 SHARE   (blue)    03 APPROVE (purple)    └─────────────────────────────────────┘
 04 GET PAID (red)    progress rail fills while pinned
 ═══ NAVY BAND · grain · 3D coins float on glow ═══ then the green triple stripe
 EVERYTHING YOU NEED TO BILL · stacking sheets (each sticks and scales back as the next arrives)
 [Subscriptions] [Recovery] [Refunds] [Invoices] [Analytics]   text + live mock, alternating
 DEVELOPERS: code window with tabs (checkout · webhooks), three package rows, docs link
 PRICING: four plan cards + first-year fee calculator against cards (odometer)
 FAQ: sticky title left, accordion right
 ═══ NAVY CLOSING · circuit lines with travelling light · glowing logo tile ═══
 FOOTER (original, navy) + triple stripe
```

## Phone (390)

- **Nav:** the logo, the theme toggle and a menu button that opens a full-height sheet.
- **Hero:**
  - The text comes first, then the dashboard, without tilt.
  - The particle field runs at a lower count and stops when off-screen.
- **Built for:** one marquee row.
- **How it works:** not pinned. Each step is a card with its own small stage.
- **Stacking sheets:** become a plain stack with no sticking.
- **Pricing:** cards in one column, then the calculator.

## Motion

| Moment          | Technique                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Hero streams    | Raw WebGL points. Each particle's position on its curve is computed in the vertex shader from time, so the CPU does no per-frame work. |
| Hero intro      | Headline lines rise from a mask, the dashboard rises from rotateX 14°, the toasts follow                                               |
| Rolling word    | GSAP timeline cycling a vertical list every 2.4s                                                                                       |
| Hero exit       | Scrubbed: the text drifts up and fades, the dashboard scales to 0.94                                                                   |
| Built for       | CSS keyframe marquee; paused under reduced motion                                                                                      |
| Manifesto       | ScrollTrigger scrub, word opacity 0.15 → 1                                                                                             |
| How it works    | Pinned for 4 × 70vh; the active step and the stage scene follow progress                                                               |
| Coins           | Idle float (sine) and a parallax offset per coin                                                                                       |
| Stacking sheets | `position: sticky` with scrubbed scale and dimming of the sheet underneath                                                             |
| Fee calculator  | Odometer digits                                                                                                                        |
| Closing circuit | SVG stroke-dashoffset pulses travelling along the lines                                                                                |

## Rules

- **Reduced motion:** every scene renders its final frame, the canvas draws one still frame, and
  nothing pins or loops.
- **No JavaScript:** the server HTML is complete.
- **The canvas pauses** when the hero is off-screen or the tab is hidden. DPR is capped at 2.
- **Colours come from theme tokens** (`bg-background`, `bg-muted`, `bg-card`, `bg-ink`,
  `text-accent`…), so light and dark both work and the theme test passes.
- **Honesty:**
  - no customer logos, volume or testimonials;
  - sample amounts sit inside product mocks;
  - the fees come from `PLANS`.
