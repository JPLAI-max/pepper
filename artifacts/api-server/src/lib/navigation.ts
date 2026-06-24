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
  "/goals",
  "/roadmap",
  "/readiness",
  "/opportunities",
  "/documents",
  "/market",
  "/financing",
  "/capital-markets",
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
  "/goals": "your Goals",
  "/roadmap": "your Roadmap",
  "/readiness": "your Readiness",
  "/opportunities": "Opportunities",
  "/documents": "your Documents",
  "/market": "the Trading Desk",
  "/financing": "Financing",
  "/capital-markets": "Capital Markets",
  "/reveal": "your Reveal",
};

/**
 * The guided tour: the ordered set of demo experiences Pepper walks the user
 * through. Every stop is an ALLOWLISTED in-app route (the `satisfies` below is
 * checked against `NavRoute`), so the tour can never cycle to an external or
 * off-list destination. `name` is the short label shown in the tour banner;
 * `intro` is the one-line introduction shown at each stop.
 */
export const TOUR_STOPS = [
  {
    route: "/dashboard",
    name: "Command Center",
    intro:
      "This is your Command Center — the home base where your wealth picture, scores, and next steps come together at a glance.",
  },
  {
    route: "/goals",
    name: "Goals",
    intro:
      "Here are your Goals — the things you're working toward, like buying a first home or building passive income.",
  },
  {
    route: "/roadmap",
    name: "Roadmap",
    intro:
      "This is your Roadmap — the personalized, step-by-step plan that gets you from where you are to where you want to be.",
  },
  {
    route: "/readiness",
    name: "Readiness",
    intro:
      "These are your Readiness scores — an educational read on homeownership, investment, credit, and debt, with no judgment.",
  },
  {
    route: "/opportunities",
    name: "Opportunities",
    intro:
      "Here's Opportunities — curated lending and investment options matched to your situation as you make progress.",
  },
  {
    route: "/documents",
    name: "Documents",
    intro:
      "This is your Documents vault — a private, organized home for the paperwork your goals depend on.",
  },
  {
    route: "/market",
    name: "Trading Desk",
    intro:
      "This is the Trading Desk — where live lending opportunities are listed and traded.",
  },
  {
    route: "/financing",
    name: "Financing",
    intro:
      "Here's Financing — how a borrower gets matched to the right loan for their goal.",
  },
  {
    route: "/capital-markets",
    name: "Capital Markets",
    intro:
      "And this is Capital Markets — where loans change hands on the secondary market.",
  },
] as const satisfies readonly { route: NavRoute; name: string; intro: string }[];

export type TourStop = (typeof TOUR_STOPS)[number];

// Cheap deterministic pre-filter so we only spend a classification call on turns
// that plausibly express a navigation request. Non-navigation overlay turns
// (explaining a screen, dictating a number) skip the classifier entirely.
const NAV_VERB_CUE =
  /\b(take me|bring me|go to|going to|navigate|open|show me|head (?:to|over|on)|jump to|switch to|pull up|get me to|let'?s (?:go|see|head))\b/i;
const NAV_DEST_CUE =
  /\b(trading desk|capital markets?|loan trading|secondary market|financing|lending|dashboard|command cent(?:er|re)|road ?map|readiness|goals?|opportunit(?:y|ies)|documents?|vault|reveal|the market)\b/i;
// Cues for the guided tour ("take me through the demos", "give me the tour"…).
const TOUR_CUE =
  /\b(tour|the demos|all the demos|through the demos|walk me through|show me everything|see everything|show me all)\b/i;

export function mightBeOverlayIntent(text: string): boolean {
  return NAV_VERB_CUE.test(text) || NAV_DEST_CUE.test(text) || TOUR_CUE.test(text);
}

/** The resolved, server-validated intent of an overlay turn. */
export interface OverlayIntent {
  /** An allowlisted single-route destination, or null. */
  navigate: NavRoute | null;
  /** True when the user asked to start the guided demo tour. */
  tour: boolean;
}

const NO_INTENT: OverlayIntent = { navigate: null, tour: false };

/**
 * The deterministic acknowledgement Pepper gives for a resolved navigation/tour
 * command. Because a navigation command is navigation — not a financial-advice
 * request — these turns are answered HERE and never sent to the coach model, so
 * they can never trigger the not-a-licensed-advisor guardrail. Returns null when
 * the intent resolves to nothing (the turn falls through to the coach instead).
 */
export function navConfirmationReply(intent: OverlayIntent): string | null {
  if (intent.tour) {
    return `Of course — let's take the tour, starting at the ${TOUR_STOPS[0].name}.`;
  }
  if (intent.navigate) {
    return `Of course — taking you to ${NAV_LABELS[intent.navigate]} now.`;
  }
  return null;
}

const NAV_MODEL = process.env.COACH_MODEL ?? "gpt-4o";

const NAV_SYSTEM_PROMPT = `You are a navigation intent classifier for the Pepper wealth app. Decide whether the user is asking to be TAKEN to (navigate to) one of the app's sections, or to start the guided demo TOUR.

Respond with JSON ONLY, in the form {"route": "<route>", "tour": <true|false>} where <route> is one of the allowed routes below (or an empty string "" when none applies) and "tour" is a boolean.

Allowed routes and the language that maps to each:
- "/dashboard" — dashboard, command center, home, overview
- "/goals" — my goals, goals
- "/roadmap" — my roadmap, my plan, my steps
- "/readiness" — readiness, my readiness scores, scores
- "/opportunities" — opportunities, deals, the marketplace
- "/documents" — documents, my documents, the vault, paperwork
- "/market" — the trading desk, the market
- "/financing" — financing, lending, loans (as a product area)
- "/capital-markets" — capital markets, loan trading, the secondary market
- "/reveal" — reveal

Rules:
- Return a route ONLY when the user clearly wants to GO there (e.g. "take me to financing", "open capital markets", "show me the trading desk", "go to my dashboard").
- Set "tour": true when the user wants a guided walkthrough of the demos ("give me the tour", "take me through the demos", "show me all the demos", "show me everything", "walk me through it"). When "tour" is true, "route" must be "".
- If the user is merely asking a QUESTION about a section ("what is the trading desk?", "explain financing", "how does capital markets work?"), return {"route": "", "tour": false}.
- If nothing matches, or the destination is outside the list, return {"route": "", "tour": false}.
- Never invent routes. Never return anything outside the allowed list.`;

/**
 * Resolve a free-form overlay message to an allowlisted in-app route and/or a
 * tour request. The model maps natural language to intent; the allowlist is the
 * final authority (a model that returns anything off-list is rejected here).
 * The tour, when requested, takes priority over a single-route navigation.
 */
export async function classifyOverlayIntent(
  userText: string,
): Promise<OverlayIntent> {
  if (!mightBeOverlayIntent(userText)) return NO_INTENT;
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
    if (!raw) return NO_INTENT;
    const parsed = JSON.parse(raw) as { route?: unknown; tour?: unknown };
    if (parsed.tour === true) return { navigate: null, tour: true };
    const route = typeof parsed.route === "string" ? parsed.route.trim() : "";
    return { navigate: isAllowedRoute(route) ? route : null, tour: false };
  } catch (err) {
    logger.warn({ err }, "Overlay intent classification failed");
    return NO_INTENT;
  }
}
