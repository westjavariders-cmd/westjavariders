# Phase 3 — Product & Configurator Builder

## 1. Scope proposed

Admin-only builder, reusing the Phase 2 shell untouched:

- Products list: search by name/reference, filters (kind, status, category), columns for name, kind, status, categories, placements count, last update.
- Product editor with tabs: Details, Content (English master), Components, Configurator, Dependencies, Preview, Status.
- Categories and Placements library (one small settings-style page each), plus assignment inside the product with independent per-placement ordering.
- Component Templates library, and Product Components copied from a template or created directly, fully independent afterwards.
- Configurator: flow per product, steps, fields (all nine existing field types), field options, reordering, active flags.
- Dependency rule builder: WHEN field/option [operator] value THEN action ON target, scoped to the same product, action-aware inputs.
- Product duplication (product, content, categories, placements, components, flow, steps, fields, options, dependencies) as one server-side transaction.
- Configurator Preview rendering the real saved configuration, applying active flags, required state, min/max and the dependency actions.
- Validation report ("ready" vs "incomplete") shown in the Status tab; activation blocked when structurally invalid; saving drafts never blocked.
- Audit entries for product create/duplicate/status change, component create/edit, template change, and structural configurator changes (not for every keystroke).

## 2. Existing structures found

Database (Phase 1A) has only: `settings`, `currencies`, `languages`, `markets`, `user_roles`, `admin_audit_log`, plus helpers `is_admin()`, `is_staff_or_admin()`, `has_role()`, `set_updated_at()`, and the enums `product_kind`, `order_line_kind`, `payment_status`, `voucher_status`, `field_type`, `dependency_action`, `unit_basis`, `user_role`. No catalog tables exist yet.

Code: Admin shell (`AdminLayout`, `PageHeader`), nav definition, guarded `_app` layout with `adminSession.isAdmin`, `admin.functions.ts` server functions, `admin-audit.ts`, and the shadcn UI set. The Products nav item is currently a placeholder page.

## 3. Migrations required (one migration block)

New tables, each with GRANTs, RLS enabled and policies: read for staff+admin, write for admin only, no `anon` access at all (internal costs stay private; public read policies come with the public website phase).

- `products` — kind, internal_name, internal_ref (unique), status (`draft`/`active`/`inactive`/`archived` via constraint), sort_order, timestamps.
- `product_translations` — product, language code, title, summary, body, seo_title, seo_description; unique per product+language.
- `categories`, `placements` — slug, name, display_order, active.
- `product_categories`, `product_placements` — join tables; placement join carries its own `display_order`.
- `component_templates` — internal_name, customer_name, unit_basis, internal_cost, customer_price, min/max/default quantity, season_eligible, promo_eligible, active.
- `product_components` — same shape plus product, `source_template_id` (nullable, no cascade, traceability only), display_order, active.
- `config_flows` (1:1 product), `steps`, `fields` (variable_name unique per product, type, required, active, default_value, min/max, display_order), `field_options`, `dependencies` (product-scoped source field/option, operator, value, `dependency_action`, target field/option).
- Money/quantity inputs stored as `numeric` so decimals are preserved; the future pricing engine converts to integer IDR. No floats.
- Deliberately not created now: `pricing_rules`, `formulas`, `formula_versions`. Nothing in this phase reads or writes them, and creating them empty would freeze a shape before the pricing phase. Field `variable_name` uniqueness already gives future formulas their stable identifiers.

## 4. Files reused / added

Reuse: `AdminLayout`/`PageHeader`, `admin-audit.ts`, `admin.functions.ts` patterns, `admin-nav.ts` (Products becomes available; Categories/Placements and Component Templates added as Products children), shadcn form/table/dialog components, the existing `_app` guard.

Add: `src/lib/catalog.functions.ts` (duplication, validation, structural writes needing atomicity), `src/lib/catalog-validation.ts`, `src/components/admin/configurator/*` (field editor, option editor, dependency builder, preview renderer), routes under `src/routes/admin/_app/` for `products.index`, `products.$id`, `products.new`, `component-templates`, `catalog-taxonomy`.

## 5. Risks / contradictions found

- Phase 0 lists `product_placements` and categories but no explicit `product_categories`; adding that join table is the consistent reading.
- Phase 0 froze integer-only money for the pricing path; the builder needs decimal admin inputs. Resolved by storing builder inputs as `numeric` and keeping integer IDR at pricing/purchase time.
- Renaming a `variable_name` will matter once formulas exist; this phase warns on rename and enforces uniqueness, without dependency tracking.
- Staff get read-only catalog access, per the security rules.

## 6. Deferred to later phases

Formula evaluation, pricing rules, seasons, promo maths, currency conversion, cart, checkout, payments, purchases, vouchers, translation automation, public website and public read policies.
