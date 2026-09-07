# Phase 4 — Pricing Core (revised)

Turns a saved product configuration into an exact whole-Rupiah total with an explainable breakdown. No seasons, promotions, currency conversion, cart, checkout, payments.

## 1. Deterministic pricing model (point 1)

Each product's pricing has an explicit **mode**, stored on `product_pricing.mode`:

- `structured` (default): `total = base_amount_idr + Σ(active rules, in display order) + Σ(component charges)`. No formula is evaluated, even if formula versions exist.
- `formula`: `total = evaluate(active formula version)`. Base, rules and component rules are **not** added — the formula is the whole price and may reference `base` and named component/rule results explicitly if the author wants them.

The modes are mutually exclusive, so the same amount can never be charged twice. Execution order in both modes:

```text
CONFIGURATION -> RESOLVE VARIABLES -> (mode) -> FINAL IDR TOTAL
  structured: base -> rules in order -> component charges -> total
  formula:    resolved variables (+ base, + component unit prices as named inputs) -> formula -> total
```

All the required cases are covered: fixed/base price, structured rules, component pricing, conditional and tier rules live in `structured`; genuinely complex maths uses `formula`. The Admin chooses the mode with a single control, and the Test Lab labels which mode produced the figure.

## 2. Component quantity semantics (point 2)

Component pricing reuses `product_components` and `unit_basis` unchanged; no second quantity system.

