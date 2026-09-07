# Cimaja Boardriders — Architecture Plan (Phase 0)

No application code yet. This is the blueprint we will build against.

## 1. Contradictions and risky assumptions found in the brief

1. **No customer login, but vouchers must be retrievable.** Without accounts, the only recovery path is email + WhatsApp. Voucher access needs an unguessable public link (long random token per voucher), not the voucher number, or anyone could guess `CBR-2026-004`.
2. **Insurance is "not a package" but must still be paid for.** It still needs an order line, a payment amount and a confirmed record. Treated as a non-package order line with its own document type — not a Voucher-producing package.
3. **40% now / 60% later has no stated due date, reminder rule, or consequence of non-payment.** Open question, not invented.
4. **Round UP to the whole currency unit vs. split payments.** 40% + 60% of a rounded total will not both be whole numbers. Rule needed: round the total, then round the first instalment up and make the balance the remainder (recommended).
5. **Season and promo "greater discount wins" needs a defined eligible-amount unit.** Recommend: per package line, so different lines can legitimately use different discounts.
6. **"Configurable formula, no code execution"** means a restricted expression language with a whitelist of variables and operators, evaluated identically on server and client. This is the single most technically demanding piece.
7. **Global voucher sequence** must be generated inside the database transaction (sequence table with row lock), never in application code, or concurrent checkouts collide.
8. **8-month validity** is stated as fixed; keep it a setting so it is not recompiled, but existing vouchers keep the value stored on them.
9. **Component Templates copied into Products** means write-time copy, never a live reference. Also implies templates can never be "updated everywhere" — accepted consequence.
10. **Real-time hotel availability is excluded**, so accommodation is a priced, configurable product with no stock. Overbooking is handled operationally by staff.

## 2. Recommended technical architecture

- Frontend: the existing TanStack Start app (React 19, SSR) — mobile-first public site plus an English-only Admin area behind login.
- Backend: Lovable Cloud (PostgreSQL, auth, storage, server functions). All commercial logic runs in server functions; the browser never computes an authoritative price.
- One shared domain layer (`src/domain/`) used by both Admin and the public site: configurator resolution, dependency evaluation, pricing, discounting, FX, rounding. Public price previews call the same server-side pricing entry point, so preview and checkout can never disagree.
- Admin/staff auth: email + password login, roles in a separate `user_roles` table with a security-definer role check (never a role column on a profile).
- Public pages read only published, whitelisted product data through narrow public read policies. Everything commercial is written by server functions only.
- Money: integer IDR minor-unit-free amounts (IDR has no cents) stored as bigint. Customer amounts stored as integers in their currency. No floats anywhere in pricing.

## 3. Core entity model (groups, not final columns)

- **Catalog:** products, product_translations, categories, placements, config_flows, steps, fields, field_options, dependencies, component_templates, product_components, pricing_rules, formulas, seasons, season_rules.
- **Operations:** hotels, rooms, transport_routes, motorbike_types, experiences, team_members, insurance_plans.
- **Customer:** customers (identified by email, no password), voucher_recipients.
- **Commerce:** carts, cart_packages (one in-progress + completed), orders, order_lines, payments, payment_events (idempotency log), purchases, purchase_snapshots.
- **Vouchers:** vouchers, voucher_sequence, voucher_events.
- **Marketing:** promo_codes, promo_redemptions, reviews, analytics_events.
- **Legal:** terms_versions, terms_acceptances.

Key relationships: product → config_flow → steps → fields → options; dependencies reference fields/options within the same product only. cart_package → order_line → purchase → purchase_snapshot (1:1) → voucher (1:1 for package products). order → many payments; payment_events keyed by provider event id, unique, so replays are inert. Snapshots are self-contained JSON plus scalar money columns — they hold no foreign key to mutable product config.

Translations live in per-entity translation rows keyed by language code, so a new language is data, not a release. Missing rows fall back to English at read time.

## 4. Phases and dependencies

- **Phase 1 — Data + core backend:** schema, row-level security, grants, roles, voucher sequence, FX rate storage, seed reference data.
- **Phase 2 — Admin foundation:** login, roles, layout, product list/create, settings.
- **Phase 3 — Product + configurator builder:** steps, fields, options, dependencies, component templates → product components.
- **Phase 4 — Pricing engine:** rules, restricted formula language, validator, sample-value tester, activation gate, season/promo resolution, FX freeze + round-up.
- **Phase 5 — Customer configurator + cart:** server-driven flow rendering, package build, cart with one unfinished package.
- **Phase 6 — Checkout + payments:** order, split payment, provider integration, idempotent webhooks, reconciliation of unknown states.
- **Phase 7 — Purchase, snapshot, voucher, email:** snapshot writing, voucher numbering/PDF, purchaser vs holder, transactional email.
- **Phase 8 — Special modules:** accommodation, transport, motorbikes, experiences, insurance, team, reviews, promo codes, legal.
- **Phase 9 — Public website:** navigation, home (video hero → Build Your Trip), category pages, languages, markets.
- **Phase 10 — SEO, analytics, QA, launch.**

Hard dependencies: 4 requires 3; 5 requires 4; 6 requires 5; 7 requires 6; 9 can start visually in parallel with 8 but must consume the real engine before launch.

## 5. Must be decided before the database is built

1. Payment provider and which currencies it can actually charge (drives payment tables and whether IDR or customer currency is charged).
2. Balance-payment rule: due date, reminder cadence, and what happens if the 60% is never paid.
3. Instalment rounding rule (recommendation in section 1.4).
4. Discount eligibility unit for the "greater discount wins" comparison (recommendation: per package line).
5. FX rate source and refresh frequency, plus a safety margin, if any.
6. Whether insurance is sold standalone, only alongside a package, or both.
7. Voucher document format: PDF attachment, hosted secret link, or both.
8. Gift flow: does the recipient receive the voucher directly, or does the purchaser always forward it?

## 6. Safely configurable later

Additional languages, currencies and markets; new products, components, seasons, promo codes; voucher validity length; content, images and copy; additional admin roles; website placements; email template wording.

## 7. Main technical risks

- **Formula engine** — mitigate with a restricted expression language, validation before activation, mandatory sample-value test, and versioned formulas referenced by snapshots.
- **Price disagreement between preview and checkout** — mitigate by making the server the only price authority and re-pricing at checkout.
- **Payment duplication / unknown states** — mitigate with a unique provider-event log, idempotent confirmation, and a staff reconciliation view.
- **Voucher number collisions** — mitigate with a database-locked sequence.
- **Admin complexity overwhelming a non-programmer** — mitigate with the create → configure → price → test → preview → validate → activate path, where activation is blocked until validation passes.
- **Translation drift** — mitigate by marking machine translations and flagging stale rows when English changes.
