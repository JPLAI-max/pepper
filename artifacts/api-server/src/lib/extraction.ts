import { asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  messages,
  profiles,
  profileHistory,
  type Profile,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { persistReadinessScores } from "./scoring";
import { persistRoadmap } from "./roadmap";

// Cheap/small model — this runs on every user turn, so keep cost down.
const EXTRACT_MODEL = process.env.EXTRACT_MODEL ?? "gpt-4o-mini";

const EXTRACTION_SYSTEM_PROMPT = `Extract the user's financial profile from the ENTIRE conversation so far. Always re-state every value the user has stated at any point — carry forward values mentioned in earlier turns even if this latest turn did not repeat them. Only change a value if the user explicitly updates it (e.g. "I paid off my car loan"). Return ONLY this JSON shape. Use null ONLY for values the user has never stated anywhere in the conversation. NEVER invent or estimate numbers. Set ready_for_reveal true only once goal + income + debt + a credit sense + a spending sense are all present. Always populate next_action with the single highest-impact next step.

Shape:
{
  "extracted": {
    "goal": { "type": null, "is_primary": null, "timeline": null, "motivation": null },
    "income": { "annual": null, "monthly": null, "employment_type": null },
    "assets": { "cash": null, "savings": null, "retirement": null },
    "debt": { "credit_cards": null, "auto": null, "student": null, "personal": null },
    "credit": { "score_estimate": null },
    "spending": { "housing": null, "transportation": null, "dining": null, "subscriptions": null },
    "properties": []
  },
  "ready_for_reveal": false,
  "next_action": ""
}`;

// Tolerant schema — the model may omit keys or send nulls. Validate gracefully.
const num = z.number().nullable().optional();
const str = z.string().nullable().optional();

/**
 * The financial-facts portion of an extraction. Shared by the conversation
 * extraction pass AND the document parser so both map onto the profile through
 * the exact same path. Every field is optional/nullable: a value the source
 * never stated stays null and is never invented.
 */
export const ExtractedFinancials = z
  .object({
    goal: z
      .object({
        type: str,
        is_primary: z.boolean().nullable().optional(),
        timeline: str,
        motivation: str,
      })
      .partial()
      .optional(),
    income: z
      .object({ annual: num, monthly: num, employment_type: str })
      .partial()
      .optional(),
    assets: z
      .object({ cash: num, savings: num, retirement: num })
      .partial()
      .optional(),
    debt: z
      .object({ credit_cards: num, auto: num, student: num, personal: num })
      .partial()
      .optional(),
    credit: z.object({ score_estimate: num }).partial().optional(),
    spending: z
      .object({
        housing: num,
        transportation: num,
        dining: num,
        subscriptions: num,
      })
      .partial()
      .optional(),
    properties: z.array(z.unknown()).optional(),
  })
  .partial()
  .optional();

export type ExtractedFinancials = z.infer<typeof ExtractedFinancials>;

const ExtractionResult = z.object({
  extracted: ExtractedFinancials,
  ready_for_reveal: z.boolean().optional().default(false),
  next_action: z.string().optional().default(""),
});

type ExtractionResult = z.infer<typeof ExtractionResult>;

/** Sum only the numeric, finite, non-null components. Undefined if none given. */
function sumPresent(...vals: Array<number | null | undefined>): number | undefined {
  const present = vals.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (present.length === 0) return undefined;
  return present.reduce((a, b) => a + b, 0);
}

const nonNeg = (n: number) => Math.max(0, Math.round(n));

/**
 * Map the extracted JSON onto the flat profile columns. Only fields actually
 * present this turn are returned. Aggregates (expenses, debt, savings) are the
 * sum of the categories the user has stated — derived arithmetic, never
 * invented numbers.
 */
export function mapToProfileFields(
  e: ExtractedFinancials,
  opts?: { deriveMonthlyFromAnnual?: boolean },
): Partial<Profile> {
  const updates: Partial<Profile> = {};
  if (!e) return updates;

  // Conversation extraction may derive a monthly figure from a stated annual
  // one (a number the user would expect). The document flow disables this:
  // documents must surface ONLY values literally printed on the page — deriving
  // monthly from an annual W-2 figure would be annualizing, which is forbidden.
  const allowAnnualDerive = opts?.deriveMonthlyFromAnnual !== false;
  const monthlyIncome =
    e.income?.monthly ??
    (allowAnnualDerive && e.income?.annual != null
      ? e.income.annual / 12
      : undefined);
  if (typeof monthlyIncome === "number" && Number.isFinite(monthlyIncome)) {
    updates.monthlyIncome = nonNeg(monthlyIncome);
  }

  const spending = sumPresent(
    e.spending?.housing,
    e.spending?.transportation,
    e.spending?.dining,
    e.spending?.subscriptions,
  );
  if (spending !== undefined) updates.monthlyExpenses = nonNeg(spending);

  const cash = sumPresent(e.assets?.cash, e.assets?.savings);
  if (cash !== undefined) updates.cashSavings = nonNeg(cash);

  if (e.assets?.retirement != null) {
    updates.otherAssets = nonNeg(e.assets.retirement);
  }

  const debt = sumPresent(
    e.debt?.credit_cards,
    e.debt?.auto,
    e.debt?.student,
    e.debt?.personal,
  );
  if (debt !== undefined) updates.totalDebt = nonNeg(debt);

  if (e.credit?.score_estimate != null) {
    updates.creditScore = Math.min(850, nonNeg(e.credit.score_estimate));
  }

  return updates;
}

async function runExtraction(
  conversationId: number,
): Promise<ExtractionResult | null> {
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] =
    [{ role: "system", content: EXTRACTION_SYSTEM_PROMPT }];
  for (const m of history) {
    if (m.role === "user" || m.role === "assistant") {
      chatMessages.push({ role: m.role, content: m.content });
    }
  }

  const completion = await openai.chat.completions.create({
    model: EXTRACT_MODEL,
    messages: chatMessages,
    response_format: { type: "json_object" },
    max_completion_tokens: 1024,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    logger.warn({ conversationId }, "Extraction returned non-JSON content");
    return null;
  }

  const parsed = ExtractionResult.safeParse(json);
  if (!parsed.success) {
    logger.warn(
      { conversationId, issues: parsed.error.issues },
      "Extraction JSON failed validation",
    );
    return null;
  }
  return parsed.data;
}

/**
 * Silent, server-side extraction pass. Runs after a user turn, reads the
 * conversation, asks a cheap model for a structured JSON snapshot, and persists
 * any newly-learned values onto the user's own profile — appending a
 * profile_history row for every value that actually changed. Its output is
 * NEVER sent to the chat UI. Designed to be fire-and-forget: it owns its
 * errors and never throws into the request.
 */
export async function extractAndPersist(
  conversationId: number,
  userId: number,
): Promise<void> {
  const result = await runExtraction(conversationId);
  if (!result) return;

  const current = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const profile = current[0];
  if (!profile) {
    logger.warn({ userId }, "Extraction: no profile for user, skipping persist");
    return;
  }

  const mapped = mapToProfileFields(result.extracted);

  await persistProfileFields(userId, mapped, {
    nextAction: result.next_action || undefined,
    readyForReveal: result.ready_for_reveal,
    source: `extraction:conversation:${conversationId}`,
  });
}

const NUMERIC_PROFILE_FIELDS = [
  "monthlyIncome",
  "monthlyExpenses",
  "cashSavings",
  "otherAssets",
  "totalDebt",
  "creditScore",
] as const;

/**
 * Persist a set of profile field updates onto the user's OWN profile, append a
 * profile_history row for every value that actually changed, then recompute the
 * readiness scores and roadmap. This is THE shared, auth-scoped persistence
 * path: both the silent conversation extraction pass and the confirmed
 * document-extraction flow write through here, so neither can fabricate values
 * or skip the downstream recompute. Only finite numeric values are applied;
 * undefined fields are left untouched. Returns the names of fields that changed.
 */
export async function persistProfileFields(
  userId: number,
  mapped: Partial<Profile>,
  extras?: {
    nextAction?: string;
    readyForReveal?: boolean;
    source?: string;
  },
): Promise<string[]> {
  const current = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const profile = current[0];
  if (!profile) {
    logger.warn({ userId }, "persistProfileFields: no profile for user, skipping");
    return [];
  }

  const updates: Partial<Profile> = {};
  const changes: { field: string; previous: string | null; next: string }[] = [];

  for (const field of NUMERIC_PROFILE_FIELDS) {
    const next = mapped[field];
    if (typeof next !== "number" || !Number.isFinite(next)) continue;
    const prev = profile[field];
    if (next !== prev) {
      (updates[field] as number) = next;
      changes.push({ field, previous: String(prev), next: String(next) });
    }
  }

  // next_action: store when present and changed.
  if (extras?.nextAction && extras.nextAction !== profile.nextAction) {
    updates.nextAction = extras.nextAction;
    changes.push({
      field: "nextAction",
      previous: profile.nextAction ?? null,
      next: extras.nextAction,
    });
  }

  // ready_for_reveal: sticky once true, so a later turn can't regress it.
  const nextReveal = profile.readyForReveal || extras?.readyForReveal === true;
  if (nextReveal !== profile.readyForReveal) {
    updates.readyForReveal = nextReveal;
    changes.push({
      field: "readyForReveal",
      previous: String(profile.readyForReveal),
      next: String(nextReveal),
    });
  }

  if (changes.length === 0) return [];

  await db
    .update(profiles)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(profiles.userId, userId));

  await db.insert(profileHistory).values(
    changes.map((c) => ({
      userId,
      field: c.field,
      previousValue: c.previous,
      newValue: c.next,
    })),
  );

  logger.info(
    { userId, source: extras?.source, changed: changes.map((c) => c.field) },
    "Persisted profile changes",
  );

  // Profile data changed → recompute readiness scores, then regenerate the
  // roadmap from the fresh scores. Each owns its errors so a failure here never
  // breaks the caller.
  try {
    await persistReadinessScores(userId);
  } catch (err) {
    logger.warn({ userId, err }, "Score recompute after persist failed");
  }

  try {
    await persistRoadmap(userId);
  } catch (err) {
    logger.warn({ userId, err }, "Roadmap regenerate after persist failed");
  }

  return changes.map((c) => c.field);
}
