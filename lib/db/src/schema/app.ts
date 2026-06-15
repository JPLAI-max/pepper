import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Identity. Single-user for now (one row), but the data layer is multi-user
// shaped: profile + history rows carry userId, and all access goes through the
// getCurrentUserId() resolver. Adding real accounts later = swap the resolver
// + add a login screen, no table re-plumbing.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Real accounts: email + bcrypt password hash. Identity is now resolved from
  // the verified server-side session, not a singleton.
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;

// Per-user financial snapshot (one row per user).
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  // Multi-user-shaped: every profile row carries its owner. Default 1 matches
  // the singleton user (serial id 1) so existing rows backfill cleanly.
  userId: integer("user_id").notNull().default(1),
  displayName: text("display_name").notNull().default("Friend"),
  monthlyIncome: integer("monthly_income").notNull().default(0),
  monthlyExpenses: integer("monthly_expenses").notNull().default(0),
  cashSavings: integer("cash_savings").notNull().default(0),
  otherAssets: integer("other_assets").notNull().default(0),
  totalDebt: integer("total_debt").notNull().default(0),
  creditScore: integer("credit_score").notNull().default(0),
  preferredVoice: text("preferred_voice").notNull().default("female"),
  onboarded: boolean("onboarded").notNull().default(false),
  // Written by the silent extraction pass after each conversation turn.
  nextAction: text("next_action"),
  readyForReveal: boolean("ready_for_reveal").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Audit log: one row appended whenever a profile value changes.
export const profileHistory = pgTable("profile_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(1),
  field: text("field").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ProfileHistoryEntry = typeof profileHistory.$inferSelect;

export const profileUpdateSchema = createInsertSchema(profiles, {
  monthlyIncome: z.number().int().min(0).max(100_000_000),
  monthlyExpenses: z.number().int().min(0).max(100_000_000),
  cashSavings: z.number().int().min(0).max(1_000_000_000),
  otherAssets: z.number().int().min(0).max(1_000_000_000),
  totalDebt: z.number().int().min(0).max(1_000_000_000),
  creditScore: z.number().int().min(0).max(850),
  displayName: z.string().min(1).max(80),
  preferredVoice: z.enum(["female", "male"]),
})
  // Internal fields are never client-writable: userId is resolved server-side,
  // and nextAction / readyForReveal are written only by the extraction pass.
  .omit({
    id: true,
    updatedAt: true,
    userId: true,
    nextAction: true,
    readyForReveal: true,
  })
  .partial();

export type Profile = typeof profiles.$inferSelect;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

// Goals
export const GOAL_CATEGORIES = [
  "homeownership",
  "investing",
  "passive_income",
  "credit",
  "debt",
  "wealth",
] as const;

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  // Owner (real FK). No default: a future insert that forgets userId must
  // error, never silently land on user 1.
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  category: text("category").notNull().default("wealth"),
  targetAmount: integer("target_amount").notNull().default(0),
  currentAmount: integer("current_amount").notNull().default(0),
  targetDate: text("target_date"),
  status: text("status").notNull().default("active"),
  priority: integer("priority").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const goalInputSchema = createInsertSchema(goals, {
  title: z.string().min(1).max(120),
  category: z.enum(GOAL_CATEGORIES),
  targetAmount: z.number().int().min(0).max(1_000_000_000),
  currentAmount: z.number().int().min(0).max(1_000_000_000),
  status: z.enum(["active", "achieved", "paused"]),
  priority: z.number().int().min(0).max(100),
}).omit({ id: true, createdAt: true, userId: true });

export const goalUpdateSchema = goalInputSchema.partial();

export type Goal = typeof goals.$inferSelect;
export type GoalInput = z.infer<typeof goalInputSchema>;

// Roadmap steps
export const roadmapSteps = pgTable("roadmap_steps", {
  id: serial("id").primaryKey(),
  // Owner (real FK). No default — userId must always be set explicitly.
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  orderIndex: integer("order_index").notNull().default(0),
  actionLabel: text("action_label"),
  goalId: integer("goal_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const roadmapInputSchema = createInsertSchema(roadmapSteps, {
  title: z.string().min(1).max(160),
  status: z.enum(["todo", "in_progress", "done"]),
  orderIndex: z.number().int().min(0).max(10_000),
}).omit({ id: true, createdAt: true, userId: true });

export const roadmapUpdateSchema = roadmapInputSchema.partial();

export type RoadmapStep = typeof roadmapSteps.$inferSelect;
export type RoadmapInput = z.infer<typeof roadmapInputSchema>;

// Documents (drag-and-drop filing system)
export const DOCUMENT_CATEGORIES = [
  "Income",
  "Assets",
  "Identity",
  "Property",
  "Credit",
  "Other",
] as const;

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  // Owner (real FK). No default — userId must always be set explicitly.
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  status: text("status").notNull().default("needed"),
  orderIndex: integer("order_index").notNull().default(0),
  note: text("note"),
  // Phase 1 real uploads (architected for Phase 2 AI extraction).
  fileUrl: text("file_url"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const documentInputSchema = createInsertSchema(documents, {
  name: z.string().min(1).max(160),
  category: z.enum(DOCUMENT_CATEGORIES),
  status: z.enum(["needed", "in_progress", "complete"]),
  orderIndex: z.number().int().min(0).max(10_000),
  fileUrl: z.string().max(1024).nullish(),
  mimeType: z.string().max(255).nullish(),
  sizeBytes: z.number().int().min(0).max(2_000_000_000).nullish(),
}).omit({ id: true, createdAt: true, uploadedAt: true, userId: true });

export const documentUpdateSchema = documentInputSchema.partial();

export type Document = typeof documents.$inferSelect;
export type DocumentInput = z.infer<typeof documentInputSchema>;

// Opportunities (lending + investment marketplace)
export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("lending"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  detail: text("detail"),
  rate: text("rate"),
  term: text("term"),
  minAmount: integer("min_amount").notNull().default(0),
  tag: text("tag"),
  recommended: boolean("recommended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Opportunity = typeof opportunities.$inferSelect;

// Readiness scores. One row per (user, key) holding the latest deterministic
// score, its band label, and the educational "why" factors. Recomputed by the
// scoring engine whenever the profile changes.
export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    // e.g. homeownership, credit, debt, investing, passive_income, wealth
    key: text("key").notNull(),
    value: integer("value").notNull(),
    band: text("band").notNull(),
    // Single biggest helping / hurting factor (educational why). Null when no
    // component data is present yet.
    helpingFactor: text("helping_factor"),
    hurtingFactor: text("hurting_factor"),
    // True when one or more components had no data and were excluded.
    partial: boolean("partial").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userKey: unique("scores_user_key").on(t.userId, t.key),
  }),
);

export type Score = typeof scores.$inferSelect;

// Append-only log: one row whenever a score's value or band changes.
export const scoreHistory = pgTable("score_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  key: text("key").notNull(),
  value: integer("value").notNull(),
  band: text("band").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ScoreHistoryEntry = typeof scoreHistory.$inferSelect;
