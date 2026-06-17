import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

/**
 * Voice/typed navigation for the "Hey Pep" overlay (Mode B).
 *
 * The coach may resolve a request like "take me to the trading desk" into an
 * in-app route. The set of destinations Pepper is allowed to navigate to is an
 * ALLOWLIST enforced here, server-side. Anything off the list (an arbitrary
 * path, an external URL, or a section Pepper can't reach) resolves to `null` and
 * no navigation happens — there is no open redirect surface.
 */
export const NAV_ALLOWLIST = [
  "/dashboard",
  "/market",
  "/financing",
  "/capital-markets",
  "/roadmap",
  "/reveal",
] as const;

export type NavRoute = (typeof NAV_ALLOWLIST)[number];

const NAV_SET: Set<string> = new Set(NAV_ALLOWLIST);

export function isAllowedRoute(route: string): route is NavRoute {
  return NAV_SET.has(route);
}

/** Human-friendly labels Pepper uses when confirming a navigation out loud. */
export const NAV_LABELS: Record<NavRoute, string> = {
  "/dashboard": "your Command Center",
  "/market": "the Trading Desk",
  "/financing": "Financing",
  "/capital-markets": "Capital Markets",
  "/roadmap": "your Roadmap",
  "/reveal": "your Reveal",
};

// Cheap deterministic pre-filter so we only spend a classification call on turns
// that plausibly express a navigation request. Non-navigation overlay turns
// (explaining a screen, dictating a number) skip the classifier entirely.
const NAV_VERB_CUE =
  /\b(take me|bring me|go to|going to|navigate|open|show me|head (?:to|over|on)|jump to|switch to|pull up|get me to|let'?s (?:go|see|head))\b/i;
const NAV_DEST_CUE =
  /\b(trading desk|capital markets?|loan trading|secondary market|financing|lending|dashboard|command cent(?:er|re)|road ?map|reveal|the market)\b/i;

export function mightBeNavigation(text: string): boolean {
  return NAV_VERB_CUE.test(text) || NAV_DEST_CUE.test(text);
}

const NAV_MODEL = "gpt-5.4";

const NAV_SYSTEM_PROMPT = `You are a navigation intent classifier for the Pepper wealth app. Decide whether the user is asking to be TAKEN to (navigate to) one of the app's sections, and if so which one.

Respond with JSON ONLY, in the form {"route": "<route>"} where <route> is one of the allowed routes below, or an empty string "" when none applies.

Allowed routes and the language that maps to each:
- "/dashboard" — dashboard, command center, home, overview
- "/market" — the trading desk, the market
- "/financing" — financing, lending, loans (as a product area)
- "/capital-markets" — capital markets, loan trading, the secondary market
- "/roadmap" — my roadmap, my plan, my steps
- "/reveal" — reveal

Rules:
- Return a route ONLY when the user clearly wants to GO there (e.g. "take me to financing", "open capital markets", "show me the trading desk", "go to my dashboard").
- If the user is merely asking a QUESTION about a section ("what is the trading desk?", "explain financing", "how does capital markets work?"), return {"route": ""}.
- If nothing matches, or the destination is outside the list, return {"route": ""}.
- Never invent routes. Never return anything outside the allowed list.`;

/**
 * Resolve a free-form overlay message to an allowlisted in-app route, or `null`.
 * The model maps natural language to a route; the allowlist is the final
 * authority (a model that returns anything off-list is rejected here).
 */
export async function classifyNavigation(
  userText: string,
): Promise<NavRoute | null> {
  if (!mightBeNavigation(userText)) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: NAV_MODEL,
      response_format: { type: "json_object" },
      max_completion_tokens: 50,
      messages: [
        { role: "system", content: NAV_SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { route?: unknown };
    const route = typeof parsed.route === "string" ? parsed.route.trim() : "";
    return isAllowedRoute(route) ? route : null;
  } catch (err) {
    logger.warn({ err }, "Navigation classification failed");
    return null;
  }
}
