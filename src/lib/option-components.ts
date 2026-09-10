import type { PricingRule } from "@/lib/pricing";

/**
 * A Configurator Option is linked to a Product Component through the existing
 * structured component pricing rule, with no new table and no new pricing
 * mechanism. The link is identified by this exact signature:
 *
 *   rule_type          = component_quantity
 *   component_id       = the Product Component
 *   condition_variable = the owning Field's variable_name
 *   condition_operator = equals
 *   condition_value    = the Option's internal_value
 */
export type OptionLinkKey = {
  componentId: string;
  variableName: string;
  internalValue: string;
};

export function isOptionComponentRule(rule: PricingRule, key: OptionLinkKey): boolean {
  return (
    rule.rule_type === "component_quantity" &&
    rule.component_id === key.componentId &&
    rule.condition_variable === key.variableName &&
    rule.condition_operator === "equals" &&
    rule.condition_value === key.internalValue
  );
}

/** Components linked to one Option, in rule order. */
export function linkedComponentIds(
  rules: PricingRule[],
  variableName: string,
  internalValue: string,
): string[] {
  return rules
    .filter(
      (r) =>
        r.rule_type === "component_quantity" &&
        r.condition_variable === variableName &&
        r.condition_operator === "equals" &&
        r.condition_value === internalValue &&
        r.component_id != null,
    )
    .map((r) => r.component_id as string);
}

/** The single rule that represents one Option → Component link, if it exists. */
export function findOptionComponentRule(
  rules: PricingRule[],
  key: OptionLinkKey,
): PricingRule | null {
  return rules.find((r) => isOptionComponentRule(r, key)) ?? null;
}
