import { type Goal, type Profile } from "@workspace/db";
import { type ReadinessResult } from "./scoring";
import { primaryGoal } from "./roadmap";
import { FEATURE_FLAGS } from "./flags";

/**
 * Deterministic, educational opportunity-matching engine.
 *
 * Rules (mirror the scoring/roadmap engines):
 * - Pure function of the user's stored profile + primary goal + computed
 *   scores. No AI, no randomness, no advice.
 * - Matches tool CATEGORIES, never specific priced products. Framing is always
 *   educational: "tools that may help," tied to the roadmap. NEVER "you
 *   qualify," never an application, never an invented rate/amount.
 * - Investment / Property Income Units / margin are future-only: surfaced ONLY
 *   as "coming later," gated behind feature flags (default off). They are never
 *   presented as something to buy or apply for now.
 * - When readiness for the goal is still low, the right answer can be to take
 *   no financing step yet — surfaced as a "foundation first" recommendation.
 */

export type OpportunityStatus = "available" | "foundation" | "coming_later";

export interface OpportunityMatch {
  /** Stable category key (e.g. "fha", "conventional", "dscr"). */
  key: string;
  /** Human category label (Mortgage, Refinancing, Investment, Foundation). */
  category: string;
  title: string;
  /** Educational description of the tool category. */
  description: string;
  /** Why this surfaced, grounded in the user's stored data. */
  rationale: string;
  status: OpportunityStatus;
}

export interface OpportunityMatches {
  goalCategory: string | null;
  /** True when the recommendation is to build fundamentals before any tool. */
  foundationFirst: boolean;
  /** Current educational matches (available now, or "foundation first"). */
  matches: OpportunityMatch[];
  /** Future-only divisions, shown strictly as "coming later." */
  comingLater: OpportunityMatch[];
}

const scoreValue = (
  scores: ReadinessResult[],
  key: string,
): number | null => {
  const s = scores.find((x) => x.key === key);
  return s ? s.value : null;
};

// Educational thresholds (bands, not promises). These mirror the readiness
// engine's general scale and common product-education ranges.
const STRONG_READINESS = 80; // "Likely Ready" and above
const FOUNDATION_CEILING = 50; // below this, foundation work comes first
const INVEST_THRESHOLD = 60; // investment readiness worth studying tools
const FHA_CREDIT_MIN = 580;
const FHA_CREDIT_MAX = 699; // FHA is built for a still-growing credit profile
const STRONG_CREDIT = 700;
const LIMITED_CASH = 20000; // savings still building (mirrors scoring scale)

/**
 * Compute the matched opportunity categories for a user. Pure and
 * deterministic; compute-on-read (no persistence, no side effects).
 */
