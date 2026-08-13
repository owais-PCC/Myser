/**
 * Local, standalone comparison harness — NOT deployed, not part of the
 * live API endpoint. Run this against a folder of real receipt photos to see
 * how Gemini 2.5 Flash / Claude Haiku 4.5 / GPT-4o-mini each handle the
 * exact same itemization prompt on the exact same image, side by side.
 *
 * Use free-tier / trial API keys for this (see TICKETS.md MYS-9 — "leverage
 * the free versions of all three models for testing... before paying a
 * single cent"). Costs nothing beyond whatever those free tiers allow.
 *
 * Usage:
 *   1. cd receipt-scan-api
 *   2. npm install
 *   3. Copy .env.example to .env.local and fill in whichever API keys you
 *      have (you don't need all three — the script skips providers with no
 *      key configured).
 *   4. Drop a few real receipt photos (jpg/png) into receipt-scan-api/scripts/samples/
 *      (gitignored — these are your own real receipts, not committed).
 *   5. npm run compare-models
 *
 * Prints each provider's raw parsed result per receipt so you can eyeball
 * accuracy (right items? right prices? right categories? did it hallucinate
 * anything?) before picking a winner for ACTIVE_PROVIDER in api/scan-receipt-itemized.ts.
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

import { buildItemizationPrompt } from "../lib/prompt";
import { callLlmProvider, LlmProvider } from "../lib/llmProviders";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SAMPLES_DIR = path.join(__dirname, "samples");

// Mirrors the real default category list the app sends (DEFAULT_CATEGORIES
// + ADDITIONAL_EXPENSE_CATEGORIES in src/lib/db.ts). Kept faithful rather
// than simplified on purpose: it includes the deliberate "Food" vs
// "Eating Out" overlap, which is exactly the case the disambiguation rules
// in lib/prompt.ts exist to handle — testing against a tidier list than
// production uses would hide whether those rules actually work.
const TEST_CATEGORIES = [
  "Food",
  "Fuel",
  "Clothes",
  "Utilities",
  "Health",
  "Entertainment",
  "Charity",
  "Transport",
  "Education",
  "Other",
  "Groceries",
  "Snacks",
  "Eating Out",
  "Self Care",
  "Household",
  "Rent",
  "Subscriptions",
  "Travel",
  "Gifts",
];

const PROVIDERS: { name: LlmProvider; envVar: string }[] = [
  { name: "gemini", envVar: "GEMINI_API_KEY" },
  { name: "claude", envVar: "CLAUDE_API_KEY" },
  { name: "openai", envVar: "OPENAI_API_KEY" },
];

function mimeTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function main() {
  if (!fs.existsSync(SAMPLES_DIR)) {
    fs.mkdirSync(SAMPLES_DIR, { recursive: true });
    console.log(`Created ${SAMPLES_DIR} — drop a few real receipt photos in there and rerun.`);
    return;
  }

  const files = fs
    .readdirSync(SAMPLES_DIR)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

  if (files.length === 0) {
    console.log(`No receipt images found in ${SAMPLES_DIR} — add some (.jpg/.png) and rerun.`);
    return;
  }

  const prompt = buildItemizationPrompt(TEST_CATEGORIES);
  const activeProviders = PROVIDERS.filter((p) => !!process.env[p.envVar]);

  if (activeProviders.length === 0) {
    console.log(
      "No API keys found. Set GEMINI_API_KEY / CLAUDE_API_KEY / OPENAI_API_KEY in receipt-scan-api/.env.local (any subset)."
    );
    return;
  }

  console.log(`Testing ${activeProviders.map((p) => p.name).join(", ")} against ${files.length} receipt(s).\n`);

  for (const file of files) {
    const imagePath = path.join(SAMPLES_DIR, file);
    const base64Image = fs.readFileSync(imagePath).toString("base64");
    const mimeType = mimeTypeFor(file);

    console.log(`\n${"=".repeat(70)}\n${file}\n${"=".repeat(70)}`);

    for (const provider of activeProviders) {
      const apiKey = process.env[provider.envVar] as string;
      const start = Date.now();
      try {
        const rawText = await callLlmProvider(provider.name, { base64Image, mimeType, prompt, apiKey });
        const elapsedMs = Date.now() - start;
        console.log(`\n--- ${provider.name} (${elapsedMs}ms) ---`);
        try {
          const parsed = JSON.parse(rawText.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log("(raw, non-JSON):", rawText);
        }
      } catch (err) {
        console.log(`\n--- ${provider.name} FAILED ---`);
        console.log((err as Error).message);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
