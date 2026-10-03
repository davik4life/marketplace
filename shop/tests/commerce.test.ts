import { test } from "node:test";
import assert from "node:assert/strict";
import {
  totals,
  paymentMatches,
  cartSchema,
  checkoutSchema,
  validSignature,
} from "../lib/commerce.ts";
import { createHmac } from "node:crypto";
test("server prices and delivery are exact integer kobo", () => {
  assert.deepEqual(totals([{ price: 2450000, quantity: 2 }]), {
    subtotal: 4900000,
    shipping: 250000,
    total: 5150000,
  });
  assert.equal(totals([{ price: 2500000, quantity: 3 }]).shipping, 0);
  assert.throws(() => totals([]));
  assert.throws(() => totals([{ price: 100, quantity: -1 }]));
  assert.throws(() => totals([{ price: 100.5, quantity: 1 }]));
});
test("cart rejects invalid and excessive quantities", () => {
  for (const quantity of [-1, 21, 1.5, "2"])
    assert.equal(
      cartSchema.safeParse({ productId: "form-vase", quantity }).success,
      false,
    );
  assert.equal(
    cartSchema.safeParse({ productId: "form-vase", quantity: 0 }).success,
    true,
  );
});
test("checkout rejects invalid address and missing idempotency key", () => {
  assert.equal(
    checkoutSchema.safeParse({ delivery: { name: "x" }, idempotencyKey: "x" })
      .success,
    false,
  );
});
test("payment must match every property and test environment", () => {
  const order = {
    reference: "OK-123",
    total: 500000,
    email: "Buyer@example.com",
  };
  const payment = {
    reference: "OK-123",
    amount: 500000,
    currency: "NGN",
    domain: "test",
    status: "success",
    customer: { email: "buyer@example.com" },
  };
  assert.equal(paymentMatches(order, payment), true);
  for (const patch of [
    { amount: 1 },
    { currency: "USD" },
    { domain: "live" },
    { status: "pending" },
    { reference: "other" },
    { customer: { email: "attacker@example.com" } },
  ])
    assert.equal(paymentMatches(order, { ...payment, ...patch }), false);
});
test("webhook signature requires authentic unmodified bytes", async () => {
  const raw = '{"event":"charge.success"}',
    secret = "sk_test_testing";
  const signature = createHmac("sha512", secret).update(raw).digest("hex");
  assert.equal(await validSignature(raw, signature, secret), true);
  assert.equal(await validSignature(raw + " ", signature, secret), false);
  assert.equal(await validSignature(raw, null, secret), false);
  assert.equal(await validSignature(raw, "0".repeat(128), secret), false);
});