export function computeOpportunityMatches(
  p: Profile,
  goals: Goal[],
  scores: ReadinessResult[],
): OpportunityMatches {
  const goal = primaryGoal(goals);
  const category = goal?.category ?? null;

  const homeVal = scoreValue(scores, "homeownership");
  const investVal = scoreValue(scores, "investing");
  const hasCredit = p.creditScore > 0;
  const credit = p.creditScore;
  const cash = p.cashSavings;

  const isInvestorGoal =
    category === "investing" || category === "passive_income";

  // The readiness that matters for this goal drives "foundation first."
  const focusVal = isInvestorGoal ? investVal : homeVal;
  const foundationFirst = focusVal === null || focusVal < FOUNDATION_CEILING;

  const matches: OpportunityMatch[] = [];

  if (foundationFirst) {
    matches.push({
      key: "foundation",
      category: "Foundation",
      title: "Build your foundation first",
      description:
        "Before any lending or investment tool, the highest-value move is strengthening the fundamentals on your roadmap — savings, credit, and debt. Sometimes the right answer is to take no financing step yet.",
      rationale:
        focusVal === null
          ? "There isn't enough in your profile yet to match specific tools — share your income, savings, debt, and credit with Pepper and the right options will surface."
          : `Your readiness for this goal is still building (${focusVal}/100), so foundation work comes before any product.`,
      status: "foundation",
    });
  }

  // ---- Homeownership-oriented categories ----------------------------------
  if (category === "homeownership") {
    const fhaFits =
      hasCredit &&
      credit >= FHA_CREDIT_MIN &&
      credit <= FHA_CREDIT_MAX &&
      cash < LIMITED_CASH;

    const conventionalFits =
      (homeVal !== null && homeVal >= STRONG_READINESS) ||
      (hasCredit && credit >= STRONG_CREDIT && cash >= LIMITED_CASH);

    if (fhaFits) {
      matches.push({
        key: "fha",
        category: "Mortgage",
        title: "FHA loan (informational)",
        description:
          "An FHA loan is a government-backed mortgage built for buyers making a smaller down payment with a still-growing credit profile. Worth understanding as a tool on your path to a home — not an application, just an option that may fit your roadmap.",
        rationale: `Your goal is homeownership, your credit (${credit}) is in a developing range, and your savings are still building — the situation FHA was designed for.`,
        status: "available",
      });
    }

    if (conventionalFits) {
      matches.push({
        key: "conventional",
        category: "Mortgage",
        title: "Conventional mortgage (informational)",
        description:
          "A conventional mortgage generally rewards stronger credit and a larger down payment with more flexibility. As your readiness climbs, it becomes a tool to compare against other mortgage options.",
        rationale:
          homeVal !== null && homeVal >= STRONG_READINESS
            ? `Your homeownership readiness (${homeVal}/100) is in the strong range where conventional financing is worth understanding.`
            : `Your credit (${credit}) and savings put conventional financing within the set of tools to learn about.`,
        status: "available",
      });
    }

    // Neither specific mortgage matched and we're not in foundation mode —
    // give a non-empty, honest next step rather than inventing a fit.
    if (!fhaFits && !conventionalFits && !foundationFirst) {
      matches.push({
        key: "mortgage_general",
        category: "Mortgage",
        title: "Mortgage options (informational)",
        description:
          "Several mortgage types could support your home goal. Which fits depends on your credit and down payment — share those with Pepper and the list narrows to the tools that actually apply.",
        rationale:
          "Your goal is homeownership, but there isn't yet enough credit/savings detail to point to a specific mortgage type.",
        status: "available",
      });
    }
  }

  // ---- Investor-oriented categories ---------------------------------------
  if (isInvestorGoal && investVal !== null && investVal >= INVEST_THRESHOLD) {
    matches.push({
      key: "dscr",
      category: "Investment financing",
      title: "DSCR loan (informational)",
      description:
        "A DSCR loan finances a rental based on the property's projected income rather than your personal income — a tool real-estate investors study as they prepare for a first or next property.",
      rationale: `Your goal is ${
        category === "passive_income" ? "passive income" : "investing"
      } and your investment readiness (${investVal}/100) has reached the range where this tool is worth understanding.`,
      status: "available",
    });
  }

  // HELOC / cash-out refi only applies to existing homeowners with equity,
  // which this profile doesn't capture — so it's surfaced conditionally and
  // never asserts ownership.
  if (isInvestorGoal || category === "wealth") {
    matches.push({
      key: "heloc",
      category: "Refinancing",
      title: "HELOC / cash-out refinance (informational)",
      description:
        "If you already own a home with built-up equity, a HELOC or cash-out refinance lets some owners borrow against that equity to fund a down payment or investment. Share your home's value and mortgage balance and Pepper can explore whether it fits your roadmap.",
      rationale:
        "Your goal points toward putting existing assets to work. This tool only applies if you own a home with equity, which isn't captured in your profile yet.",
      status: "available",
    });
  }

  // ---- Future-only divisions: strictly "coming later" ---------------------
  const comingLater: OpportunityMatch[] = [];
  const futureRationale =
    "Gated as future-only — not available to act on in this build.";

  const future: Array<{
    key: string;
    category: string;
    title: string;
    description: string;
    /**
     * When the real, regulated experience for this division has shipped (its
     * flag is on), it is no longer a "coming later" teaser — the live surface
     * owns it elsewhere, so the matcher drops it from the preview. The matcher
     * itself NEVER marks these divisions "available": investment / income units
     * / margin are educational-only here and must never read as "buy/invest
     * now," regardless of env configuration.
     */
    live: boolean;
  }> = [
    {
      key: "investment_marketplace",
      category: "Investment",
      title: "Investment marketplace",
      description:
        "A curated marketplace of investment products is planned for a future release. Shown here so you know what's coming — there is nothing to buy now.",
      live: FEATURE_FLAGS.securitiesLive,
    },
    {
      key: "property_income_units",
      category: "Property Income Units",
      title: "Property Income Units",
      description:
        "Property Income Units (fractional, income-producing real estate) are planned for later. Educational only for now — not available to purchase.",
      live: FEATURE_FLAGS.incomeUnitsLive,
    },
    {
      key: "margin",
      category: "Margin",
      title: "Margin products",
      description:
        "Margin-based products are a future capability. They carry added risk and are not offered in this build.",
      live: FEATURE_FLAGS.marginLive,
    },
  ];

  for (const f of future) {
    // A live flag means the real experience exists elsewhere; stop teasing it.
    if (f.live) continue;
    comingLater.push({
      key: f.key,
      category: f.category,
      title: f.title,
      description: f.description,
      rationale: futureRationale,
      status: "coming_later",
    });
  }

  return { goalCategory: category, foundationFirst, matches, comingLater };
}