The multiplier is resolved from **explicit variable mappings** stored on `product_pricing`: `people_variable`, `days_variable`, `nights_variable`, `sessions_variable` (each nullable text, each must match a `variable_name` of one of this product's configurator fields of a numeric/quantity type).

- `fixed` → ×1
- `per_person` → × value of `people_variable`
- `per_day` → × `days_variable`
- `per_night` → × `nights_variable`
- `per_session` → × `sessions_variable`

`customer_price = 0` with `internal_cost > 0` is legitimate and contributes 0 to the customer total; the cost is never returned to any customer-facing path.

Activation validation fails (never guesses) when a component's basis needs a mapping that is missing, points at a non-existent variable, points at a non-numeric field, or resolves to a missing value at price time. Products with no mapping needed (all components `fixed`) require no mapping.

## 3. Tier semantics (point 3)

`pricing_tiers.amount_idr` is **the total amount for that tier** (a lookup, not per-unit and not marginal). A tier rule matches the single tier whose `from_value`/`to_value` range contains the resolved variable value and contributes that one amount.

Supported: 1–2 people → X, 3–4 → Y, 5–6 → Z. Progressive/marginal tiers are explicitly **not supported in V1**. Validation rejects overlapping ranges, gaps that leave a possible value unmatched with no open-ended final tier, and inverted ranges.

## 4. Base price semantics (point 4)

`base_amount_idr` defaults to 0 and zero is valid. `base = 0 + components/rules` is a valid configuration, and a final total of 0 is valid when the configured logic legitimately produces it. Only a **negative** total (or a non-numeric one) is invalid and blocks both activation and price return.

## 5. Product Active vs Pricing Active (point 5)

Statuses stay separate: `products.status` and `product_pricing.status` (`draft` / `active`). Enforced server-side:

- A product is **purchasable / commercially exposable** only when product status is `active` **and** pricing status is `active`.
- `PRODUCT = ACTIVE` with `PRICING = DRAFT` is allowed internally, but such a product is not purchasable and no commercial price is ever returned for it — the pricing functions refuse and the Status tab shows "not purchasable: pricing is draft".
- Activating pricing re-runs the full server-side validation; activating a product also reports the pricing relationship. This rule lives in one server helper so later cart/checkout/public phases reuse it rather than re-deciding.

## 6. Formula types and comparisons (point 6)

The evaluator is explicitly typed: `number`, `boolean`, `string`, `string list` (multi-select). Rules:

- `+ - * /` accept numbers only; anything else is a validation error (e.g. multiplying a string by a number fails before activation, not at price time).
- `> < >= <=` accept numbers only.
- `= !=` accept two values of the same type, so `level == "Beginner"` and `insurance == true` are valid.
- String lists support only `CONTAINS(list, "value")` and equality against a list is rejected.
- `IF(cond, a, b)` requires a boolean condition and two same-typed branches; `MIN`/`MAX` take numbers.

No loops, no assignment, no user-defined functions — this stays a restricted expression language, not a programming language.

## 7. No second date system (point 7)

Pricing inputs come only from existing Phase 3 configurator variables. Nothing derives nights or days implicitly from a `date_range` field.

**Explicit dependency:** Phase 3 does not currently expose a numeric nights/days value. For Phase 4 the Admin maps `days_variable` / `nights_variable` to an existing numeric or quantity field of the product (as in point 2). If a product genuinely needs nights computed from a `date_range` answer, that is recorded as a **Phase 3 configurator dependency** (a derived numeric value on the field) and is out of scope here — activation simply fails with a clear message rather than inventing a parallel date model.

## 8. Restricted formula inputs (point 8)

A formula may reference only: this product's configurator `variable_name`s (after dependency evaluation, so hidden/reset answers are absent), the mapped quantity variables, `base`, and this product's component customer prices exposed as named inputs. Unknown names fail validation. There is no access to arbitrary tables, SQL, JavaScript, other products, external services or any customer data. Evaluation is a hand-written tokeniser + recursive-descent parser over exact decimal arithmetic — no `eval`, no `new Function`, no expression library. Guards: unknown variable, type mismatch, division by zero (literal and evaluated), expression length/depth caps, non-finite result, negative total. Formulas cannot reference other formulas, so circularity is impossible by construction.

## 9. Test Lab (point 9)

Kept lightweight: `pricing_test_cases` (`pricing_id`, `label`, `inputs` jsonb, `expected_total_idr`). The Test Lab renders the real saved configurator (reusing the Phase 3 preview renderer), then shows supplied inputs, resolved variables, mode used, rules executed, formula version used, breakdown lines, final Rupiah total and any validation errors. Saved cases re-run with one button and show pass/fail. Cases can combine people × nights + sessions + components + conditional and tier rules. No QA framework.

## 10. Database (point 10 — five tables, nothing else)

All admin-write / staff-read, no `anon` grants, uuid ids, timestamps + updated-at trigger, GRANT → RLS → policies in that order.

- `product_pricing` — one row per product: `base_amount_idr` (bigint, default 0), `mode` (`structured` / `formula`), `status` (`draft` / `active`), `active_version_id`, `people_variable`, `days_variable`, `nights_variable`, `sessions_variable`, `notes`.
- `pricing_rules` — ordered rules of a pricing row: `rule_type` (new enum: `fixed`, `variable_times_amount`, `component_quantity`, `conditional`, `tier`), `label`, `display_order`, `amount_idr`, `variable_name`, `component_id` (FK `product_components`), `condition_variable`, `condition_operator`, `condition_value`, `sign` (`add` / `subtract`), `is_active`.
- `pricing_tiers` — tier rows for `tier` rules: `rule_id`, `from_value`, `to_value` (null = open ended), `amount_idr`, `display_order`.
- `formula_versions` — `pricing_id`, `version` (unique per pricing), `expression`, `is_active`, `activated_at`, `created_by`. A trigger makes an active version immutable; edits create the next version. No separate `formulas` table.
- `pricing_test_cases` — as above.

Money: authored amounts are `bigint` Rupiah; multiplications use exact `numeric`/integer arithmetic; nothing is rounded per component; only the final sum becomes an integer. Phase 3 component columns keep their current two-decimal storage — read exactly, rounded only in the final total.

## 11. Engine, server authority, audit

- `src/lib/pricing.ts` — pure, no database/React: `resolveInputs` (reuses `ProductBundle` + `evaluateDependencies`), `evaluateRules`, `evaluateFormula`, `priceProduct` returning `{ total_idr, mode, lines, errors }`, each line naming its source (`base`, `rule:<id>`, `component:<id>`, `formula:v<n>`), the values used and its contribution. Breakdown is data only, reusable later by cart, checkout and snapshots.
- `src/lib/pricing.functions.ts` — admin-only server functions following the Phase 3 pattern (`assertAdmin`, safe error text, audit): validate, activate pricing, activate formula version, run test cases, and an internal `computePriceForConfiguration` that later phases call so no client-supplied amount is ever trusted.
- Audit entries: pricing created, rule created/changed, formula version created, formula version activated, pricing status changed. Not per keystroke.

## 12. Admin UI

One new **Pricing** tab in the existing product editor plus `src/components/admin/pricing/`: `PricingTab.tsx` (mode, base, quantity mappings, rules table, formula versions, status + problem list + Activate), `RuleEditor.tsx` (rule-type-aware inputs, variable picker from the configurator, component picker, tier rows), `FormulaEditor.tsx` (expression, variable reference list, server validate), `TestLab.tsx`. Admin shell, tables, dialogs, forms and toasts reused; Staff read-only.

## 13. Test strategy

`bunx vitest run` unit tests: fixed, variable × amount, component per-person/per-night/per-session, multiple rules with add/subtract, conditional, tier lookup (1–2 / 3–4 / 5–6 people), formula with IF/MIN/MAX, invalid syntax, unknown variable, type mismatch (string × number), division by zero, negative total rejected, zero total accepted, exact Rupiah total, breakdown sums to total, mode exclusivity (rules ignored in formula mode). Database tests: invalid pricing cannot be activated, active formula version immutable, product active + pricing draft is not purchasable. One realistic multi-variable scenario (surf trip: people × nights, sessions, transport component, tiered group price, conditional insurance). Plus a short Phase 3 regression pass (editor tabs, duplication).

## 14. Files

Reuse unchanged: Admin shell, `admin-audit.ts`, `catalog.ts`, `catalog.functions.ts` patterns, configurator components, UI primitives.
Change: `products.$productId.tsx` (add the tab), `roadmap.md`.
Add: `src/lib/pricing.ts`, `src/lib/pricing.functions.ts`, `src/lib/pricing.test.ts`, `src/components/admin/pricing/*`.

## 15. Remaining risk

The only open dependency is derived nights/days from a `date_range` answer: until Phase 3 exposes it, such products must map an explicit numeric field or they cannot activate pricing.
