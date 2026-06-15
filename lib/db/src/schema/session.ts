import { index, json, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session store table for connect-pg-simple. The shape (column names, types,
// and the IDX_session_expire index) must match what connect-pg-simple expects.
// Defined here so `drizzle-kit push` provisions it in every environment instead
// of relying on connect-pg-simple's createTableIfMissing (which reads a bundled
// table.sql that isn't resolvable under the dev/prod bundler's __dirname).
export const session = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);
