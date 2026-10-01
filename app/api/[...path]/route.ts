import { createRemoteJWKSet, jwtVerify } from "jose";
import { ZodError } from "zod";
import {
  config,
  required,
  origin,
  db,
  identity,
  json,
  cookie,
  setCookie,
  random,
  digest,
  cartIdentity,
  cartLines,
  sameOrigin,
  paystack,
  HttpError,
} from "@/lib/server";
import { sampleProducts } from "@/lib/catalog";
import {
  cartSchema,
  checkoutSchema,
  totals,
  validSignature,
} from "@/lib/commerce";
import { sendWelcome } from "@/lib/welcome";
import { signupQuery, signinQuery } from "@/lib/account";
import { settle, sendReceipt } from "@/lib/payments";
export const dynamic = "force-dynamic";
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
function redirect(url: string, headers: Headers = new Headers()) {
  headers.set("Location", url);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 302, headers });
}
async function body(req: Request) {
  const text = await req.text();
  if (text.length > 12000) throw new HttpError(413, "Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
async function handle(req: Request) {
  const url = new URL(req.url),
    path = url.pathname.replace(/\/$/, ""),
    method = req.method;
  if (path === "/api/catalog" && method === "GET") {
    if (!config("DATABASE_URL"))
      return json({ products: sampleProducts, preview: true });
    return json({
      products:
        await db()`SELECT * FROM products WHERE active=true ORDER BY tone`,
      preview: false,
    });
  }
  if (path === "/api/me" && method === "GET")
    return json({
      user: config("DATABASE_URL") ? await identity(req) : null,
      configured: !!config("DATABASE_URL"),
      paymentReady: config("PAYSTACK_SECRET_KEY").startsWith("sk_test_") && !!(config("MAILGUN_API_KEY") && config("MAILGUN_DOMAIN") && config("MAILGUN_FROM")),
      googleReady: !!(
        config("DATABASE_URL") &&
        config("GOOGLE_CLIENT_ID") &&
        config("GOOGLE_CLIENT_SECRET")
      ),
    });
  if (path === "/api/auth/google" && method === "GET") {
    required("GOOGLE_CLIENT_SECRET");
    const client = required("GOOGLE_CLIENT_ID");
    const cart = await cartIdentity(req);
    const intent = url.searchParams.get("intent") === "signup" ? "signup" : "signin";
    const state = intent + "." + random(),
      nonce = random(),
      verifier = random();
    const sql = db();
    await sql`INSERT INTO oauth_states(state_hash,nonce,verifier,cart_id,expires_at) VALUES(${await digest(state)},${nonce},${verifier},${cart.id},now()+interval '10 minutes')`;
    const challenge = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ).toString("base64url");
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: client,
      redirect_uri: origin(req) + "/api/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    const headers = new Headers();
    headers.append("Set-Cookie", setCookie("okirika_oauth", state, 600, req));
    if (cart.header) headers.append("Set-Cookie", cart.header);
    return redirect(auth.href, headers);
  }
  if (path === "/api/auth/google/callback" && method === "GET") {
    const state = url.searchParams.get("state");
    if (!state || state !== cookie(req, "okirika_oauth"))
      throw new HttpError(400, "Sign-in expired. Please start again.");
    const sql = db();
    const [flow] =
      await sql`DELETE FROM oauth_states WHERE state_hash=${await digest(state)} AND expires_at>now() RETURNING *`;
    if (!flow) throw new HttpError(400, "Sign-in expired. Please start again.");
    const signup = state.startsWith("signup.");
    const authPage = signup ? "/signup" : "/signin";
    const clearFlow = new Headers();
    clearFlow.append("Set-Cookie", setCookie("okirika_oauth", "", 0, req));
    if (url.searchParams.has("error"))
      return redirect(origin(req) + authPage + "?auth=cancelled", clearFlow);
    const code = url.searchParams.get("code");
    if (!code)
      throw new HttpError(400, "Google did not return a sign-in code.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        redirect_uri: origin(req) + "/api/auth/google/callback",
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new HttpError(400, "Google sign-in failed. Please try again.");
    const token = (await response.json()) as { id_token: string };
    const { payload } = await jwtVerify(token.id_token, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: required("GOOGLE_CLIENT_ID"),
    });
    if (
      payload.nonce !== flow.nonce ||
      payload.email_verified !== true ||
      typeof payload.email !== "string" ||
      !payload.sub
    )
      throw new HttpError(401, "Google could not verify your account.");
    // Intent is bound to the one-time state stored in Neon, not callback query input.
    // Sign-in never creates an account; sign-up never overwrites an existing one.
    const name = String(payload.name || payload.email).slice(0, 100);
    const [user] = signup
      ? await sql.query(signupQuery, [crypto.randomUUID(), payload.sub, payload.email, name])
      : await sql.query(signinQuery, [payload.sub, payload.email, name]);
    if (!user)
      return redirect(origin(req) + (signup ? "/signin?auth=exists" : "/signup?auth=no-account"), clearFlow);
    const [accountCart] =
      await sql`INSERT INTO carts(id,token_hash,user_id) VALUES(${crypto.randomUUID()},${await digest(random())},${user.id}) ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id RETURNING id`;
    if (accountCart.id !== flow.cart_id)
      await sql.transaction([
        sql`INSERT INTO cart_items(cart_id,product_id,quantity) SELECT ${accountCart.id},product_id,quantity FROM cart_items WHERE cart_id=${flow.cart_id} AND EXISTS(SELECT 1 FROM carts WHERE id=${flow.cart_id} AND user_id IS NULL) ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=LEAST(20,cart_items.quantity+excluded.quantity)`,
        sql`DELETE FROM cart_items WHERE cart_id=${flow.cart_id} AND EXISTS(SELECT 1 FROM carts WHERE id=${flow.cart_id} AND user_id IS NULL)`,
      ]);
    const session = random();
    await sql`INSERT INTO sessions(token_hash,user_id,cart_id,expires_at) VALUES(${await digest(session)},${user.id},${accountCart.id},now()+interval '30 days')`;
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      setCookie("okirika_session", session, 2592000, req),
    );
    headers.append("Set-Cookie", setCookie("okirika_oauth", "", 0, req));
    let welcomePending = false;
    if (signup) {
      try { await sendWelcome(user.id); } catch { welcomePending = true; }
    }
    return redirect(origin(req) + "/" + (signup ? welcomePending ? "?welcome=pending" : "?welcome=sent" : "") + "#collection", headers);
  }
  if (path === "/api/paystack/webhook" && method === "POST") {
    const raw = await req.text();
    if (raw.length > 100000) throw new HttpError(413, "Event too large.");
    const secret = required("PAYSTACK_SECRET_KEY");
    if (!secret.startsWith("sk_test_"))
      throw new HttpError(503, "Test payments are not configured.");
    if (
      !(await validSignature(
        raw,
        req.headers.get("x-paystack-signature"),
        secret,
      ))
    )
      throw new HttpError(401, "Invalid signature.");
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid event.");
    }
    if (event.event === "charge.success") {
      const reference = event.data?.reference;
      if (typeof reference !== "string" || reference.length > 100)
        throw new HttpError(400, "Invalid reference.");
      const [known] =
        await db()`SELECT id FROM orders WHERE reference=${reference}`;
      if (known) await settle(reference);
    }
    return json({ received: true });
  }
  if (method !== "GET") sameOrigin(req);
  if (path === "/api/auth/logout" && method === "POST") {
    const token = cookie(req, "okirika_session");
    if (token)
      await db()`DELETE FROM sessions WHERE token_hash=${await digest(token)}`;
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
    headers.append("Set-Cookie", setCookie("okirika_session", "", 0, req));
    headers.append("Set-Cookie", setCookie("okirika_cart", "", 0, req));
    return new Response("{}", { headers });
  }
  if (path === "/api/cart") {
    if (!["GET", "PUT"].includes(method))
      throw new HttpError(405, "Method not allowed.");
    const cart = await cartIdentity(req);
    const sql = db();
    if (method === "PUT") {
      const input = cartSchema.parse(await body(req));
      const [p] =
        await sql`SELECT id FROM products WHERE id=${input.productId} AND active=true`;
      if (!p && input.quantity > 0)
        throw new HttpError(404, "This product is unavailable.");
      if (input.quantity === 0)
        await sql`DELETE FROM cart_items WHERE cart_id=${cart.id} AND product_id=${input.productId}`;
      else
        await sql`INSERT INTO cart_items(cart_id,product_id,quantity) VALUES(${cart.id},${input.productId},${input.quantity}) ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=excluded.quantity`;
    }
    return json(
      { items: await cartLines(cart.id) },
      200,
      cart.header ? { "Set-Cookie": cart.header } : {},
    );
  }
  const user = await identity(req);
  if (!user)
    throw new HttpError(401, "Please sign in with Google to continue.");
  if (path === "/api/account/welcome" && method === "POST") {
    await sendWelcome(user.id);
    return json({ ok: true });
  }
  if (path === "/api/checkout" && method === "POST") {
    required("MAILGUN_API_KEY");
    required("MAILGUN_DOMAIN");
    required("MAILGUN_FROM");
    if (!required("PAYSTACK_SECRET_KEY").startsWith("sk_test_"))
      throw new HttpError(503, "Please configure a Paystack test key.");
    const input = checkoutSchema.parse(await body(req)),
      sql = db();
    let [order] =
      await sql`SELECT * FROM orders WHERE user_id=${user.id} AND idempotency_key=${input.idempotencyKey}`;
    if (!order) {
      const items = await cartLines(user.cart_id);
      if (items.some((p) => !p.active))
        throw new HttpError(
          409,
          "A product is no longer available. Please update your bag.",
        );
      const amount = totals(items as any);
      const id = crypto.randomUUID(),
        reference = "OK-" + id;
      [order] =
        await sql`INSERT INTO orders(id,user_id,cart_id,idempotency_key,reference,email,delivery,items,subtotal,shipping,total) VALUES(${id},${user.id},${user.cart_id},${input.idempotencyKey},${reference},${user.email},${JSON.stringify(input.delivery)}::jsonb,${JSON.stringify(items.map((p) => ({ id: p.id, name: p.name, price: p.price, quantity: p.quantity, image: p.image })))}::jsonb,${amount.subtotal},${amount.shipping},${amount.total}) ON CONFLICT(user_id,idempotency_key) DO UPDATE SET idempotency_key=excluded.idempotency_key RETURNING *`;
    }
    if (order.status === "paid") return json({ url: origin(req) + "/orders" });
    if (order.authorization_url) return json({ url: order.authorization_url });
    const payment = await paystack("/transaction/initialize", {
      email: order.email,
      amount: String(order.total),
      currency: "NGN",
      reference: order.reference,
      callback_url: origin(req) + "/payment/return",
      metadata: { order_id: order.id },
    });
    const checkoutUrl = new URL(payment.authorization_url);
    if (
      checkoutUrl.protocol !== "https:" ||
      checkoutUrl.hostname !== "checkout.paystack.com"
    )
      throw new HttpError(502, "Unexpected payment URL.");
    await sql`UPDATE orders SET authorization_url=${checkoutUrl.href} WHERE id=${order.id}`;
    return json({ url: checkoutUrl.href });
  }
  if (path === "/api/orders" && method === "GET")
    return json({
      orders:
        await db()`SELECT o.id,o.reference,o.authorization_url,o.delivery,o.items,o.subtotal,o.shipping,o.total,o.status,o.created_at,e.status AS email_status FROM orders o LEFT JOIN email_outbox e ON e.order_id=o.id WHERE o.user_id=${user.id} ORDER BY o.created_at DESC LIMIT 50`,
    });
  if (path === "/api/payment/verify" && method === "POST") {
    const input = await body(req);
    if (typeof input.reference !== "string" || input.reference.length > 100)
      throw new HttpError(400, "Invalid reference.");
    const [order] =
      await db()`SELECT id FROM orders WHERE reference=${input.reference} AND user_id=${user.id}`;
    if (!order) throw new HttpError(404, "Order not found.");
    try {
      const result = await settle(input.reference);
      return json({ paid: true, emailPending: !result.emailSent });
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.message.includes("confirmation email")
      )
        return json({ paid: true, emailPending: true });
      throw error;
    }
    return json({ paid: true, emailPending: false });
  }
  if (path === "/api/orders/receipt" && method === "POST") {
    const input = await body(req);
    if (typeof input.id !== "string" || !/^[\da-f-]{36}$/.test(input.id))
      throw new HttpError(400, "Invalid order.");
    const [order] =
      await db()`SELECT id FROM orders WHERE id=${input.id} AND user_id=${user.id} AND status='paid'`;
    if (!order) throw new HttpError(404, "Paid order not found.");
    await sendReceipt(order.id);
    return json({ ok: true });
  }
  throw new HttpError(404, "Page not found.");
}
async function route(req: Request) {
  try {
    return await handle(req);
  } catch (error) {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 503;
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof ZodError
          ? "Please check the information you entered."
          : "The shop is temporarily unavailable. Please try again.";
    console.error("Request failed", {
      path: new URL(req.url).pathname,
      status,
      type: error instanceof Error ? error.name : "unknown",
    });
    if (new URL(req.url).pathname.startsWith("/api/auth/google"))
      return redirect(origin(req) + (cookie(req, "okirika_oauth").startsWith("signup.") || new URL(req.url).searchParams.get("intent") === "signup" ? "/signup" : "/signin") + "?auth=unavailable");
    return json({ error: message }, status);
  }
}
export { route as GET, route as POST, route as PUT };
