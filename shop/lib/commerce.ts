import { z } from "zod";
export const deliverySchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d ()-]{7,25}$/),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postal: z.string().trim().max(20).default(""),
});
export const cartSchema = z.object({
  productId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  quantity: z.number().int().min(0).max(20),
});
export const checkoutSchema = z.object({
  delivery: deliverySchema,
  idempotencyKey: z.string().uuid(),
});
export const money = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
export function totals(items: { price: number; quantity: number }[]) {
  let subtotal = 0;
  for (const x of items) {
    if (
      !Number.isSafeInteger(x.price) ||
      x.price < 1 ||
      !Number.isInteger(x.quantity) ||
      x.quantity < 1 ||
      x.quantity > 20
    )
      throw new Error("Invalid order line");
    subtotal += x.price * x.quantity;
  }
  if (!items.length || !Number.isSafeInteger(subtotal))
    throw new Error("Your bag is empty");
  const shipping = subtotal >= 7500000 ? 0 : 250000;
  return { subtotal, shipping, total: subtotal + shipping };
}
export function paymentMatches(
  order: { reference: string; total: number; email: string },
  payment: {
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    domain?: string;
    customer?: { email?: string };
  },
) {
  return (
    payment.status === "success" &&
    payment.domain === "test" &&
    payment.currency === "NGN" &&
    payment.reference === order.reference &&
    payment.amount === order.total &&
    payment.customer?.email?.toLowerCase() === order.email.toLowerCase()
  );
}
export async function validSignature(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.match(/../g)!, (x) =>
    parseInt(x, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(raw),
  );
}
