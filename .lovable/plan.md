# Phase 4 — Pricing Core

Turns a completed product configuration into an exact whole-Rupiah price with an explainable breakdown. No seasons, promotions, currency conversion, cart, checkout or payments.

## 1. Database

Four new tables, all admin-write / staff-read, no anonymous access, same conventions as Phase 3 (uuid ids, timestamps, updated-at trigger, GRANTs then RLS then policies).

- `product_pricing` — one row per product (`product_id` unique). Holds `base_amount_idr` (bigint, whole Rupiah), `status` (`draft` / `active`, constraint), `active_version_id`, `notes`. Existing pricing anchor per product; separate from `products.status` so pricing can be worked on while a product is live.
- `pricing_rules` — ordered structured rules belonging to `product_pricing`. Columns: `display_order`, `label`, `rule_type` (new enum `pricing_rule_type`: `fixed`, `variable_times_amount`, `component_quantity`, `conditional`, `tier`), `amount_idr` (bigint, nullable), `variable_name` (text, nullable — must match a configurator field of the product), `component_id` (nullable FK `product_components`), `condition_variable`, `condition_operator`, `condition_value`, `sign` (`add` / `subtract`), `is_active`.
- `pricing_tiers` — child rows for `tier` rules only: `rule_id`, `from_value`, `to_value` (nullable = open ended), `amount_idr`, `display_order`. Normalised instead of JSON so validation and Admin editing stay simple.
- `formula_versions` — versioned advanced expressions for a product's pricing: `pricing_id`, `version` (int, unique per pricing), `expression` (text), `is_active`, `activated_at`, `created_by`. An active version is immutable: a database trigger rejects updates to `expression` once `is_active` is true; changes create the next version. No separate `formulas` table — a "formula" is just its version history, which avoids a duplicate concept.

Why not JSON blobs: rules must be validated server-side against real configurator fields and components, and shown in an Admin table; normalised rows make both trivial and keep foreign keys honest.

Money: all authored amounts are `bigint` Rupiah. Per-unit multiplication happens in exact arithmetic (`numeric`/integer) and only the final sum is emitted as an integer. No component is rounded on its own. Existing Phase 3 builder `numeric(14,2)` component prices are read as exact decimals and only the final total is rounded — the Phase 3 storage shape is not changed in this phase.

## 2. Pricing engine

New pure module `src/lib/pricing.ts` (no database, no React, no browser API) with:

- `resolveInputs(bundle, values)` — turns saved configurator answers into typed pricing inputs keyed by `variable_name` (number, boolean, string, string list, date range → nights/days), reusing `ProductBundle` and `evaluateDependencies` from `src/lib/catalog.ts` so hidden/reset fields do not contribute.
- `evaluateRules(rules, tiers, components, inputs)` — runs the structured rules in order.
- `evaluateFormula(expression, inputs)` — the restricted evaluator (below).
- `priceProduct(...)` — returns `{ total_idr, lines: BreakdownLine[], errors }` where each line names its source (`base`, `rule:<id>`, `component:<id>`, `formula:v<n>`), the values used and its exact contribution. Breakdown is data only — no UI coupling, reusable later by cart, checkout and snapshots.

Component pricing reuses `product_components.unit_basis` as-is: `fixed`, `per_person`, `per_day`, `per_night`, `per_session`, multiplied by the configuration-derived counts. No second component pricing model. `internal_cost` is never included in customer output and never returned by any customer-facing path.

Server authority: `src/lib/pricing.functions.ts` exposes `previewPrice` (admin test lab) and an internal `computePriceForConfiguration` helper that later cart/checkout code calls with a stored configuration, so no client-supplied amount is ever trusted. Pricing writes/activation are admin-only server functions following the Phase 3 `catalog.functions.ts` pattern (`assertAdmin`, safe error text, audit entry).

## 3. Safe formula evaluation

Hand-written tokeniser + recursive-descent parser to an AST, then evaluation over exact decimal arithmetic. No `eval`, no `new Function`, no SQL execution, no third-party expression package.

