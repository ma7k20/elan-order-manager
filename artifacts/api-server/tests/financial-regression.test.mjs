import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, test } from "node:test";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const { Client } = pg;

const port = 5300 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}/api`;
const runId = `${Date.now()}-${process.pid}`;
const created = {
  customerId: null,
  orderId: null,
  paymentId: null,
  expenseId: null,
  purchaseId: null,
  shipmentId: null,
};

let server;
let authToken;
let database;

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) < 0.001, `${message}: expected ${expected}, got ${actual}`);
}

async function request(path, options = {}) {
  const headers = {
    authorization: `Bearer ${authToken}`,
    ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    ...options.headers,
  };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  let data;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { response, data };
}

async function expectStatus(path, options, expectedStatus) {
  const result = await request(path, options);
  assert.equal(result.response.status, expectedStatus, `${options?.method ?? "GET"} ${path} returned ${result.response.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function wallet() {
  return expectStatus("/wallet", undefined, 200);
}

async function report() {
  return expectStatus("/reports/summary?range=month", undefined, 200);
}

function linkedTransactions(walletData, field, id) {
  return walletData.transactions.filter((transaction) => transaction[field] === id);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error("API server exited before it became ready");
    }
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for API server");
}

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for financial regression tests");
  server = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "test", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: "0592116407", pin: "6407" }),
  });
  assert.equal(login.response.status, 200, `login failed: ${JSON.stringify(login.data)}`);
  authToken = login.data.token;

  database = new Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
});

after(async () => {
  if (authToken) {
    await request("/auth/logout", { method: "POST" }).catch(() => {});
  }
  if (database) {
    await database.query("DELETE FROM wallet_transactions WHERE related_payment_id = $1 OR related_purchase_id = $2 OR related_shipment_id = $3 OR id = $4", [
      created.paymentId ?? -1,
      created.purchaseId ?? -1,
      created.shipmentId ?? -1,
      created.expenseId ?? -1,
    ]);
    await database.query("DELETE FROM payments WHERE id = $1", [created.paymentId ?? -1]);
    await database.query("DELETE FROM shipment_purchases WHERE shipment_id = $1", [created.shipmentId ?? -1]);
    await database.query("DELETE FROM shipments WHERE id = $1", [created.shipmentId ?? -1]);
    await database.query("DELETE FROM purchase_items WHERE purchase_id = $1", [created.purchaseId ?? -1]);
    await database.query("DELETE FROM shein_purchases WHERE id = $1", [created.purchaseId ?? -1]);
    await database.query("DELETE FROM orders WHERE id = $1", [created.orderId ?? -1]);
    await database.query("DELETE FROM customers WHERE id = $1", [created.customerId ?? -1]);
    await database.end();
  }
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
});

