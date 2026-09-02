import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  auditLogsTable,
  customersTable,
  orderItemsTable,
  ordersTable,
  paymentsTable,
  purchaseItemsTable,
  settingsTable,
  sheinPurchasesTable,
  shipmentPurchasesTable,
  shipmentsTable,
  walletTransactionsTable,
} from "@workspace/db";
import {
  CreateCustomerBody,
  CreateOrderBody,
  CreatePaymentBody,
  CreatePurchaseBody,
  CreateShipmentBody,
  CreateWalletAdjustmentBody,
  CreateWalletTransactionBody,
  CancelPurchaseBody,
  CancelShipmentBody,
  GetCustomerParams,
  GetDashboardResponse,
  GetOrderParams,
  GetPurchaseParams,
  GetReportSummaryQueryParams,
  GetShipmentParams,
  GetSettingsResponse,
  GetWalletQueryParams,
  ListCustomersQueryParams,
  ListOrdersQueryParams,
  ListPaymentsQueryParams,
  ListAuditLogsQueryParams,
  UpdateCustomerBody,
  UpdateCustomerParams,
  UpdateOrderBody,
  UpdateOrderItemBody,
  UpdateOrderItemParams,
  UpdateOrderParams,
  UpdatePurchaseBody,
  UpdateSettingsBody,
  UpdateShipmentBody,
  UpdateShipmentParams,
  VoidPaymentBody,
  VoidPaymentParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

const today = () => new Date().toISOString().slice(0, 10);
const n = (value: unknown) => Number(value ?? 0);
const idOf = (value: string | string[]) => Number(Array.isArray(value) ? value[0] : value);
const dateOnly = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value ?? undefined;

async function audit(userId: string, action: string, entity: string, entityId: number, description: string) {
  await db.insert(auditLogsTable).values({ userId, action, entity, entityId, description });
}

async function itemDto(item: typeof orderItemsTable.$inferSelect) {
  const totalSelling = n(item.sellingPrice) * item.quantity;
  const totalCommission = n(item.commission) * item.quantity;
  const totalSheinCost = n(item.sheinCost) * item.quantity;
  return {
    id: item.id,
    orderId: item.orderId,
    customerId: item.customerId,
    imagePath: item.imagePath,
    name: item.name,
    productUrl: item.productUrl,
    quantity: item.quantity,
    sellingPrice: n(item.sellingPrice),
    commission: n(item.commission),
    sheinCost: n(item.sheinCost),
    totalSelling,
    totalCommission,
    totalSheinCost,
    paid: 0,
    remaining: totalSelling,
    productStatus: item.productStatus,
    deliveryStatus: item.deliveryStatus,
    purchaseId: null as number | null,
    shipmentId: null as number | null,
    notes: item.notes,
  };
}

async function purchaseForItem(itemId: number) {
  const rows = await db
    .select({ purchaseId: purchaseItemsTable.purchaseId, shipmentId: shipmentPurchasesTable.shipmentId })
    .from(purchaseItemsTable)
    .leftJoin(shipmentPurchasesTable, eq(shipmentPurchasesTable.purchaseId, purchaseItemsTable.purchaseId))
    .where(eq(purchaseItemsTable.itemId, itemId))
    .limit(1);
  return rows[0] ?? { purchaseId: null, shipmentId: null };
}

async function orderDto(orderId: number) {
  const rows = await db
    .select({ order: ordersTable, customer: customersTable })
    .from(ordersTable)
    .innerJoin(customersTable, eq(customersTable.id, ordersTable.customerId))
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!rows[0]) return null;
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const payments = await db
    .select({ amount: paymentsTable.amount, status: paymentsTable.status })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.orderId, orderId), eq(paymentsTable.status, "confirmed")));
  const paid = payments.reduce((sum, payment) => sum + n(payment.amount), 0);
  const mapped = await Promise.all(items.map(async (item) => ({ ...(await itemDto(item)), ...(await purchaseForItem(item.id)) })));
  const totalSelling = mapped.reduce((sum, item) => sum + item.totalSelling, 0);
  const totalCommission = mapped.reduce((sum, item) => sum + item.totalCommission, 0);
  const totalSheinCost = mapped.reduce((sum, item) => sum + item.totalSheinCost, 0);
  const arrivedCount = mapped.filter((item) => ["arrived", "arrived_waiting", "delivered"].includes(item.productStatus)).length;
  const missingCount = mapped.filter((item) => item.productStatus === "not_arrived").length;
  const deliveredCount = mapped.filter((item) => item.deliveryStatus === "delivered").length;
  const orderTotal = totalSelling + n(rows[0].order.deliveryFee);
  const paymentShare = orderTotal ? Math.min(1, paid / orderTotal) : 0;
  return {
    id: rows[0].order.id,
    orderNumber: rows[0].order.orderNumber,
    customerId: rows[0].order.customerId,
    customerName: rows[0].customer.name,
    customerPhone: rows[0].customer.phone,
    orderDate: rows[0].order.orderDate,
    status: rows[0].order.status,
    deliveryMethod: rows[0].order.deliveryMethod,
    deliveryFee: n(rows[0].order.deliveryFee),
    deliveryAddress: rows[0].order.deliveryAddress,
    notes: rows[0].order.notes,
    totalSelling,
    totalCommission,
    totalSheinCost,
    totalPaid: paid,
    remaining: Math.max(0, totalSelling + n(rows[0].order.deliveryFee) - paid),
    itemCount: mapped.length,
    arrivedCount,
    missingCount,
    deliveryStatus: deliveredCount === mapped.length ? "delivered" : arrivedCount > 0 ? "partial" : "not_ready",
    items: mapped.map((item) => ({ ...item, paid: item.totalSelling * paymentShare, remaining: Math.max(0, item.totalSelling * (1 - paymentShare)) })),
  };
}

