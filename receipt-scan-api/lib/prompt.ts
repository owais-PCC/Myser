/**
 * The itemization prompt shared by every model provider. Kept in one place
 * so comparing Gemini/Claude/OpenAI in scripts/compare-models.ts is a fair
 * test — same instructions, same category list, only the model differs.
 *
 * Deliberately does NOT ask the model to decide how many transactions to
 * split into — that grouping step is deterministic app logic (group by
 * `category`, sum `line_total`), done client-side after this call returns.
 * Asking the model to do both the categorization AND the meta-step of
 * "how many groups" doubles the ways it can get things wrong for no benefit
 * (see TICKETS.md MYS-9 "Grouping is app logic, not the LLM's job").
 *
 * On category freedom: an earlier version of this prompt hard-constrained
 * the model to the user's existing list and bolted on hand-written
 * tie-break rules ("body soap is Self Care, dish soap is Household"). That
 * capped output quality at whatever cases we thought to enumerate, and
 * shoved anything unanticipated into a vague catch-all. The model has
 * better commonsense about this than a static rule list, so it now judges
 * freely and may propose a category the user doesn't have yet.
 *
 * The one guard retained is against CATEGORY SPRAWL, which is a real
 * failure mode rather than a hypothetical: if the model names the same
 * concept "Snacks", then "Snack Foods", then "Confectionery" across three
 * receipts, spending silently fragments across near-duplicate buckets and
 * month-over-month analytics stop meaning anything. Hence: existing
 * categories are a strong preference, and any newly proposed name must be
 * short, general and reusable. Proposals are flagged (`is_new`) so the
 * review sheet can show the user exactly what would be created before
 * anything is saved.
 */
export function buildItemizationPrompt(categoryNames: string[]): string {
  return `You are reading a photograph of a shopping receipt. Extract every purchased line item and assign each one a sensible spending category.

Return ONLY a JSON object (no markdown fences, no commentary) matching this exact shape:
{
  "merchant": string | null,
  "items": [
    {
      "item_name": string,
      "quantity": number,
      "unit_price": number,
      "line_total": number,
      "category": string,
      "is_new": boolean
    }
  ],
  "tax_amount": number | null,
  "currency": string | null
}

Categorisation:
- These are the categories the user already has: ${JSON.stringify(categoryNames)}
- Strongly prefer an existing category whenever one genuinely fits, and set "is_new": false. Reusing the user's own categories keeps their spending history consistent and comparable over time.
- If nothing in the list is a good fit, do NOT force the item into a vague catch-all. Propose a better category: put your suggested name in "category" and set "is_new": true.
- Use your own judgement about what belongs together. Pick the most specific category that is genuinely accurate.
- Any category you propose must be short, general and reusable across future receipts — a name like "Pets" or "Baby Care" is good; "Dog Food For Bruno" or "Weekly Shop 12 Aug" is not. Prefer widely-understood everyday names, and match the capitalisation style of the existing list.
- Reuse the same proposed name for every item on this receipt that belongs to it, rather than inventing near-duplicate variants.

Extraction:
- Ignore subtotal, total, and discount summary lines — only real purchased items go in "items".
- "tax_amount" should capture GST/VAT/sales-tax lines specifically (do not include it in any item's line_total).
- If quantity isn't printed, assume 1.
- If the receipt is handwritten, faded, or in a non-Latin script, still do your best — do not refuse.
- Numbers must be plain numbers (no currency symbols, no thousands separators).`;
}
