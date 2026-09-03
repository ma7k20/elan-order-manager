import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const aiSettingsTable = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  model: text("model").notNull().default("gemini-3-flash-preview"),
  systemPrompt: text("system_prompt").notNull().default(""),
  welcomeMessage: text("welcome_message").notNull().default("أهلاً وسهلاً ❤️ كيف بقدر أساعدك؟"),
  humanHandoffMessage: text("human_handoff_message").notNull().default("أكيد ❤️ رح أحول محادثتك للمسؤول وبنتابع معك."),
  maxHistory: integer("max_history").notNull().default(12),
  temperature: numeric("temperature", { precision: 3, scale: 2, mode: "number" }).notNull().default(0.3),
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(20),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AiSettings = typeof aiSettingsTable.$inferSelect;