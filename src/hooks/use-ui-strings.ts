/**
 * Fixed interface strings for the visitor's language.
 *
 * `t("Add to cart")` returns the translation stored in Admin, or the English
 * text when there is none.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getUiStrings } from "@/lib/translations.functions";
import { makeTranslator } from "@/lib/ui-strings";

export const UI_STRINGS_KEY = ["ui-strings"];

export function useUiStrings() {
  const load = useServerFn(getUiStrings);
  const query = useQuery({
    queryKey: UI_STRINGS_KEY,
    queryFn: () => load(),
    staleTime: 5 * 60 * 1000,
  });
  return makeTranslator(query.data?.strings);
}
