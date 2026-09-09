# Entry / Landing experience

A dedicated site-entry screen shown before Home: full-screen video, brand
wording, one button. Configured entirely from Admin, switchable off.

## What already exists and gets reused

- Website pages/sections/blocks tables, their per-language text rows and the
  master-language fallback helper.
- Private `website-media` storage with time-limited links (same upload widget
  pattern as the page editor).
- Admin shell, sign-in, Admin-writes / Staff-reads rules, audit log.
- Managed language list and the existing language picker component.
- Controlled button destinations (page / product / build your trip / external).

Nothing in products, pricing, cart, checkout, payments, vouchers or currency is
touched.

## Behaviour

```text
visitor → root  →  Landing on   → Entry screen → button → Home
                →  Landing off  → Home
```

- Home also gets its own address, `/home`, so it stays reachable directly and a
  refresh keeps you there. No cookies, no "show once", no redirects.
- The button resolves through the existing destination system to the configured
  Home page.

## Content

One row of settings, per-language text:

- On / off
- Background video (upload)
- Fallback image (upload) with alt text
- Title — default "CIMAJA BOARDRIDERS"
- Subtitle — default "SURF. EXPLORE. EXPERIENCE WEST JAVA."
- Button label — default "ENTER CIMAJA BOARDRIDERS"
- Button destination — defaults to the Home page

Missing translations fall back to the default language, as elsewhere.

## Media handling

The video plays muted, looping, without controls, cropped to fill the screen.
The fallback image sits underneath it as the poster, so it is what you see when
the video is still loading, cannot play, or is blocked by the device. If no
video is configured, only the image shows. Nothing breaks when both are absent.

## Look

Cinematic and minimal: video filling the viewport, a soft dark gradient for
legibility, large confident wordmark, one outlined-to-solid button. Mobile
first. Not a redesign of Home or any other page.

## Technical notes

- New tables: `website_landing` (single row: enabled, media paths, alt, button
  destination columns mirroring existing block CTA columns) and
  `website_landing_translations` (language, title, subtitle, cta label). Same
  policies as the other website tables: Admin writes, Staff reads, public reads
  only through a server function.
- `src/lib/website.server.ts` gains a `websiteLanding()` reader returning only
  publishable fields plus signed media links.
- `src/lib/website.functions.ts` gains `getWebsiteLanding` (public) and
  `saveLanding` (Admin-only, validated, audited).
- New route `src/routes/home.tsx` renders the existing Home content; the root
  route renders the Landing when enabled, otherwise the same Home content.
  `resolveDestination` maps the Home page to `/home` so the button can never
  loop back to the entry screen.
- New Admin screen `src/routes/admin/_app/website.landing.tsx`, listed under
  Website → Entry / Landing.
- Focused tests cover enabled/disabled, fallback image, missing video,
  translation fallback and destination safety, alongside the existing suite.
