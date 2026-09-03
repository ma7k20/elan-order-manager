import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  customerId: integer("customer_id"),
  phoneNumber: text("phone_number"),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;