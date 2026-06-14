import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Singleton financial snapshot for the (single) user in this first build.
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull().default("Friend"),
  monthlyIncome: integer("monthly_income").notNull().default(0),
  monthlyExpenses: integer("monthly_expenses").notNull().default(0),
  cashSavings: integer("cash_savings").notNull().default(0),
  otherAssets: integer("other_assets").notNull().default(0),
  totalDebt: integer("total_debt").notNull().default(0),
  creditScore: integer("credit_score").notNull().default(0),
  preferredVoice: text("preferred_voice").notNull().default("female"),
  onboarded: boolean("onboarded").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
  .omit({ id: true, updatedAt: true })
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
}).omit({ id: true, createdAt: true });

export const goalUpdateSchema = goalInputSchema.partial();

export type Goal = typeof goals.$inferSelect;
export type GoalInput = z.infer<typeof goalInputSchema>;

// Roadmap steps
export const roadmapSteps = pgTable("roadmap_steps", {
  id: serial("id").primaryKey(),
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
}).omit({ id: true, createdAt: true });

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
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  status: text("status").notNull().default("needed"),
  orderIndex: integer("order_index").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const documentInputSchema = createInsertSchema(documents, {
  name: z.string().min(1).max(160),
  category: z.enum(DOCUMENT_CATEGORIES),
  status: z.enum(["needed", "in_progress", "complete"]),
  orderIndex: z.number().int().min(0).max(10_000),
}).omit({ id: true, createdAt: true });

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
