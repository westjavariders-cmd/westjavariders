/**
 * Text translation through the Lovable AI Gateway — server-only.
 *
 * Used by Admin to fill the existing website translation tables. It never
 * stores anything itself and never touches products, pricing or commerce.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export type TranslationEntry = { key: string; text: string };

/** The brand name is never translated. */
const DO_NOT_TRANSLATE = ["West Java Riders", "Cimaja Boardriders"];

function schema() {
  return {
    type: "json_schema" as const,
    name: "translations",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "text"],
            properties: { key: { type: "string" }, text: { type: "string" } },
          },
        },
      },
    },
  };
}

/**
 * Translates every entry into the target language. Returns a map keyed by the
 * entry key; a key missing from the answer is simply not translated.
 */
export async function translateEntries(
  entries: TranslationEntry[],
  target: { code: string; name: string },
  source: { code: string; name: string },
): Promise<Record<string, string>> {
  if (entries.length === 0) return {};
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI_NOT_CONFIGURED");

  const prompt = [
    `Translate the website texts below from ${source.name} (${source.code}) into ${target.name} (${target.code}).`,
    `Keep the same tone: short, calm, minimalist marketing copy for a surf and travel business.`,
    `Never translate these names: ${DO_NOT_TRANSLATE.join(", ")}.`,
    `Keep line breaks and punctuation. Return exactly one item per input key, with the same key.`,
    "",
    JSON.stringify({ items: entries }),
  ].join("\n");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      text: { format: schema() },
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 402 || response.status === 403) throw new Error("AI_CREDITS");
    throw new Error(`AI_FAILED ${response.status} ${detail.slice(0, 200)}`);
  }

  let text = "";
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let event: any;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event?.type === "response.completed") {
          const output = event.response?.output_text;
          if (typeof output === "string" && output.length > text.length) text = output;
        }
      }
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI_FAILED empty");
  }
  const out: Record<string, string> = {};
  for (const item of parsed?.items ?? []) {
    if (typeof item?.key === "string" && typeof item?.text === "string" && item.text.trim() !== "") {
      out[item.key] = item.text.trim();
    }
  }
  return out;
}
