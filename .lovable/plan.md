# Investigation: Catalogue selection → price → pricing engine → Formula Editor

Read-only findings, based on the current code. No changes made.

## 1. Where the catalogue selection is stored

- The customer's raw answer lives in the normal configurator answer map, keyed by the question's `variable_name` (the catalogue item's `id` as the value). Rendered in `src/components/public/ConfiguratorForm.tsx` (lines ~188-246), where a field with `option_source = "catalogue"` and a `catalogue_type` gets its choices from resolved catalogue items instead of `field_options`.
- On quoting, the selection is resolved into a snapshot list by `resolveCatalogueSelections` (`src/lib/catalogue-bridge.ts`), producing `CatalogueSelection` rows: `variable_name`, `catalogue_type`, `item_id`, `name`, `reference`, `customer_price_idr`.
- That list is persisted on the package: column `packages.catalogue_selections` (written in `src/lib/cart.server.ts` lines 474 and 526) and copied into the purchase snapshot (`src/lib/purchase.server.ts` lines 187, 284).

## 2. How the price of the selected item is obtained

Server-side only, in `src/lib/catalogue-bridge.server.ts` → `resolveCatalogue(s)`, which returns active, customer-safe items via `toCatalogueItem`:

- Accommodation room: `accommodation_rooms.customer_price_per_night_idr` → `customer_price_idr` (room only offered while its parent `accommodations.active` is true).
- Motorbike: `motorbikes.customer_price_idr` → `customer_price_idr`.
- Transport: `transport_people_prices.customer_price_idr` only when exactly one row exists, otherwise `null`.

Supplier costs, internal notes and internal names are never selected there (`FORBIDDEN_CATALOGUE_KEYS`).

## 3. Is it stored, calculated or passed to the pricing engine?

All three, in this order, inside `quotePackage` (`src/lib/cart.server.ts` lines 303-334):

1. Active items are resolved; invalid/inactive answers are stripped (`stripInvalidCatalogueAnswers`).
2. `cataloguePriceVariables(selections)` builds numeric variables (multiple selections on one field are summed; items with `customer_price_idr = null` are skipped).
3. Each is injected into the pricing inputs as a typed number: `inputs[name] = { type: "number", value: ... }`, then passed to `priceCommercial`.
4. The resolved values are stored on the package as `resolved_inputs`, and the item snapshot as `catalogue_selections`.

## 4. Does an internal numeric price variable exist?

Yes: `cataloguePriceVariable(variableName)` returns `` `${variableName}_price` `` (`src/lib/catalogue-bridge.ts` line 81). Example: a question with `variable_name = "motorbike"` produces `motorbike_price`; an accommodation room question `hotelroom` produces `hotelroom_price`.

## 5. Why it does not appear as an Available Value in the Formula Editor

`FormulaEditor.tsx` lists exactly what `formulaVariableNames(bundle, pricing)` returns (`src/lib/pricing.ts` lines 384-405). That function emits only:

- `base`
- one entry per active configurator field, using the field's own `variable_name` and its field type (a catalogue Choice field is therefore listed as type `string`/`list`, not as a price)
- `component_1..n` for product components

It never calls `cataloguePriceVariable`, so `<variable>_price` is not listed. The same gap exists in two other places:

- `formulaScope` (lines 371-382) copies `inputs` plus `base` and `component_<n>`. At real quote time `<variable>_price` is present because `quotePackage` injected it into `inputs`, so a formula that references it does evaluate.
- Activation/validation (lines 787-810) builds a `probe` input set from fields, `base` and components only — no `_price` keys. So activating a formula that references `motorbike_price` fails with `"motorbike_price" is not a known value for this product.` (thrown at line 525).
- Test Lab / preview (`src/lib/pricing.functions.ts` lines 275, 300, 349) uses `resolveInputs` alone, without the catalogue injection, so `_price` is also absent there.

Net effect: the variable exists and works in the live public quote, but is invisible in the editor and unusable in practice because validation and Test Lab reject it.

## 6. Where the catalogue price is used in pricing today

Only through the generic input map, never through a dedicated catalogue pricing path:

- Structured mode: a rule of type `variable_times_amount` (or a component quantity override) whose `variable_name` / `quantity_variable` is manually typed as `<variable>_price` will be read by `numberInput(inputs, name)` (`src/lib/pricing.ts` line 145). There is no UI hint that these names exist.
- Formula mode: reachable at quote time via `formulaScope` spreading `inputs`, but blocked at activation/validation as described above.
- `pricing_rules` has no catalogue column; nothing in `priceProduct` / `priceCommercial` references catalogue types.

## 7. Motorbike and Accommodation Room flows, concretely

```text
question (option_source=catalogue, catalogue_type=motorbike | accommodation_room)
  → ConfiguratorForm renders active items (resolveCatalogue)
  → answer: answers[variable_name] = item.id
  → quotePackage: resolveCatalogueSelections → CatalogueSelection{customer_price_idr}
        motorbike             ← motorbikes.customer_price_idr
        accommodation_room    ← accommodation_rooms.customer_price_per_night_idr
  → cataloguePriceVariables → inputs["<variable>_price"]
  → priceCommercial (structured rules / formula scope)
  → persisted: packages.resolved_inputs + packages.catalogue_selections
```

Note for accommodation: the bridge exposes the per-night price as-is; multiplying by nights is not automatic — it only happens if a pricing rule or formula multiplies `<variable>_price` by the nights variable.

## Smallest possible follow-up (not implemented)

If you want catalogue prices usable in the Formula Editor, the minimal change would be to add `<variable>_price` in three places that already share the same shape: `formulaVariableNames` (listing), the activation `probe`, and the Test Lab/preview input building — reusing `cataloguePriceVariable`. No schema, no new pricing path.