async function orderSummary(orderId: number) {
  const detail = await orderDto(orderId);
  if (!detail) return null;
  return {
    id: detail.id,
    orderNumber: detail.orderNumber,
    customerId: detail.customerId,
    customerName: detail.customerName,
    customerPhone: detail.customerPhone,
    orderDate: detail.orderDate,
    status: detail.status,
    deliveryMethod: detail.deliveryMethod,
    deliveryFee: detail.deliveryFee,
    totalSelling: detail.totalSelling,
    totalCommission: detail.totalCommission,
    totalSheinCost: detail.totalSheinCost,
    totalPaid: detail.totalPaid,
    remaining: detail.remaining,
    itemCount: detail.itemCount,
    arrivedCount: detail.arrivedCount,
    missingCount: detail.missingCount,
    deliveryStatus: detail.deliveryStatus,
  };
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const transactions = await db.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.status, "confirmed"));
  const items = await db.select().from(orderItemsTable);
  const payments = await db.select({ payment: paymentsTable, customerName: customersTable.name })
    .from(paymentsTable).innerJoin(customersTable, eq(customersTable.id, paymentsTable.customerId))
    .orderBy(desc(paymentsTable.createdAt)).limit(5);
  const shipments = await db.select().from(shipmentsTable).orderBy(desc(shipmentsTable.createdAt)).limit(5);
  const recentShipments = await Promise.all(shipments.map(async (shipment) => {
    const links = await db.select({ purchaseId: shipmentPurchasesTable.purchaseId })
      .from(shipmentPurchasesTable).where(eq(shipmentPurchasesTable.shipmentId, shipment.id));
    return { ...shipment, shippingCost: n(shipment.shippingCost), purchaseIds: links.map((link) => link.purchaseId), receivingItems: [] };
  }));
  const income = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + n(t.amount), 0);
  const expenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + n(t.amount), 0);
  const nonPurchaseExpenses = transactions.filter((t) => t.type === "expense" && t.category !== "shein_purchase").reduce((sum, t) => sum + n(t.amount), 0);
  const revenue = orders.reduce((sum, order) => sum + n(order.deliveryFee), 0) + items.reduce((sum, item) => sum + n(item.sellingPrice) * item.quantity, 0);
  const productCosts = items.reduce((sum, item) => sum + n(item.sheinCost) * item.quantity, 0);
  const totalPaid = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + n(t.amount), 0);
  const dashboard = {
    walletBalance: income - expenses,
    totalIncome: income,
    totalExpenses: expenses,
    customerOwed: Math.max(0, revenue - totalPaid),
    depositsHeld: totalPaid,
    activeOrders: orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length,
    waitingProducts: items.filter((i) => i.productStatus === "requested" || i.productStatus === "in_shipping").length,
    arrivedUndelivered: items.filter((i) => ["arrived", "arrived_waiting"].includes(i.productStatus) && i.deliveryStatus !== "delivered").length,
    shipmentsInTransit: shipments.filter((s) => ["sent", "in_transit"].includes(s.status)).length,
    estimatedProfit: revenue - productCosts - nonPurchaseExpenses,
    commission: items.reduce((sum, item) => sum + n(item.commission) * item.quantity, 0),
    recentOrders: (await Promise.all(orders.slice(0, 5).map((o) => orderSummary(o.id)))).filter(Boolean),
    recentPayments: payments.map(({ payment, customerName }) => ({
      id: payment.id, customerId: payment.customerId, customerName, orderId: payment.orderId, amount: n(payment.amount),
      currency: payment.currency, type: payment.type, method: payment.method, paymentDate: payment.paymentDate,
      notes: payment.notes, status: payment.status, createdAt: payment.createdAt,
    })),
    recentExpenses: transactions.filter((t) => t.type === "expense").slice(0, 5).map(transactionDto),
    recentShipments,
    alerts: items.filter((i) => i.productStatus === "not_arrived").slice(0, 5).map((item) => ({
      id: `missing-${item.id}`, title: "منتج لم يصل", description: item.name, severity: "warning", href: `/orders/${item.orderId}`,
    })),
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

function transactionDto(t: typeof walletTransactionsTable.$inferSelect) {
  return {
    id: t.id, type: t.type, amount: n(t.amount), currency: t.currency, category: t.category, description: t.description,
    transactionDate: t.transactionDate, relatedCustomerId: t.relatedCustomerId, relatedOrderId: t.relatedOrderId,
    relatedPaymentId: t.relatedPaymentId, status: t.status, createdAt: t.createdAt,
  };
}

router.get("/activity", async (req, res): Promise<void> => {
  const query = ListAuditLogsQueryParams.safeParse(req.query);
  const limit = query.success ? query.data.limit ?? 20 : 20;
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(limit);
  res.json(logs);
});

router.get("/customers", async (req, res): Promise<void> => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;
  const customers = await db.select().from(customersTable).where(search ? or(ilike(customersTable.name, `%${search}%`), ilike(customersTable.phone, `%${search}%`)) : undefined).orderBy(desc(customersTable.createdAt));
  const result = await Promise.all(customers.map(async (customer) => {
    const orders = await db.select({ id: ordersTable.id, status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.customerId, customer.id));
    const payments = await db.select({ amount: paymentsTable.amount }).from(paymentsTable).where(and(eq(paymentsTable.customerId, customer.id), eq(paymentsTable.status, "confirmed")));
    const charged = await db.select({ total: sql<number>`coalesce(sum(${orderItemsTable.sellingPrice} * ${orderItemsTable.quantity}), 0)` }).from(orderItemsTable).where(eq(orderItemsTable.customerId, customer.id));
    const totalCharged = n(charged[0]?.total) + n((await db.select({ fee: sql<number>`coalesce(sum(${ordersTable.deliveryFee}), 0)` }).from(ordersTable).where(eq(ordersTable.customerId, customer.id)))[0]?.fee);
    const totalPaid = payments.reduce((sum, p) => sum + n(p.amount), 0);
    return { ...customer, totalOrders: orders.length, activeOrders: orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length, totalCharged, totalPaid, remaining: Math.max(0, totalCharged - totalPaid) };
  }));
  res.json(result);
});