describe("financial record edit and delete invariants", () => {
  test("keeps customer balances, wallet totals, profit, and links correct across reloads", async () => {
    const initialWallet = await wallet();

    const customer = await expectStatus("/customers", {
      method: "POST",
      body: JSON.stringify({ name: `اختبار مالي ${runId}`, phone: `059${String(Date.now()).slice(-7)}` }),
    }, 201);
    created.customerId = customer.id;

    const order = await expectStatus("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId: created.customerId,
        orderDate: "2026-09-03",
        deliveryMethod: "pickup",
        deliveryFee: 10,
        items: [{
          name: `منتج اختبار ${runId}`,
          quantity: 1,
          sellingPrice: 200,
          commission: 10,
          sheinCost: 100,
          productUrl: null,
          imagePath: null,
          notes: null,
        }],
      }),
    }, 201);
    created.orderId = order.id;
    const itemId = order.items[0].id;

    const payment = await expectStatus("/payments", {
      method: "POST",
      body: JSON.stringify({
        customerId: created.customerId,
        orderId: created.orderId,
        amount: 120,
        type: "initial_deposit",
        method: "cash",
        paymentDate: "2026-09-03",
        notes: "",
      }),
    }, 201);
    created.paymentId = payment.id;
    let currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance + 120, "payment wallet balance");
    closeTo(currentWallet.totalIncome, initialWallet.totalIncome + 120, "payment wallet income");
    assert.equal(linkedTransactions(currentWallet, "relatedPaymentId", created.paymentId).length, 1);

    let customerAfterPayment = await expectStatus(`/customers/${created.customerId}`, undefined, 200);
    closeTo(customerAfterPayment.totalPaid, 120, "customer balance after payment");
    closeTo(customerAfterPayment.remaining, 90, "customer remaining after payment");

    await expectStatus(`/payments/${created.paymentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        customerId: created.customerId,
        orderId: created.orderId,
        amount: 75,
        type: "partial",
        method: "card",
        paymentDate: "2026-09-03",
        notes: "تم التعديل",
      }),
    }, 200);
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance + 75, "edited payment wallet balance");
    closeTo(currentWallet.totalIncome, initialWallet.totalIncome + 75, "edited payment wallet income");
    assert.equal(linkedTransactions(currentWallet, "relatedPaymentId", created.paymentId).length, 1);
    closeTo(linkedTransactions(currentWallet, "relatedPaymentId", created.paymentId)[0].amount, 75, "edited payment ledger amount");
    customerAfterPayment = await expectStatus(`/customers/${created.customerId}`, undefined, 200);
    closeTo(customerAfterPayment.totalPaid, 75, "customer balance after payment edit");
    closeTo(customerAfterPayment.remaining, 135, "customer remaining after payment edit");

    await expectStatus(`/payments/${created.paymentId}`, { method: "DELETE" }, 204);
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance, "wallet after payment deletion");
    assert.equal(linkedTransactions(currentWallet, "relatedPaymentId", created.paymentId).length, 0);
    customerAfterPayment = await expectStatus(`/customers/${created.customerId}`, undefined, 200);
    closeTo(customerAfterPayment.totalPaid, 0, "customer balance after payment deletion");
    closeTo(customerAfterPayment.remaining, 210, "customer remaining after payment deletion");
    const reportBeforeManualExpense = await report();

    const manualExpense = await expectStatus("/wallet", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 40,
        category: "manual_regression",
        description: `مصروف اختبار ${runId}`,
        transactionDate: "2026-09-03",
        notes: "ملاحظة",
      }),
    }, 201);
    created.expenseId = manualExpense.id;
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance - 40, "manual expense wallet balance");
    closeTo(currentWallet.totalExpenses, initialWallet.totalExpenses + 40, "manual expense total");
    let currentReport = await report();
    closeTo(currentReport.profit, reportBeforeManualExpense.profit - 40, "profit after manual expense");

    await expectStatus(`/wallet/${created.expenseId}`, {
      method: "PATCH",
      body: JSON.stringify({
        type: "expense",
        amount: 65,
        category: "manual_regression",
        description: `مصروف اختبار معدل ${runId}`,
        transactionDate: "2026-09-03",
        notes: null,
      }),
    }, 200);
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance - 65, "edited manual expense wallet balance");
    closeTo(currentWallet.totalExpenses, initialWallet.totalExpenses + 65, "edited manual expense total");
    currentReport = await report();
    closeTo(currentReport.profit, reportBeforeManualExpense.profit - 65, "profit after manual expense edit");

    await expectStatus(`/wallet/${created.expenseId}`, { method: "DELETE" }, 204);
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance, "wallet after manual expense deletion");
    currentReport = await report();
    closeTo(currentReport.profit, reportBeforeManualExpense.profit, "profit after manual expense deletion");

    const purchase = await expectStatus("/purchases", {
      method: "POST",
      body: JSON.stringify({
        invoiceNumber: `INV-${runId}`,
        purchaseDate: "2026-09-03",
        totalAmount: 100,
        currency: "ILS",
        itemIds: [itemId],
        notes: "فاتورة اختبار",
      }),
    }, 201);
    created.purchaseId = purchase.id;
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance - 100, "purchase wallet balance");
    assert.equal(linkedTransactions(currentWallet, "relatedPurchaseId", created.purchaseId).length, 1);

    await expectStatus(`/purchases/${created.purchaseId}`, {
      method: "PATCH",
      body: JSON.stringify({
        invoiceNumber: `INV-${runId}-EDITED`,
        purchaseDate: "2026-09-03",
        totalAmount: 130,
        currency: "ILS",
        notes: "فاتورة معدلة",
      }),
    }, 200);
    const reloadedPurchase = await expectStatus(`/purchases/${created.purchaseId}`, undefined, 200);
    closeTo(reloadedPurchase.totalAmount, 130, "purchase amount after reload");
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance - 130, "edited purchase wallet balance");
    const purchaseTransactions = linkedTransactions(currentWallet, "relatedPurchaseId", created.purchaseId);
    assert.equal(purchaseTransactions.length, 2);
    closeTo(purchaseTransactions.reduce((sum, transaction) => sum + (transaction.type === "expense" ? transaction.amount : -transaction.amount), 0), 130, "purchase ledger net amount");

    const shipment = await expectStatus("/shipments", {
      method: "POST",
      body: JSON.stringify({
        shipmentNumber: `SHP-${runId}`,
        company: "شركة اختبار",
        trackingNumber: "TRACK-REGRESSION",
        shipmentDate: "2026-09-03",
        arrivalDate: null,
        shippingCost: 25,
        currency: "ILS",
        status: "in_transit",
        purchaseIds: [created.purchaseId],
        notes: "شحنة اختبار",
      }),
    }, 201);
    created.shipmentId = shipment.id;
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance - 155, "shipment wallet balance");
    assert.equal(linkedTransactions(currentWallet, "relatedShipmentId", created.shipmentId).length, 1);

    await expectStatus(`/shipments/${created.shipmentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        shipmentNumber: `SHP-${runId}-EDITED`,
        company: "شركة اختبار",
        trackingNumber: "TRACK-REGRESSION-EDITED",
        shipmentDate: "2026-09-03",
        arrivalDate: null,
        shippingCost: 35,
        currency: "ILS",
        status: "in_transit",
        purchaseIds: [created.purchaseId],
        notes: "شحنة معدلة",
      }),
    }, 200);
    const reloadedShipment = await expectStatus(`/shipments/${created.shipmentId}`, undefined, 200);
    closeTo(reloadedShipment.shippingCost, 35, "shipment cost after reload");
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance - 165, "edited shipment wallet balance");
    const shipmentTransactions = linkedTransactions(currentWallet, "relatedShipmentId", created.shipmentId);
    assert.equal(shipmentTransactions.length, 2);
    closeTo(shipmentTransactions.reduce((sum, transaction) => sum + (transaction.type === "expense" ? transaction.amount : -transaction.amount), 0), 35, "shipment ledger net amount");

    const walletBeforeRejectedPurchaseDelete = await wallet();
    const rejectedDelete = await request(`/purchases/${created.purchaseId}`, { method: "DELETE" });
    assert.equal(rejectedDelete.response.status, 409, "linked purchase deletion must be rejected");
    const walletAfterRejectedPurchaseDelete = await wallet();
    assert.deepEqual(
      {
        balance: walletAfterRejectedPurchaseDelete.balance,
        totalIncome: walletAfterRejectedPurchaseDelete.totalIncome,
        totalExpenses: walletAfterRejectedPurchaseDelete.totalExpenses,
      },
      {
        balance: walletBeforeRejectedPurchaseDelete.balance,
        totalIncome: walletBeforeRejectedPurchaseDelete.totalIncome,
        totalExpenses: walletBeforeRejectedPurchaseDelete.totalExpenses,
      },
      "rejected purchase deletion changed wallet totals",
    );
    assert.equal((await expectStatus(`/purchases/${created.purchaseId}`, undefined, 200)).status, "purchased");

    await expectStatus(`/shipments/${created.shipmentId}`, { method: "DELETE" }, 204);
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance - 130, "wallet after allowed shipment deletion");
    assert.equal((await request(`/shipments/${created.shipmentId}`)).response.status, 404);
    assert.equal((await expectStatus(`/purchases/${created.purchaseId}`, undefined, 200)).itemIds.includes(itemId), true);

    await expectStatus(`/purchases/${created.purchaseId}`, { method: "DELETE" }, 204);
    currentWallet = await wallet();
    closeTo(currentWallet.balance, initialWallet.balance, "wallet after purchase deletion");
    assert.equal((await request(`/purchases/${created.purchaseId}`)).response.status, 404);
    const reloadedOrder = await expectStatus(`/orders/${created.orderId}`, undefined, 200);
    assert.equal(reloadedOrder.items[0].productStatus, "requested", "deleted purchase must restore product status");
  });
});