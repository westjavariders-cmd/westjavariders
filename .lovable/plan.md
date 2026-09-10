# Read-only inspection: Configurator Options, Components, and Pricing

No code, schema, data, or UI changes are proposed or performed here.

## 1. Does an Option → Component relationship exist?

**No direct relationship exists.**

- `field_options` belongs only to a configurator `field`.
- `product_components` belongs to a `product` and may retain its source template.
- `dependencies` can use an option as a condition, but can target only fields or options.
- `pricing_rules.component_id` links a pricing rule to a component, not an option.
- There is no `component_id` on `field_options`, no `option_id` on `product_components` or `pricing_rules`, and no Option–Component junction table.

## 2. Existing indirect behavior

The pricing system can already reproduce “this selected option charges this component,” but it is not stored as a direct Option → Component link.

A structured `component_quantity` pricing rule stores:

- `component_id`: the existing Product Component to charge.
- `condition_variable`: the configurator field's stable `variable_name`.
- `condition_operator`: normally `equals` or `not_equals`.
- `condition_value`: the Option's `internal_value` as text.
- `quantity_variable`: an optional numeric configurator variable.

For a multi-select answer, `equals` currently means that the selected value list contains the configured value. The Admin Pricing screen already exposes these controls under **Component pricing**. The Configurator Option editor does not expose them, which is why an Option cannot currently be linked there.

This coupling is string-based. Renaming an Option's `internal_value` can therefore break the condition because there is no foreign key to the Option row.

## 3. How Components are included in pricing

### Structured pricing

A Product Component is **not automatically charged** merely because it exists or is active.

It contributes only when an active `pricing_rules` row of type `component_quantity` references it. The engine then:

1. Finds the referenced component and requires it to be active.
2. Evaluates the optional configurator condition.
3. Skips the charge with a zero breakdown line when the condition is not met.
4. Gets quantity from `pricing_rules.quantity_variable`, or from the product-level people/days/nights/sessions mapping implied by the component's `unit_basis`; fixed components use one unit.
5. Calculates `product_components.customer_price × quantity`.

Hidden or reset configurator answers are removed before pricing inputs are resolved, so they cannot satisfy the condition.

### Formula pricing

Structured component rules are ignored. Component customer prices are exposed to the formula as positional values such as `component_1`, but the formula must explicitly use them. There is no Option → Component relationship in formula mode either.

## 4. Smallest future change

### Smallest change using the current architecture

No database migration is strictly required. Add an Option-level Admin control that creates, updates, or deletes the existing conditional `component_quantity` pricing rules:

```text
component_id       = selected Product Component
condition_variable = owning Field.variable_name
condition_operator = equals
condition_value    = Option.internal_value
```

One Option activating several Components would create several pricing-rule rows. This preserves the current pricing engine and historical commercial flow.

Likely files:

- `src/components/admin/configurator/ConfiguratorTab.tsx` — expose linked Components in the Option editor.
- `src/components/admin/pricing/ComponentPricingEditor.tsx` — extract/reuse the existing component-condition controls where appropriate.
- `src/lib/pricing.functions.ts` — preferably add an Admin-authorized atomic operation to maintain these rules safely.
- `src/lib/pricing.ts` — likely no calculation change; only validation helpers may need reuse or tightening.
- `src/lib/component-pricing.test.ts` and focused Configurator Admin tests.

Existing tables reused:

- `field_options`
- `fields`
- `product_components`
- `product_pricing`
- `pricing_rules`

### If a durable direct relationship is required

Add a dedicated Option–Component junction table with foreign keys to `field_options.id` and `product_components.id`. That is more robust against renamed option values, but it is not the smallest change and would also require updates to product duplication, server loading, pricing resolution, RLS/audit, generated types, Admin UI, and tests.

## Files inspected

- `src/lib/catalog.ts`
- `src/lib/pricing.ts`
- `src/lib/pricing.functions.ts`
- `src/components/admin/configurator/ConfiguratorTab.tsx`
- `src/components/admin/configurator/DependenciesTab.tsx`
- `src/components/admin/pricing/PricingTab.tsx`
- `src/components/admin/pricing/ComponentPricingEditor.tsx`
- `src/lib/component-pricing.test.ts`
- `src/integrations/supabase/types.ts`
- Existing catalog and pricing migrations
