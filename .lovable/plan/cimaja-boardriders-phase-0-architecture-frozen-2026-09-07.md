# Cimaja Boardriders — Phase 0 Architecture (Frozen)

No tables, UI, payments or public site in this step. This document is the blueprint implementation will follow.

## Decisions now locked

- Voucher belongs to a Purchase, never to a Package. Insurance purchases produce vouchers too.
- Insurance is configurable and sellable standalone, alongside another purchase, or as a gift — but never as a Package and never with cart-based season/promo discounts.
- No customer account, login or voucher recovery in V1. Delivery is confirmed payment → PDF voucher → email.
- Every voucher stores its own expiry date (purchase date + 8 months at creation) and its own validity months, so changing the global setting later never touches existing vouchers.
- Normal purchase: 40% now, 60% collected administratively before the experience. No second customer checkout, no invented due dates, no automatic cancellation. Gift purchase: 100% now.
- Rounding: exact IDR total → FX → round up to the next whole customer-currency unit. First payment = round up(total × 40%); second = total − first. Components are never rounded.
- Season and promo eligibility are per priced component. Same eligible amount → take the greater saving only. Different amounts → both may apply.
- FX provider and payment provider are both unselected; each sits behind its own service boundary.
- Gift vouchers go to the purchaser only and never display price, paid or pending amounts.
- Kept from the earlier plan: server-authoritative pricing, one shared domain layer, restricted formula language with no code execution, database-generated global voucher sequence, component templates copied then independent, self-contained snapshots, relational PostgreSQL, secure admin roles, public reads limited to published content, commercial writes only through protected server operations.

## A. Final core entity model

**Catalog:** products (kind = package | insurance), product_translations, categories, placements, product_placements, config_flows, steps, fields, field_options, dependencies, component_templates, product_components, pricing_rules, formulas, formula_versions, seasons, season_rules.

**Operations:** hotels, rooms, transport_routes, motorbike_types, experiences, team_members, insurance_plans.

**Customer:** customers (email-identified, no password), gift_details.

**Commerce:** carts, cart_packages, orders, order_lines (line_kind = package | insurance), payments, payment_events, purchases, purchase_snapshots, fx_rates, fx_snapshots.

**Vouchers:** vouchers, voucher_sequence, voucher_events.

**Marketing:** promo_codes, promo_redemptions, reviews, analytics_events.

**Legal:** terms_versions, terms_acceptances.

**Admin:** app users via Cloud auth, roles in a separate user_roles table checked through a security-definer function.

Money is stored as integers: IDR as bigint, customer-currency amounts as integers in that currency. No floating point in any pricing path.

## B. Final core relationships

```text
product ─1:1─ config_flow ─1:n─ step ─1:n─ field ─1:n─ field_option
product ─1:n─ product_component        (copied from component_template, then independent)
product ─1:n─ pricing_rule / formula_version
component_template ──copy──▶ product_component   (no live link)

cart ─1:n─ cart_package        (many completed + at most one in progress)
order ─1:n─ order_line         (package lines and insurance lines side by side)
order ─1:n─ payment ─1:n─ payment_event (unique provider event id)
order_line ─1:1─ purchase ─1:1─ purchase_snapshot ─1:1─ voucher
purchase ─n:1─ customer (purchaser)   purchase ─0:1─ gift_details
voucher ─1:n─ voucher_events
```

purchase_snapshot holds no foreign key into mutable product configuration — it stores the resolved configuration, options, quantities, component prices, rules, formula version, discount maths, IDR total, currency, FX rate and timestamp, converted and rounded amounts, paid and pending amounts, purchaser data, gift flag and validity months. A voucher reads from its snapshot and never computes a price.

## C. Final commerce flow

```text
product → configurator flow → completed configuration → cart_package
cart (n packages, optional insurance lines) → order + order_lines
→ price re-computed server-side → FX frozen → payment (40% or 100%)
→ confirmed → purchase per line → purchase_snapshot → voucher → PDF email
```

## D. Final insurance flow

```text
insurance product → insurance configuration → insurance order_line
→ payment → insurance purchase → purchase_snapshot → insurance voucher
```

Insurance never becomes a cart_package, never uses season, never accepts a promo code, and can be added to an order that also contains packages, sold alone, or sold as a gift.

## E. Final payment flow

States: payment pending, partially paid, fully paid, payment failed, payment unknown. Order-level paid and pending amounts derive from confirmed payments.

Every provider notification is recorded in payment_events with a unique provider event id, so replays are inert and can never create a second purchase or voucher. Unknown status is never re-charged — it is reconciled and only confirmed on provider confirmation. The 60% balance is recorded by staff in Admin as an additional payment against the same order.

## F. Final voucher flow

Confirmed purchase → voucher number from a database-locked global sequence (`CBR-2026-001`) → expiry stored as purchase date + 8 months → status active / used / expired / cancelled, with admin correction and reactivation → PDF generated from the snapshot → emailed to the purchaser. Regeneration reuses the same number; deleting a voucher never deletes the purchase, snapshot or payment history. Gift vouchers omit all monetary fields.

## G. Remaining open decisions

1. FX rate source, refresh frequency and whether a safety margin is applied.
2. Payment provider, and whether the customer is charged in their currency or in IDR.
3. Voucher PDF layout, branding and required legal text.
4. Insurance voucher content — what the document must state (cover, plan, dates, holder).
5. Which fields identify the "experience start" used operationally to chase the 60%.
6. Whether staff need a partial-refund or cancellation-with-refund record in V1.

None of these block Phase 1; each maps to a nullable or configuration-driven area.

## H. Phase 1 database implementation plan

1. Enums and shared foundations: product kind, line kind, payment status, voucher status, currency, language, role.
2. Roles and security base: user_roles table, security-definer role check, admin-only write policy pattern.
3. Catalog schema: products, translations, categories, placements, config flows, steps, fields, options, dependencies, component templates, product components.
4. Pricing schema: pricing rules, formulas with versions, seasons and season rules, per-component season/promo eligibility flags.
5. Operations schema: hotels, rooms, transport routes, motorbike types, experiences, team, insurance plans.
6. Commerce schema: customers, carts, cart packages, orders, order lines, payments, payment events with the uniqueness constraint, purchases, purchase snapshots.
7. FX schema: current rates plus frozen snapshots.
8. Voucher schema: vouchers with stored expiry and validity months, locked global sequence, voucher events.
9. Marketing and legal schema: promo codes, redemptions, reviews, analytics events, terms versions, acceptances.
10. Row-level security and grants on every table in the same migration that creates it: public read only for published catalog content, no public write anywhere, commercial writes through server-side operations only.
11. Seed reference data: currencies, languages, markets, initial settings including voucher validity months.

Each numbered item is a separate reviewable migration block.
