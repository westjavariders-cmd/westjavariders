# Configurator Option Component Links

## Scope
Add a small **Components** section to each manual Configurator Option. It will display, add, and remove links using the existing Structured Pricing `component_quantity` rules only. No public configurator, pricing calculation, dependency, catalogue, quantity, or commercial flow changes.

## Implementation
1. Add focused helpers for identifying an Option-linked component rule by the exact existing signature:
   - the Product's pricing record;
   - `rule_type = component_quantity`;
   - selected `component_id`;
   - owning Field `variable_name`;
   - `condition_operator = equals`;
   - Option `internal_value`.
2. Add authenticated server operations to list, add, and remove these links safely:
   - Admin-only mutations; Staff remains read-only;
   - verify the Option, Field, Component, Product, and Structured Pricing record all belong together;
   - adding an existing exact rule is idempotent and preserves its quantity settings;
   - a new rule uses the Component's existing basis/product quantity mapping without changing quantity configuration;
   - removal targets only the exact matching conditional rule and leaves all unrelated rules and Components untouched;
   - record the existing Admin audit events.
3. Extend the existing Configurator Option row with a compact **Components** section using the Product's existing Components. The field variable and option value are derived automatically and never entered by the Admin.
4. Update the existing atomic `duplicate_product(uuid)` transaction so it also copies Product Pricing and remaps copied `component_quantity` rules to the duplicated Product Components. Existing field variable names and option internal values remain unchanged, so their conditions stay associated with the duplicated Options. Copy related tiers, formula versions/test cases, season configuration, and pricing references already belonging to the product transaction so duplication remains complete and rollback-safe; do not alter any pricing semantics.

## Technical changes
- `src/components/admin/configurator/ConfiguratorTab.tsx`: render and operate the Option Components section.
- `src/lib/pricing.functions.ts`: authenticated exact-match list/add/remove operations.
- A focused library helper/test file for exact Option-link matching and pricing regressions.
- One database migration replacing only `duplicate_product(uuid)`; no tables, columns, enums, policies, or grants are added.
- Existing duplication tests are extended to verify remapped component rule relationships and rollback behavior.

## Verification
Focused tests will cover:
1. one Option linked to one Component;
2. one Option linked to multiple Components;
3. different Options activate only their Components;
4. unlinking preserves unrelated rules;
5. quantity questions still control quantities;
6. hidden/reset Options cannot charge linked Components;
7. existing structured pricing remains unchanged;
8. atomic Product duplication preserves remapped Option/Component pricing relationships.

Then run the relevant pricing, dependency/configurator, and duplication tests, followed by the full test suite, TypeScript check, and production build.