router.post("/customers", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [customer] = await db.insert(customersTable).values({ ...parsed.data, createdBy: req.userId }).returning();
  await audit(req.userId, "created", "customer", customer.id, `تم إنشاء الزبون ${customer.name}`);
  res.status(201).json({ ...customer, totalOrders: 0, activeOrders: 0, totalCharged: 0, totalPaid: 0, remaining: 0 });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const parsed = GetCustomerParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, parsed.data.id));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  const orderRows = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.customerId, customer.id));
  const orders = (await Promise.all(orderRows.map((o) => orderSummary(o.id)))).filter(Boolean);
  const payments = await db.select({ payment: paymentsTable, customerName: customersTable.name }).from(paymentsTable).innerJoin(customersTable, eq(customersTable.id, paymentsTable.customerId)).where(eq(paymentsTable.customerId, customer.id)).orderBy(desc(paymentsTable.createdAt));
  const totalCharged = orders.reduce((sum, o) => sum + (o?.totalSelling ?? 0) + (o?.deliveryFee ?? 0), 0);
  const totalPaid = payments.filter(({ payment }) => payment.status === "confirmed").reduce((sum, { payment }) => sum + n(payment.amount), 0);
  res.json({ ...customer, totalOrders: orders.length, activeOrders: orders.filter((o) => o?.status !== "completed").length, totalCharged, totalPaid, remaining: Math.max(0, totalCharged - totalPaid), orders, payments: payments.map(({ payment, customerName }) => ({ ...payment, customerName, amount: n(payment.amount) })) });
});

router.patch("/customers/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  const body = UpdateCustomerBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid customer data" }); return; }
  const [customer] = await db.update(customersTable).set({ ...body.data, updatedAt: new Date() }).where(eq(customersTable.id, params.data.id)).returning();
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  await audit(req.userId, "updated", "customer", customer.id, `تم تعديل الزبون ${customer.name}`);
  const orders = await db.select({ id: ordersTable.id, status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.customerId, customer.id));
  const payments = await db.select({ amount: paymentsTable.amount }).from(paymentsTable).where(and(eq(paymentsTable.customerId, customer.id), eq(paymentsTable.status, "confirmed")));
  const charged = await db.select({ total: sql<number>`coalesce(sum(${orderItemsTable.sellingPrice} * ${orderItemsTable.quantity}), 0)` }).from(orderItemsTable).where(eq(orderItemsTable.customerId, customer.id));
  const delivery = await db.select({ fee: sql<number>`coalesce(sum(${ordersTable.deliveryFee}), 0)` }).from(ordersTable).where(eq(ordersTable.customerId, customer.id));
  const totalCharged = n(charged[0]?.total) + n(delivery[0]?.fee);
  const totalPaid = payments.reduce((sum, payment) => sum + n(payment.amount), 0);
  res.json({ ...customer, totalOrders: orders.length, activeOrders: orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length, totalCharged, totalPaid, remaining: Math.max(0, totalCharged - totalPaid) });
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const linkedOrders = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.customerId, params.data.id)).limit(1);
  const linkedPayments = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(eq(paymentsTable.customerId, params.data.id)).limit(1);
  if (linkedOrders.length || linkedPayments.length) {
    res.status(409).json({ error: "لا يمكن حذف عميل مرتبط بطلبات أو سجلات مالية. عدّل البيانات بدلاً من حذفها." });
    return;
  }
  const [deleted] = await db.delete(customersTable).where(eq(customersTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Customer not found" }); return; }
  res.sendStatus(204);
});

router.get("/orders", async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  const parsed = query.success ? query.data : {};
  const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const result = (await Promise.all(rows.map(async (order) => {
    const customer = await db.select().from(customersTable).where(eq(customersTable.id, order.customerId)).limit(1);
    const summary = await orderSummary(order.id);
    if (!summary) return null;
    if (parsed.search && !`${summary.orderNumber} ${summary.customerName} ${summary.customerPhone}`.toLowerCase().includes(parsed.search.toLowerCase())) return null;
    if (parsed.status && summary.status !== parsed.status) return null;
    if (parsed.deliveryStatus && summary.deliveryStatus !== parsed.deliveryStatus) return null;
    if (parsed.paymentStatus === "paid" && summary.remaining > 0) return null;
    if (parsed.paymentStatus === "remaining" && summary.remaining <= 0) return null;
    return summary;
  }))).filter(Boolean);
  res.json(result);
});

