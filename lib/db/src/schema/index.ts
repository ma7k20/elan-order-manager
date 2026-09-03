import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

const auditFields = {
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const appAccountsTable = pgTable("app_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  pinHash: varchar("pin_hash", { length: 255 }).notNull(),
  canManageAccounts: boolean("can_manage_accounts").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSessionsTable = pgTable("app_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => appAccountsTable.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  alternatePhone: varchar("alternate_phone", { length: 50 }),
  address: text("address"),
  notes: text("notes"),
  deliveryRequired: boolean("delivery_required").notNull().default(false),
  deliveryAddress: text("delivery_address"),
  ...auditFields,
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  orderDate: date("order_date", { mode: "string" }).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("active"),
  deliveryMethod: varchar("delivery_method", { length: 20 }).notNull().default("pickup"),
  deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  deliveryAddress: text("delivery_address"),
  notes: text("notes"),
  ...auditFields,
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  imagePath: text("image_path"),
  name: varchar("name", { length: 300 }).notNull(),
  productUrl: text("product_url"),
  quantity: integer("quantity").notNull().default(1),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2, mode: "number" }).notNull(),
  commission: numeric("commission", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  sheinCost: numeric("shein_cost", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  productStatus: varchar("product_status", { length: 50 }).notNull().default("requested"),
  deliveryStatus: varchar("delivery_status", { length: 40 }).notNull().default("not_ready"),
  notes: text("notes"),
  ...auditFields,
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("ILS"),
  type: varchar("type", { length: 40 }).notNull(),
  method: varchar("method", { length: 40 }).notNull(),
  paymentDate: date("payment_date", { mode: "string" }).notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  ...auditFields,
});

export const sheinPurchasesTable = pgTable("shein_purchases", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 80 }).notNull().unique(),
  purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("ILS"),
  invoicePath: text("invoice_path"),
  notes: text("notes"),
  status: varchar("status", { length: 30 }).notNull().default("purchased"),
  ...auditFields,
});

export const purchaseItemsTable = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => sheinPurchasesTable.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => orderItemsTable.id, { onDelete: "cascade" }).unique(),
});

export const shipmentsTable = pgTable("shipments", {
  id: serial("id").primaryKey(),
  shipmentNumber: varchar("shipment_number", { length: 80 }).notNull().unique(),
  company: varchar("company", { length: 160 }).notNull(),
  trackingNumber: varchar("tracking_number", { length: 120 }),
  shipmentDate: date("shipment_date", { mode: "string" }).notNull(),
  arrivalDate: date("arrival_date", { mode: "string" }),
  shippingCost: numeric("shipping_cost", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  currency: varchar("currency", { length: 8 }).notNull().default("ILS"),
  status: varchar("status", { length: 30 }).notNull().default("preparing"),
  notes: text("notes"),
  ...auditFields,
});

export const shipmentPurchasesTable = pgTable("shipment_purchases", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => shipmentsTable.id, { onDelete: "cascade" }),
  purchaseId: integer("purchase_id").notNull().references(() => sheinPurchasesTable.id, { onDelete: "cascade" }),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("ILS"),
  category: varchar("category", { length: 50 }).notNull(),
  description: text("description").notNull(),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  relatedCustomerId: integer("related_customer_id").references(() => customersTable.id),
  relatedOrderId: integer("related_order_id").references(() => ordersTable.id),
  relatedPaymentId: integer("related_payment_id").references(() => paymentsTable.id),
  relatedPurchaseId: integer("related_purchase_id").references(() => sheinPurchasesTable.id),
  relatedShipmentId: integer("related_shipment_id").references(() => shipmentsTable.id),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  notes: text("notes"),
  ...auditFields,
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 80 }).notNull(),
  entity: varchar("entity", { length: 80 }).notNull(),
  entityId: integer("entity_id").notNull(),
  description: text("description").notNull(),
  userId: varchar("user_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  businessName: varchar("business_name", { length: 200 }).notNull().default("رفقة"),
  defaultCurrency: varchar("default_currency", { length: 8 }).notNull().default("ILS"),
  initialPaymentPercent: numeric("initial_payment_percent", { precision: 5, scale: 2, mode: "number" }).notNull().default(50),
  defaultDeliveryFee: numeric("default_delivery_fee", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
});

export const insertCustomerSchema = createInsertSchema(customersTable);
export const insertOrderSchema = createInsertSchema(ordersTable);
export const insertOrderItemSchema = createInsertSchema(orderItemsTable);
export const insertPaymentSchema = createInsertSchema(paymentsTable);
export const insertSheinPurchaseSchema = createInsertSchema(sheinPurchasesTable);
export const insertShipmentSchema = createInsertSchema(shipmentsTable);
export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable);
export const insertAppAccountSchema = createInsertSchema(appAccountsTable);

export type Customer = typeof customersTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type SheinPurchase = typeof sheinPurchasesTable.$inferSelect;
export type Shipment = typeof shipmentsTable.$inferSelect;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type AppAccount = typeof appAccountsTable.$inferSelect;