/**
 * Thin adapters over each vision-capable LLM's REST API, sharing one
 * interface (image + prompt -> raw text response). Deliberately calling
 * REST directly instead of pulling in each vendor's full SDK — we only need
 * one endpoint each, and three heavy SDKs is unnecessary weight in a
 * serverless function's cold-start path.
 *
 * Which provider actually gets used in production is picked at call time by
 * ACTIVE_PROVIDER (see api/scan-receipt-itemized.ts) — this file exists so scripts/compare-models.ts
 * can run all three side-by-side on the same receipts before we commit to
 * one (see TICKETS.md MYS-9 "leverage free tiers of all three for testing").
 *
 * All three take Anthropic/Google/OpenAI free-tier or trial API keys during
 * development — no cost incurred until real users are on the Pro plan and
 * these keys are swapped for billed ones.
 */

export type LlmProvider = "gemini" | "claude" | "openai";

interface CallArgs {
  base64Image: string;
  mimeType: string; // e.g. "image/jpeg"
  prompt: string;
  apiKey: string;
}

async function callGemini({ base64Image, mimeType, prompt, apiKey }: CallArgs): Promise<string> {
  // Flash-tier model: cheapest vision pricing of the three, Google's own
  // structured-extraction use case — the default recommendation in
  // TICKETS.md MYS-9. Using the "-latest" alias (not a pinned version like
  // "gemini-2.5-flash") deliberately — confirmed live that a hardcoded
  // version number breaks outright once Google retires it for new API
  // keys ("model no longer available to new users"), while this alias
  // just keeps resolving to whatever Google's current flash model is
  // (gemini-3.6-flash as of this writing). Swap for flash-lite/pro to test.
  const model = "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as any;
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(json)}`);
  return text;
}

async function callClaude({ base64Image, mimeType, prompt, apiKey }: CallArgs): Promise<string> {
  // Current model ID, no date suffix — Anthropic's IDs are complete as
  // written and a date-suffixed variant is not a valid model. (An earlier
  // draft of this file had "claude-haiku-4-5-20251001", which is the kind
  // of thing that 404s the same way the pinned Gemini version did.)
  // Opus is the default tier; swap for "claude-haiku-4-5" if the cost per
  // scan matters more than extraction accuracy on messy receipts.
  const model = "claude-opus-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64Image } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as any;
  const text = json?.content?.[0]?.text;
  if (!text) throw new Error(`Claude returned no text: ${JSON.stringify(json)}`);
  return text;
}

async function callOpenAI({ base64Image, mimeType, prompt, apiKey }: CallArgs): Promise<string> {
  // NOT yet verified against a live key — unlike Gemini (confirmed working)
  // and Claude (ID checked against Anthropic's current model list), nobody
  // has run a real request through this path. Verify before trusting it:
  // the Gemini retirement showed a hardcoded model ID fails loudly and
  // late. See receipt-scan-api/README.md.
  const model = "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as any;
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenAI returned no text: ${JSON.stringify(json)}`);
  return text;
}

export async function callLlmProvider(provider: LlmProvider, args: CallArgs): Promise<string> {
  switch (provider) {
    case "gemini":
      return callGemini(args);
    case "claude":
      return callClaude(args);
    case "openai":
      return callOpenAI(args);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