router.post("/orders", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const customer = await db.select().from(customersTable).where(eq(customersTable.id, parsed.data.customerId)).limit(1);
  if (!customer[0]) { res.status(400).json({ error: "Customer not found" }); return; }
  const created = await db.transaction(async (tx) => {
    const [order] = await tx.insert(ordersTable).values({
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      customerId: parsed.data.customerId, orderDate: dateOnly(parsed.data.orderDate)!, deliveryMethod: parsed.data.deliveryMethod,
      deliveryFee: parsed.data.deliveryFee ?? 0, deliveryAddress: parsed.data.deliveryAddress, notes: parsed.data.notes, createdBy: req.userId,
    }).returning();
    await tx.insert(orderItemsTable).values(parsed.data.items.map((item) => ({
      orderId: order.id, customerId: parsed.data.customerId, imagePath: item.imagePath, name: item.name, productUrl: item.productUrl,
      quantity: item.quantity, sellingPrice: item.sellingPrice, commission: item.commission, sheinCost: item.sheinCost, notes: item.notes, createdBy: req.userId,
    })));
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "created", entity: "order", entityId: order.id, description: `تم إنشاء الطلب ${order.orderNumber}` });
    return order;
  });
  const detail = await orderDto(created.id);
  res.status(201).json(detail);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const detail = await orderDto(parsed.data.id);
  if (!detail) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(detail);
});

router.patch("/orders/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  const body = UpdateOrderBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid order data" }); return; }
  const [order] = await db.update(ordersTable).set({
    orderDate: dateOnly(body.data.orderDate),
    status: body.data.status,
    deliveryMethod: body.data.deliveryMethod,
    deliveryFee: body.data.deliveryFee,
    deliveryAddress: body.data.deliveryAddress,
    notes: body.data.notes,
    updatedAt: new Date(),
  }).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  await audit(req.userId, "updated", "order", order.id, `تم تعديل الطلب ${order.orderNumber}`);
  res.json(await orderDto(order.id));
});

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const linkedPayments = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(eq(paymentsTable.orderId, params.data.id)).limit(1);
  const linkedWalletTransactions = await db.select({ id: walletTransactionsTable.id }).from(walletTransactionsTable).where(eq(walletTransactionsTable.relatedOrderId, params.data.id)).limit(1);
  const linkedPurchases = await db.select({ id: purchaseItemsTable.id }).from(purchaseItemsTable).innerJoin(orderItemsTable, eq(purchaseItemsTable.itemId, orderItemsTable.id)).where(eq(orderItemsTable.orderId, params.data.id)).limit(1);
  if (linkedPayments.length || linkedWalletTransactions.length || linkedPurchases.length) {
    res.status(409).json({ error: "لا يمكن حذف طلب مرتبط بدفعات أو مشتريات أو حركات محفظة. استخدم التعديل أو الإلغاء." });
    return;
  }
  const [deleted] = await db.delete(ordersTable).where(eq(ordersTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Order not found" }); return; }
  res.sendStatus(204);
});

router.patch("/orders/:id/items/:itemId", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateOrderItemParams.safeParse(req.params);
  const body = UpdateOrderItemBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid product data" }); return; }
  const [item] = await db.update(orderItemsTable).set({ ...body.data, updatedAt: new Date() }).where(eq(orderItemsTable.id, params.data.itemId)).returning();
  if (!item) { res.status(404).json({ error: "Product not found" }); return; }
  await audit(req.userId, "status_changed", "order_item", item.id, `تم تحديث حالة المنتج ${item.name}`);
  res.json({ ...(await itemDto(item)), ...(await purchaseForItem(item.id)) });
});

router.get("/payments", async (req, res): Promise<void> => {
  const query = ListPaymentsQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;
  const rows = await db.select({ payment: paymentsTable, customerName: customersTable.name }).from(paymentsTable).innerJoin(customersTable, eq(customersTable.id, paymentsTable.customerId)).orderBy(desc(paymentsTable.createdAt));
  res.json(rows.filter(({ payment, customerName }) => !search || `${customerName} ${payment.id} ${payment.orderId ?? ""}`.toLowerCase().includes(search.toLowerCase())).map(({ payment, customerName }) => ({ ...payment, customerName, amount: n(payment.amount) })));
});

router.post("/payments", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const customer = await db.select().from(customersTable).where(eq(customersTable.id, parsed.data.customerId)).limit(1);
  if (!customer[0]) { res.status(400).json({ error: "Customer not found" }); return; }
  const payment = await db.transaction(async (tx) => {
    const [created] = await tx.insert(paymentsTable).values({
      customerId: parsed.data.customerId,
      orderId: parsed.data.orderId,
      amount: parsed.data.amount,
      type: parsed.data.type,
      method: parsed.data.method,
      paymentDate: dateOnly(parsed.data.paymentDate)!,
      notes: parsed.data.notes,
      createdBy: req.userId,
    }).returning();
    const type = parsed.data.type === "refund" ? "expense" : "income";
    await tx.insert(walletTransactionsTable).values({
      type, amount: parsed.data.amount, currency: "ILS", category: `customer_${parsed.data.type}`, description: `دفعة من ${customer[0].name}`,
      transactionDate: dateOnly(parsed.data.paymentDate)!, relatedCustomerId: parsed.data.customerId, relatedOrderId: parsed.data.orderId, relatedPaymentId: created.id, createdBy: req.userId,
    });
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "created", entity: "payment", entityId: created.id, description: `تم تسجيل دفعة بقيمة ${parsed.data.amount} ₪` });
    return created;
  });
  res.status(201).json({ ...payment, customerName: customer[0].name, amount: n(payment.amount) });
});

