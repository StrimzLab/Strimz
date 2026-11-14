---
date: 2026-11-14
feature: Privacy storage disclosure, SEO across hosts, developer keyboard, Fanline redesign
scope: web
scenario-impact: none
---

# Privacy, SEO, the developer keyboard and a new Fanline

## Privacy policy (#466)

Strimz runs no analytics, advertising or tracking scripts, and everything it keeps in the browser is needed for the site to work, so it needs no consent banner. The policy now says so:

- **Removed** the line about a self-hosted analytics setup, which never existed.
- **New "Cookies and local storage" section** listing `strimz-theme`, the Privy sign-in session, `strimz.tour.completed` and `strimz.refund.broadcast.*`: where each is set, why, and for how long.
- **Hosting** names OVHcloud (API and database) and Cloudflare (DNS, websites, Turnstile), not Render and Vercel.
- **Rights and transfers** cover the Nigeria Data Protection Act 2023 and the laws of Kenya, Ghana, Uganda, Tanzania and Rwanda alongside UK and EU GDPR.
- A test fails if any app adds an analytics or ad package, so a consent banner has to come first.

## Developer keyboard (#467)

The animated keyboard that types a short terminal script onto its screen is back above the code card in "One API. Three ways in." It was removed in #360. Its styles now live in a stylesheet only the marketing site loads, so the other apps don't carry them.

## SEO (#468)

- **robots.txt and sitemap.xml** on strimz.finance, docs.strimz.finance and fanline.strimz.finance. The docs sitemap lists every docs page.
- **app, admin and checkout** keep `noindex` and now serve a robots.txt that lets crawlers read it. A `Disallow` would hide the `noindex` and let shared payment links show up as bare URLs.
- **Structured data:** Organization (logo, X, LinkedIn and GitHub profiles, the countries served) and WebSite on every marketing page; SoftwareApplication and FAQPage on the homepage; TechArticle and breadcrumbs on each docs page.
- **Docs pages** get their own canonical URL and preview card.
- **Copy for the markets we serve:** keywords and the homepage description name Nigeria, Kenya, Ghana and Africa. A new FAQ answers "Can businesses in Nigeria, Kenya and Ghana use Strimz?" without promising local currency payouts.

## Fanline (#469)

- **New design** for creators and fans in East and West Africa (Lagos, Accra, Nairobi, Dar es Salaam): a creator picker joined to the tip form, a three-step explainer and a rewritten Pro card. Light and dark themes.
- **Says it is a demo:** a banner and the footer state that it runs on testnet with test USDC. Comparisons with other platforms and the invented testimonial and stats are gone.
- **Fixed** the `__name is not defined` console error (`keep_names: false` in `wrangler.jsonc`) and the missing favicon. Fanline also gets its own robots.txt and sitemap.
- The tip and Pro payment flows are unchanged apart from the tip presets, now $2, $5 and $10.
- **The docs** point to Fanline as the live demo: on the docs home page, in the quickstart, in the React SDK guide and in the subscription plans guide.
