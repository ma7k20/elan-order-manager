import { and, eq, ilike } from "drizzle-orm";
import { customersTable, db, orderItemsTable, ordersTable, paymentsTable } from "@workspace/db";

const digits = (phone: string) => phone.replace(/\D/g, "").replace(/^970/, "0");

/** Returns only information belonging to the phone number which sent the message. */
export async function customerContext(phone: string | null, question: string) {
  if (!phone) return "لا توجد هوية زبون مؤكدة؛ لا تعرض تفاصيل طلب أو دفعة.";
  const normalized = digits(phone);
  const customers = await db.select().from(customersTable);
  const customer = customers.find((row) => [row.phone, row.alternatePhone].some((p) => p && digits(p) === normalized));
  if (!customer) return "لم يتم العثور على زبون مطابق لرقم المرسل.";
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.customerId, customer.id));
  const orderHint = question.match(/\b(?:ORD[-\s]?)?(\d{3,})\b/i)?.[1];
  const owned = orderHint ? orders.filter((o) => o.orderNumber.toLowerCase().includes(orderHint) || String(o.id) === orderHint) : orders;
  const details = await Promise.all(owned.slice(0, 8).map(async (order) => {
    const items = await db.select({ name: orderItemsTable.name, productStatus: orderItemsTable.productStatus, deliveryStatus: orderItemsTable.deliveryStatus })
      .from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    const pays = await db.select({ amount: paymentsTable.amount, status: paymentsTable.status })
      .from(paymentsTable).where(and(eq(paymentsTable.orderId, order.id), eq(paymentsTable.customerId, customer.id)));
    return { orderNumber: order.orderNumber, status: order.status, deliveryMethod: order.deliveryMethod, items, payments: pays.filter((p) => p.status === "confirmed").map((p) => p.amount) };
  }));
  return JSON.stringify({ customer: { name: customer.name }, orders: details });
}