router.post("/payments/:id/void", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = VoidPaymentParams.safeParse(req.params);
  const body = VoidPaymentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid void request" }); return; }
  const [payment] = await db.update(paymentsTable).set({ status: "voided", updatedAt: new Date() }).where(eq(paymentsTable.id, params.data.id)).returning();
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
  await db.update(walletTransactionsTable).set({ status: "voided", updatedAt: new Date() }).where(eq(walletTransactionsTable.relatedPaymentId, payment.id));
  await audit(req.userId, "voided", "payment", payment.id, body.data.reason);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, payment.customerId));
  res.json({ ...payment, customerName: customer?.name ?? "", amount: n(payment.amount) });
});

router.get("/purchases", async (_req, res): Promise<void> => {
  const purchases = await db.select().from(sheinPurchasesTable).orderBy(desc(sheinPurchasesTable.createdAt));
  const result = await Promise.all(purchases.map(async (purchase) => {
    const links = await db.select({ itemId: purchaseItemsTable.itemId }).from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchase.id));
    return { ...purchase, totalAmount: n(purchase.totalAmount), itemIds: links.map((l) => l.itemId) };
  }));
  res.json(result);
});

router.post("/purchases", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreatePurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const purchase = await db.transaction(async (tx) => {
    const [created] = await tx.insert(sheinPurchasesTable).values({
      invoiceNumber: parsed.data.invoiceNumber,
      purchaseDate: dateOnly(parsed.data.purchaseDate)!,
      totalAmount: parsed.data.totalAmount,
      currency: parsed.data.currency,
      invoicePath: parsed.data.invoicePath,
      notes: parsed.data.notes,
      createdBy: req.userId,
    }).returning();
    if (parsed.data.itemIds.length) {
      await tx.insert(purchaseItemsTable).values(parsed.data.itemIds.map((itemId) => ({ purchaseId: created.id, itemId })));
      await tx.update(orderItemsTable).set({ productStatus: "purchased" }).where(sql`${orderItemsTable.id} in (${sql.join(parsed.data.itemIds.map((id) => sql`${id}`), sql`, `)})`);
    }
    await tx.insert(walletTransactionsTable).values({ type: "expense", amount: parsed.data.totalAmount, currency: parsed.data.currency, category: "shein_purchase", description: `شراء شي إن ${parsed.data.invoiceNumber}`, transactionDate: dateOnly(parsed.data.purchaseDate)!, createdBy: req.userId });
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "created", entity: "shein_purchase", entityId: created.id, description: `تم تسجيل فاتورة شي إن ${created.invoiceNumber}` });
    return created;
  });
  res.status(201).json({ ...purchase, totalAmount: n(purchase.totalAmount), itemIds: parsed.data.itemIds });
});

router.get("/purchases/:id", async (req, res): Promise<void> => {
  const parsed = GetPurchaseParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [purchase] = await db.select().from(sheinPurchasesTable).where(eq(sheinPurchasesTable.id, parsed.data.id));
  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }
  const links = await db.select({ itemId: purchaseItemsTable.itemId }).from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchase.id));
  res.json({ ...purchase, totalAmount: n(purchase.totalAmount), itemIds: links.map((l) => l.itemId) });
});

router.patch("/purchases/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetPurchaseParams.safeParse(req.params);
  const body = UpdatePurchaseBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid purchase data" }); return; }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(sheinPurchasesTable).where(eq(sheinPurchasesTable.id, params.data.id));
    if (!existing) return null;
    if (existing.status === "cancelled") throw new Error("Cancelled purchases cannot be edited");
    const [purchase] = await tx.update(sheinPurchasesTable).set({
      invoiceNumber: body.data.invoiceNumber,
      purchaseDate: dateOnly(body.data.purchaseDate),
      totalAmount: body.data.totalAmount,
      currency: body.data.currency,
      notes: body.data.notes,
      updatedAt: new Date(),
    }).where(eq(sheinPurchasesTable.id, existing.id)).returning();
    const delta = body.data.totalAmount === undefined ? 0 : body.data.totalAmount - n(existing.totalAmount);
    if (delta !== 0) {
      await tx.insert(walletTransactionsTable).values({
        type: delta > 0 ? "expense" : "income",
        amount: Math.abs(delta),
        currency: body.data.currency ?? existing.currency,
        category: "shein_purchase_adjustment",
        description: `تعديل شراء شي إن ${purchase.invoiceNumber}`,
        transactionDate: dateOnly(body.data.purchaseDate) ?? existing.purchaseDate,
        createdBy: req.userId,
      });
    }
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "updated", entity: "shein_purchase", entityId: purchase.id, description: `تم تعديل فاتورة شي إن ${purchase.invoiceNumber}` });
    const links = await tx.select({ itemId: purchaseItemsTable.itemId }).from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchase.id));
    return { ...purchase, totalAmount: n(purchase.totalAmount), itemIds: links.map((l) => l.itemId) };
  });
  if (!result) { res.status(404).json({ error: "Purchase not found" }); return; }
  res.json(result);
});

