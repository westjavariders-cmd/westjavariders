/** Default upper bound for quantity/number steppers when Admin left max empty. */
export const DEFAULT_QUANTITY_MAX = 30;

/**
 * Inclusive integer choices for a public quantity stepper.
 * Missing min starts at 1. Missing max uses 30, or min if min is already higher.
 */
export function integerQuantityChoices(
  min: number | null | undefined,
  max: number | null | undefined,
): number[] {
  const lo = min == null || !Number.isFinite(Number(min)) ? 1 : Math.max(0, Math.round(Number(min)));
  const hiRaw =
    max == null || !Number.isFinite(Number(max)) ? DEFAULT_QUANTITY_MAX : Math.round(Number(max));
  const hi = Math.max(lo, hiRaw);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}