Grammar: numbers, variable names, `+ - * /`, parentheses, comparisons (`= != > < >= <=`), and only three functions: `IF(cond, a, b)`, `MIN(...)`, `MAX(...)`. Guards: unknown variable, type mismatch, division by zero (both literal and evaluated), depth/length caps, self/circular reference (formulas cannot reference other formulas at all, which removes cycles by construction), non-finite result, negative total.

## 4. Relationship with Phase 3

Available variables are derived from the product's own configurator fields — the Admin picks from a generated list of `variable_name`s, never retypes them; customer labels stay separate. Components come from the product's existing component rows. Nothing in Phase 3 is redesigned; the only change to existing files is one new tab plus its route wiring.

## 5. Admin UI

One new **Pricing** tab inside the existing product editor (`products.$productId.tsx`), plus one new component folder `src/components/admin/pricing/`:

- `PricingTab.tsx` — base amount, rules table (add / edit / reorder / activate), formula version list with "create new version", pricing status with the validation problem list and an Activate button.
- `RuleEditor.tsx` — rule-type-aware inputs, variable picker fed from the configurator, component picker, tier rows.
- `FormulaEditor.tsx` — expression box, live variable reference list, server-side validate button showing parse errors.
- `TestLab.tsx` — real saved configurator structure rendered as inputs (reusing the Phase 3 preview renderer), then supplied inputs, resolved variables, rules executed, formula version used, breakdown lines and the final Rupiah figure. Saved expected cases are stored in one small table `pricing_test_cases` (`pricing_id`, `label`, `inputs` jsonb, `expected_total_idr`) and re-run with one button, showing pass/fail — deliberately not a QA framework.

Admin shell, forms, tables, dialogs and toasts are reused unchanged. Staff sees the tab read-only, matching Phase 3.

## 6. Validation and activation

Same philosophy as Phase 3: drafts may be incomplete; activation is gated by a server recomputation, never by the browser's verdict. Checks: no pricing configured, incomplete/invalid rule, unknown variable, incompatible type, missing component reference, detectable division by zero, invalid formula syntax, formula referencing itself, no active formula version when a formula is required, negative or non-numeric total on saved test cases. Activating pricing writes an audit entry, as do pricing created, rule created/changed, formula version created/activated and pricing status changes.

## 7. Test strategy

Unit tests for the engine and evaluator with `bunx vitest run`: fixed amount, variable × amount, component per-person/per-night/per-session, multiple rules with add/subtract, conditional rule, tier rule, formula with IF/MIN/MAX, invalid syntax, unknown variable, type mismatch, division by zero, negative result, exact Rupiah total, breakdown sums to total. Database-level tests for: inactive/invalid pricing cannot be activated, and an active formula version cannot be edited. One realistic multi-variable scenario (surf trip: people × nights, sessions, transport component, group discount above a threshold). A short Phase 3 regression pass (product editor tabs, duplication) to confirm nothing broke.

## 8. Files

Reuse unchanged: Admin shell, `admin-audit.ts`, `admin.functions.ts`, `catalog.ts` reads/validation/dependency evaluation, `catalog.functions.ts` patterns, configurator components, UI primitives.
Change: `products.$productId.tsx` (add the tab), `src/lib/catalog.ts` (export a small variable-list helper if not already derivable), `roadmap.md`.
Add: `src/lib/pricing.ts`, `src/lib/pricing.functions.ts`, `src/lib/pricing.test.ts`, `src/components/admin/pricing/*`.

## 9. Security and RLS

New tables: `GRANT` to `authenticated` and `service_role` only, RLS enabled, staff/admin read via `is_staff_or_admin()`, writes via `is_admin()`, no `anon` grants — internal costs and pricing logic stay private. No public read policies in this phase. Phase 1A/2/3 policies, roles and audit rules are untouched.

## 10. Risks and decisions needing approval

- Pricing status is separate from product status, so a live product can have draft pricing. Confirm that is wanted.
- Advanced formulas are per product and cannot call one another (removes circularity). Confirm that no cross-product shared formula library is needed in V1.
- Rules run in order and each contributes an add or subtract to one running total; there is no multi-bucket pricing. Confirm this is enough before seasons/promotions arrive in Phase 5.
- Phase 3 component amounts keep their two-decimal storage; only the final total becomes a whole-Rupiah integer. Confirm rather than migrating Phase 3 columns now.