router.post("/purchases/:id/cancel", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetPurchaseParams.safeParse(req.params);
  const body = CancelPurchaseBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "A cancellation reason is required" }); return; }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(sheinPurchasesTable).where(eq(sheinPurchasesTable.id, params.data.id));
    if (!existing) return { kind: "missing" as const };
    if (existing.status === "cancelled") return { kind: "already" as const, purchase: existing };
    const shipmentLink = await tx.select({ id: shipmentPurchasesTable.id }).from(shipmentPurchasesTable).where(eq(shipmentPurchasesTable.purchaseId, existing.id)).limit(1);
    if (shipmentLink.length) return { kind: "linked" as const };
    const [purchase] = await tx.update(sheinPurchasesTable).set({ status: "cancelled", notes: `${existing.notes ? `${existing.notes}\n` : ""}إلغاء: ${body.data.reason}`, updatedAt: new Date() }).where(eq(sheinPurchasesTable.id, existing.id)).returning();
    const links = await tx.select({ itemId: purchaseItemsTable.itemId }).from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchase.id));
    if (links.length) await tx.update(orderItemsTable).set({ productStatus: "requested", updatedAt: new Date() }).where(sql`${orderItemsTable.id} in (${sql.join(links.map((link) => sql`${link.itemId}`), sql`, `)})`);
    await tx.insert(walletTransactionsTable).values({ type: "income", amount: n(existing.totalAmount), currency: existing.currency, category: "shein_purchase_reversal", description: `إلغاء شراء شي إن ${existing.invoiceNumber}`, transactionDate: existing.purchaseDate, createdBy: req.userId });
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "cancelled", entity: "shein_purchase", entityId: purchase.id, description: `تم إلغاء فاتورة شي إن ${purchase.invoiceNumber}: ${body.data.reason}` });
    return { kind: "ok" as const, purchase: { ...purchase, totalAmount: n(purchase.totalAmount), itemIds: links.map((l) => l.itemId) } };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Purchase not found" }); return; }
  if (result.kind === "already") { res.status(409).json({ error: "Purchase is already cancelled" }); return; }
  if (result.kind === "linked") { res.status(409).json({ error: "لا يمكن إلغاء شراء مرتبط بشحنة. ألغِ الشحنة أولاً." }); return; }
  res.json(result.purchase);
});

router.get("/shipments", async (_req, res): Promise<void> => {
  const shipments = await db.select().from(shipmentsTable).orderBy(desc(shipmentsTable.createdAt));
  const result = await Promise.all(shipments.map(async (shipment) => {
    const links = await db.select({ purchaseId: shipmentPurchasesTable.purchaseId }).from(shipmentPurchasesTable).where(eq(shipmentPurchasesTable.shipmentId, shipment.id));
    return { ...shipment, shippingCost: n(shipment.shippingCost), purchaseIds: links.map((l) => l.purchaseId), receivingItems: [] };
  }));
  res.json(result);
});

router.post("/shipments", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateShipmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const shipment = await db.transaction(async (tx) => {
    const [created] = await tx.insert(shipmentsTable).values({
      shipmentNumber: parsed.data.shipmentNumber,
      company: parsed.data.company,
      trackingNumber: parsed.data.trackingNumber,
      shipmentDate: dateOnly(parsed.data.shipmentDate)!,
      arrivalDate: dateOnly(parsed.data.arrivalDate),
      shippingCost: parsed.data.shippingCost,
      currency: parsed.data.currency,
      status: parsed.data.status,
      notes: parsed.data.notes,
      createdBy: req.userId,
    }).returning();
    if (parsed.data.purchaseIds.length) await tx.insert(shipmentPurchasesTable).values(parsed.data.purchaseIds.map((purchaseId) => ({ shipmentId: created.id, purchaseId })));
    await tx.insert(walletTransactionsTable).values({ type: "expense", amount: parsed.data.shippingCost, currency: parsed.data.currency, category: "shipping", description: `شحنة ${parsed.data.shipmentNumber}`, transactionDate: dateOnly(parsed.data.shipmentDate)!, createdBy: req.userId });
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "created", entity: "shipment", entityId: created.id, description: `تم إنشاء الشحنة ${created.shipmentNumber}` });
    return created;
  });
  res.status(201).json({ ...shipment, shippingCost: n(shipment.shippingCost), purchaseIds: parsed.data.purchaseIds, receivingItems: [] });
});

router.get("/shipments/:id", async (req, res): Promise<void> => {
  const parsed = GetShipmentParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [shipment] = await db.select().from(shipmentsTable).where(eq(shipmentsTable.id, parsed.data.id));
  if (!shipment) { res.status(404).json({ error: "Shipment not found" }); return; }
  const links = await db.select({ purchaseId: shipmentPurchasesTable.purchaseId }).from(shipmentPurchasesTable).where(eq(shipmentPurchasesTable.shipmentId, shipment.id));
  const itemRows = await db.select({ item: orderItemsTable }).from(orderItemsTable).innerJoin(purchaseItemsTable, eq(purchaseItemsTable.itemId, orderItemsTable.id)).where(sql`${purchaseItemsTable.purchaseId} in (${sql.join(links.map((l) => sql`${l.purchaseId}`), sql`, `) || sql`null`})`);
  res.json({ ...shipment, shippingCost: n(shipment.shippingCost), purchaseIds: links.map((l) => l.purchaseId), receivingItems: await Promise.all(itemRows.map(({ item }) => itemDto(item))) });
});

