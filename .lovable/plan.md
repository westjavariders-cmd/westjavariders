# Catalogue Templates — read-only architecture audit

Nothing was modified. All findings below come from the actual code and database.

## 1. Current architecture

Three independent catalogues, each with its own tables, admin screens and helper files:

- **Accommodation** — `accommodations` (type: hotel / beach_camping) → `accommodation_rooms` (price per night) → `accommodation_room_characteristics`, plus `accommodation_photos` (multi-photo, primary flag, private bucket).
- **Transport** — `transports` (predefined route / other location, origin, destination, 1–9 travel hours) → two price grids: `transport_people_prices` (1–4 people) and `transport_time_prices` (1–9 hours). Its price is the sum of one time price + one people price.
- **Motorbike** — a single `motorbikes` table with one flat customer/supplier price pair and one photo path.

They meet at exactly one seam: the **Catalogue Bridge**. A configurator question with `option_source = catalogue` and a `catalogue_type` gets its options from the bridge, which returns one uniform shape (`CatalogueItem`: id, name, reference, description, photo, customer price). The customer's choice is stored on the package as a historical snapshot, and the item's price is exposed to pricing as `<question>_price`.

There is **no public catalogue page**. Catalogue items appear only inside the configurator and in past-order summaries. `website_block_products` / "auto link products to the block" is a **separate, unrelated** mechanism that links Products (not catalogues) to website blocks. **Not related to catalogues.**

## 2. What is already generic — IMPLEMENTED / GENERIC

- The `CatalogueItem` contract and its customer-safe projection (supplier costs, internal notes and supplier contacts can never cross the bridge). **GENERIC**
- Selection matching, invalid-selection removal, and the price-variable injection. **GENERIC**
- Pricing: nothing in the pricing engine branches on catalogue type. It only asks "is this question catalogue-backed?". **GENERIC**
- Configurator rendering (public form and admin preview): identical option UI for all three catalogues. **GENERIC**
- Persistence: package selections and purchase snapshots store the type as plain text, so **adding** a new type is backward-compatible. **GENERIC**
- Security: every catalogue table uses the same rule — staff can read, admins can write, anonymous users cannot touch them. **GENERIC**

## 3. What is hardcoded — HARDCODED

- The list of the three catalogue types exists in **four** places: the database enum `catalogue_source_type`, the `CATALOGUE_TYPES` list, the labels map, and a duplicated labels map inside the admin question editor. **HARDCODED**
- One bespoke data resolver per catalogue (rooms join their parent hotel and photos; transport only exposes a price when unambiguous; motorbike reads flat columns) plus the switch that picks one. These are genuinely different queries, not boilerplate. **HARDCODED**
- Admin screens are copy-pasted: three list screens and three detail screens (~1,900 lines total) with no shared catalogue list/detail component. Photo manager, characteristics editor and price grids each exist for one catalogue only. **HARDCODED**
- Admin navigation lists "Hotels / Rooms", "Transport", "Motorbikes" as three fixed top-level entries — there is no "Catalogues" group. **HARDCODED**
- All public-facing type labels are English strings in code. There is **no translation table for catalogue items** (unlike products and website content). Per-item public text is limited to `public_name` and `description`. **HARDCODED**
- No categories/placements relationship for any catalogue table (products have both). **HARDCODED**

## 4. What would have to change — REQUIRES CHANGE

To reach `New Catalogue → choose template → configure → own public name`:

1. A `catalogues` instance table: id, template (accommodation / transport / motorbike), internal name, public name, description, active, sort order. **REQUIRES CHANGE**
2. An owning `catalogue_id` on `accommodations`, `transports`, `motorbikes`, backfilled so today's records belong to one default instance per template. **REQUIRES CHANGE**
3. Configurator questions must point at a **catalogue instance**, not a hardcoded type. Keeping the existing `catalogue_type` column and adding an optional instance reference is the non-breaking route: an unset instance means "all items of this template", exactly today's behaviour. **REQUIRES CHANGE / RISK**
4. The three resolvers stay, but each accepts an optional instance filter. The switch becomes template-based instead of type-based. **REQUIRES CHANGE**
5. One `New Catalogue` admin flow with a template picker, then routing into the existing (unchanged) editor for that template. **REQUIRES CHANGE**
6. Optional, only if multilingual catalogue text is wanted: a `catalogue_translations` table following the existing product/website translation pattern. **REQUIRES CHANGE**

Unchanged: pricing engine, packages, cart, checkout, purchase snapshots, vouchers, currency. Existing selections keep working because their stored type strings are untouched.

## 5. Is Template + Instance viable? — VIABLE, with one condition

Yes, technically viable, because the bridge already isolates the configurator, pricing and persistence from catalogue internals. The condition: the three templates must stay **exactly three behaviours**. A template is a *behaviour* (per-night rooms; people×hours grid; flat item price), not an arbitrary schema. Any future service that does not fit one of these three should be a normal **Product + Components** using the existing pricing system, not a new catalogue type. No CMS, no page builder, no schema builder, no new pricing engine.

## 6. Minimum safe implementation

Phase A (structure only, invisible to customers):
- Create `catalogues`, add nullable `catalogue_id` to the three tables, create one default instance per template, and point every existing record at it. Behaviour identical.

Phase B (admin):
- Add a "Catalogues" navigation group and a single `New Catalogue` flow with template selection. Existing Hotels / Transport / Motorbikes screens remain reachable and unchanged, now scoped by instance.

Phase C (configurator):
- Add the optional instance reference to catalogue questions and pass it into the resolvers. Unset = today's behaviour.

Phase D (optional):
- Public naming/description per instance and, if needed, catalogue translations using the existing pattern.

Each phase is independently shippable and reversible. Full test suite plus catalogue-bridge, configurator, cart and pricing regressions run at each step.

## 7. Main risks — RISK

- **Reference model change on questions** is the only genuinely risky edit; keeping `catalogue_type` and adding an optional instance keeps it additive. **RISK: medium, mitigated**
- **Historical integrity:** never rename or delete an existing type value — stored package selections and purchase snapshots embed those strings verbatim. Additive only. **RISK: high if violated**
- **Admin duplication:** refactoring the three copy-pasted admin screens into one shared shell in the same step would multiply regression surface. Do it later, separately, or not at all. **RISK: medium**
- **Template creep:** pressure to make templates configurable would turn this into a schema builder. Explicitly out of scope. **RISK: process**
- Four hardcoded copies of the type list must stay in sync; the duplicated labels map in the question editor should be consolidated. **RISK: low**

## 8. Recommendation

Compared to keeping things as they are (option A: zero effort, zero risk, but every new catalogue needs code, and public naming stays limited), generalizing (option B) costs one small additive migration and a moderate amount of admin work, with no impact on pricing, checkout or snapshots.

**Recommended: option B, restricted to Template + Instance, executed as Phase A → B → C.** Do not merge the admin refactor into it, and do not add new hardcoded catalogue types for future services — those belong in Products/Components.

Awaiting your decision before any implementation.
