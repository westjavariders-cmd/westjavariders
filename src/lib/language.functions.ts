/**
 * Public language selection. Anonymous: the visitor picks the language the
 * configured website content is shown in.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicLanguages = createServerFn({ method: "GET" }).handler(async () => {
  const { listPublicLanguages, resolveLanguage } = await import("@/lib/language.server");
  const [languages, current] = await Promise.all([listPublicLanguages(), resolveLanguage()]);
  const master = languages.find((l) => l.is_master)?.code ?? languages[0]?.code ?? "en";
  return { languages, current: current ?? master };
});

export const setPublicLanguage = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(2).max(10) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { selectLanguage } = await import("@/lib/language.server");
    return selectLanguage(data.code);
  });