router.patch("/shipments/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateShipmentParams.safeParse(req.params);
  const body = UpdateShipmentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid shipment data" }); return; }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(shipmentsTable).where(eq(shipmentsTable.id, params.data.id));
    if (!existing) return null;
    if (existing.status === "cancelled") throw new Error("Cancelled shipments cannot be edited");
    const [shipment] = await tx.update(shipmentsTable).set({
      shipmentNumber: body.data.shipmentNumber,
      company: body.data.company,
      trackingNumber: body.data.trackingNumber,
      shipmentDate: dateOnly(body.data.shipmentDate),
      arrivalDate: dateOnly(body.data.arrivalDate),
      shippingCost: body.data.shippingCost,
      currency: body.data.currency,
      status: body.data.status,
      notes: body.data.notes,
      updatedAt: new Date(),
    }).where(eq(shipmentsTable.id, params.data.id)).returning();
    if (body.data.purchaseIds) {
      await tx.delete(shipmentPurchasesTable).where(eq(shipmentPurchasesTable.shipmentId, shipment.id));
      if (body.data.purchaseIds.length) await tx.insert(shipmentPurchasesTable).values(body.data.purchaseIds.map((purchaseId) => ({ shipmentId: shipment.id, purchaseId })));
    }
    const delta = body.data.shippingCost === undefined ? 0 : body.data.shippingCost - n(existing.shippingCost);
    if (delta !== 0) {
      await tx.insert(walletTransactionsTable).values({
        type: delta > 0 ? "expense" : "income",
        amount: Math.abs(delta),
        currency: body.data.currency ?? existing.currency,
        category: "shipping_adjustment",
        description: `تعديل شحنة ${shipment.shipmentNumber}`,
        transactionDate: dateOnly(body.data.shipmentDate) ?? existing.shipmentDate,
        createdBy: req.userId,
      });
    }
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "updated", entity: "shipment", entityId: shipment.id, description: `تم تحديث الشحنة ${shipment.shipmentNumber}` });
    const links = await tx.select({ purchaseId: shipmentPurchasesTable.purchaseId }).from(shipmentPurchasesTable).where(eq(shipmentPurchasesTable.shipmentId, shipment.id));
    return { ...shipment, shippingCost: n(shipment.shippingCost), purchaseIds: links.map((l) => l.purchaseId), receivingItems: [] };
  });
  if (!result) { res.status(404).json({ error: "Shipment not found" }); return; }
  res.json(result);
});

router.post("/shipments/:id/cancel", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetShipmentParams.safeParse(req.params);
  const body = CancelShipmentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "A cancellation reason is required" }); return; }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(shipmentsTable).where(eq(shipmentsTable.id, params.data.id));
    if (!existing) return { kind: "missing" as const };
    if (existing.status === "cancelled") return { kind: "already" as const };
    const [shipment] = await tx.update(shipmentsTable).set({ status: "cancelled", notes: `${existing.notes ? `${existing.notes}\n` : ""}إلغاء: ${body.data.reason}`, updatedAt: new Date() }).where(eq(shipmentsTable.id, existing.id)).returning();
    if (n(existing.shippingCost) > 0) {
      await tx.insert(walletTransactionsTable).values({ type: "income", amount: n(existing.shippingCost), currency: existing.currency, category: "shipping_reversal", description: `إلغاء شحنة ${existing.shipmentNumber}`, transactionDate: existing.shipmentDate, createdBy: req.userId });
    }
    await tx.insert(auditLogsTable).values({ userId: req.userId, action: "cancelled", entity: "shipment", entityId: shipment.id, description: `تم إلغاء الشحنة ${shipment.shipmentNumber}: ${body.data.reason}` });
    const links = await tx.select({ purchaseId: shipmentPurchasesTable.purchaseId }).from(shipmentPurchasesTable).where(eq(shipmentPurchasesTable.shipmentId, shipment.id));
    return { kind: "ok" as const, shipment: { ...shipment, shippingCost: n(shipment.shippingCost), purchaseIds: links.map((l) => l.purchaseId), receivingItems: [] } };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Shipment not found" }); return; }
  if (result.kind === "already") { res.status(409).json({ error: "Shipment is already cancelled" }); return; }
  res.json(result.shipment);
});

