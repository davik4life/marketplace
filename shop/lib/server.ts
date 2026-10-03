import { bearerToken } from "./mobile-auth";
import { neon } from "@neondatabase/serverless";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function config(key: string) {
  return process.env[key] || "";
}
export function required(key: string) {
  const value = config(key);
  if (!value)
    throw new HttpError(
      503,
      "The shop is being connected. Please try again soon.",
    );
  return value;
}
export function db() {
  return neon(required("DATABASE_URL"));
}
export function allowedOrigins() {
  return new Set([
    new URL(required("APP_URL")).origin,
    ...config("ALLOWED_ORIGINS")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  ]);
}
export function origin(req?: Request) {
  const canonical = new URL(required("APP_URL")).origin;
  if (req && process.env.NODE_ENV !== "production") {
    const local = new URL(req.url);
    if (
      ["localhost", "127.0.0.1", "[::1]"].includes(local.hostname) &&
      allowedOrigins().has(local.origin)
    )
      return local.origin;
  }
  return canonical;
}
export function cookie(req: Request, name: string) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + "="))
      ?.slice(name.length + 1) || ""
  );
}
export function setCookie(
  name: string,
  value: string,
  seconds: number,
  req?: Request,
) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${origin(req).startsWith("https:") ? "; Secure" : ""}`;
}
export async function digest(value: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).toString("hex");
}
export function random() {
  return crypto.randomUUID() + crypto.randomUUID();
}
export function sessionToken(req: Request) { return bearerToken(req.headers.get("authorization")) || cookie(req, "okirika_session"); }
export async function identity(req: Request) {
  const token = sessionToken(req);
  if (!token) return null;
  const [row] =
    await db()`SELECT u.id,u.email,u.name,s.cart_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${await digest(token)} AND s.expires_at>now()`;
  return row || null;
}
export function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export function sameOrigin(req: Request) {
  // Native clients use an explicit session token, never ambient browser cookies.
  if (!req.headers.has("origin") && bearerToken(req.headers.get("authorization"))) return;
  if (!allowedOrigins().has(req.headers.get("origin") || ""))
    throw new HttpError(403, "Please reload the shop and try again.");
}
export async function cartIdentity(req: Request) {
  const user = await identity(req);
  if (user) return { id: user.cart_id as string, user, header: undefined };
  if (bearerToken(req.headers.get("authorization"))) throw new HttpError(401,"Please sign in again.");
  const token = cookie(req, "okirika_cart");
  if (token) {
    const [cart] =
      await db()`SELECT id FROM carts WHERE token_hash=${await digest(token)}`;
    if (cart) return { id: cart.id as string, user: null, header: undefined };
  }
  const next = random(),
    id = crypto.randomUUID();
  await db()`INSERT INTO carts(id,token_hash) VALUES(${id},${await digest(next)})`;
  return {
    id,
    user: null,
    header: setCookie("okirika_cart", next, 60 * 60 * 24 * 30, req),
  };
}
export async function cartLines(id: string) {
  return await db()`SELECT p.*,c.quantity FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.cart_id=${id} ORDER BY p.id`;
}
export async function paystack(path: string, body?: unknown) {
  const key = required("PAYSTACK_SECRET_KEY");
  if (!key.startsWith("sk_test_"))
    throw new HttpError(503, "Test payments are not configured.");
  const response = await fetch("https://api.paystack.co" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = (await response.json()) as { status: boolean; data: any };
  if (!response.ok || !result.status)
    throw new HttpError(502, "Payment service is unavailable. Please retry.");
  return result.data;
}
