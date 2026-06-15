/**
 * Feature flags for product divisions that are NOT live in this build.
 *
 * Securities/investment products, Property Income Units (fractional real
 * estate), and margin are future-only. The opportunity matcher surfaces them
 * strictly as "coming later" — never as something to buy or apply for now.
 *
 * Each flag defaults to OFF. Flipping the matching env var to "true" is what a
 * future build would do to make a division live; until then the matcher keeps
 * these strictly informational.
 */
const flag = (name: string): boolean =>
  (process.env[name] ?? "").toLowerCase() === "true";

export const FEATURE_FLAGS = {
  /** Investment / securities marketplace. */
  securitiesLive: flag("SECURITIES_LIVE"),
  /** Property Income Units (fractional income-producing real estate). */
  incomeUnitsLive: flag("INCOME_UNITS_LIVE"),
  /** Margin-based products. */
  marginLive: flag("MARGIN_LIVE"),
} as const;