router.get("/wallet", async (req, res): Promise<void> => {
  const query = GetWalletQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;
  const rows = await db.select().from(walletTransactionsTable).orderBy(desc(walletTransactionsTable.transactionDate), desc(walletTransactionsTable.createdAt));
  const transactions = rows.filter((t) => !search || `${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase()));
  const income = rows.filter((t) => t.status === "confirmed" && t.type === "income").reduce((sum, t) => sum + n(t.amount), 0);
  const expenses = rows.filter((t) => t.status === "confirmed" && t.type === "expense").reduce((sum, t) => sum + n(t.amount), 0);
  res.json({ balance: income - expenses, totalIncome: income, totalExpenses: expenses, transactions: transactions.map(transactionDto) });
});

router.post("/wallet", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateWalletTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [transaction] = await db.insert(walletTransactionsTable).values({
    type: parsed.data.type,
    amount: parsed.data.amount,
    currency: "ILS",
    category: parsed.data.category,
    description: parsed.data.description,
    transactionDate: dateOnly(parsed.data.transactionDate)!,
    notes: parsed.data.notes,
    createdBy: req.userId,
  }).returning();
  await audit(req.userId, "created", "wallet_transaction", transaction.id, parsed.data.description);
  res.status(201).json(transactionDto(transaction));
});

router.post("/wallet/adjust", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateWalletAdjustmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [transaction] = await db.insert(walletTransactionsTable).values({
    type: parsed.data.direction === "increase" ? "income" : "expense", amount: parsed.data.amount, currency: "ILS",
    category: "wallet_adjustment", description: parsed.data.reason, transactionDate: dateOnly(parsed.data.transactionDate)!, createdBy: req.userId,
  }).returning();
  await audit(req.userId, "adjusted", "wallet", transaction.id, parsed.data.reason);
  res.status(201).json(transactionDto(transaction));
});

router.get("/reports/summary", async (req, res): Promise<void> => {
  const parsed = GetReportSummaryQueryParams.safeParse(req.query);
  const range = parsed.success ? parsed.data.range ?? "month" : "month";
  const to = parsed.success && parsed.data.to ? parsed.data.to : today();
  const from = parsed.success && parsed.data.from ? parsed.data.from : range === "today" ? to : range === "week" ? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10) : new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const transactions = await db.select().from(walletTransactionsTable);
  const items = await db.select().from(orderItemsTable);
  const orders = await db.select().from(ordersTable);
  const income = transactions.filter((t) => t.status === "confirmed" && t.type === "income" && t.transactionDate >= from && t.transactionDate <= to).reduce((sum, t) => sum + n(t.amount), 0);
  const expenses = transactions.filter((t) => t.status === "confirmed" && t.type === "expense" && t.transactionDate >= from && t.transactionDate <= to).reduce((sum, t) => sum + n(t.amount), 0);
  const nonPurchaseExpenses = transactions.filter((t) => t.status === "confirmed" && t.type === "expense" && t.category !== "shein_purchase" && t.transactionDate >= from && t.transactionDate <= to).reduce((sum, t) => sum + n(t.amount), 0);
  const revenue = orders.filter((o) => o.orderDate >= from && o.orderDate <= to).reduce((sum, o) => sum + n(o.deliveryFee), 0) + items.reduce((sum, i) => sum + n(i.sellingPrice) * i.quantity, 0);
  const productCosts = items.reduce((sum, i) => sum + n(i.sheinCost) * i.quantity, 0);
  const walletIncome = transactions.filter((t) => t.status === "confirmed" && t.type === "income").reduce((sum, t) => sum + n(t.amount), 0);
  const walletExpenses = transactions.filter((t) => t.status === "confirmed" && t.type === "expense").reduce((sum, t) => sum + n(t.amount), 0);
  res.json({ from, to, income, expenses, walletBalance: walletIncome - walletExpenses, revenue, productCosts, commission: items.reduce((sum, i) => sum + n(i.commission) * i.quantity, 0), profit: revenue - productCosts - nonPurchaseExpenses, customerBalances: Math.max(0, revenue - walletIncome), missingProducts: items.filter((i) => i.productStatus === "not_arrived").length, awaitingDelivery: items.filter((i) => i.deliveryStatus !== "delivered" && i.productStatus === "arrived").length, breakdown: [
    { label: "دفعات الزبائن", income, expenses: 0 }, { label: "مشتريات شي إن", income: 0, expenses: productCosts }, { label: "مصروفات أخرى", income: 0, expenses: nonPurchaseExpenses },
  ] });
});

router.get("/reports/export", async (req, res): Promise<void> => {
  const headers = "المعرف,الوصف,المبلغ,التاريخ,الحالة";
  const rows = await db.select().from(walletTransactionsTable).orderBy(desc(walletTransactionsTable.transactionDate));
  const csv = [headers, ...rows.map((t) => [t.id, `"${t.description.replaceAll('"', '""')}"`, n(t.amount), t.transactionDate, t.status].join(","))].join("\n");
  res.type("text/csv; charset=utf-8").send(`\uFEFF${csv}`);
});

router.get("/settings", async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) [settings] = await db.insert(settingsTable).values({}).returning();
  res.json(GetSettingsResponse.parse({ businessName: settings.businessName, defaultCurrency: settings.defaultCurrency, initialPaymentPercent: n(settings.initialPaymentPercent), defaultDeliveryFee: n(settings.defaultDeliveryFee) }));
});

router.patch("/settings", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let [existing] = await db.select().from(settingsTable).limit(1);
  if (!existing) [existing] = await db.insert(settingsTable).values({}).returning();
  const [settings] = await db.update(settingsTable).set(parsed.data).where(eq(settingsTable.id, existing.id)).returning();
  await audit(req.userId, "updated", "settings", settings.id, "تم تحديث إعدادات النشاط");
  res.json(GetSettingsResponse.parse({ businessName: settings.businessName, defaultCurrency: settings.defaultCurrency, initialPaymentPercent: n(settings.initialPaymentPercent), defaultDeliveryFee: n(settings.defaultDeliveryFee) }));
});

router.get("/audit", async (req, res): Promise<void> => {
  const query = ListAuditLogsQueryParams.safeParse(req.query);
  const limit = query.success ? query.data.limit ?? 20 : 20;
  res.json(await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(limit));
});

export default router;