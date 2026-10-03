# Okirika

A home and lifestyle shop with Neon PostgreSQL persistence, Google OpenID Connect sign-in, Paystack inline test checkout, and Mailgun receipts. The catalog and imagery are illustrative sample products; replace them before selling actual stock.

## Run locally

Requires Node 22.13+. Run `npm install`, complete `.env`, then `npm run db:setup` and `npm run dev`. The database setup uses an advisory lock and a version ledger; existing migrations are never reapplied. Seed products are inserted only if absent. No credentials belong in client code or Git.

## Credentials

- `DATABASE_URL`: Neon pooled connection string with SSL. Create a development branch for testing. SQL uses Neon's HTTP driver, compatible with Netlify Functions.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google Cloud Console → Google Auth Platform. Configure Branding, Audience, and an OAuth client of type **Web application**. Add your Google account as a test user if the app is External/Testing. Add `http://localhost:5173/api/auth/google/callback` as an authorized redirect URI. For hosting, add the exact HTTPS origin plus `/api/auth/google/callback`. Server flow needs no JavaScript origin. Only openid, email, and profile scopes are used.
- `PAYSTACK_SECRET_KEY`: a key starting with `sk_test_` from Paystack test mode. Live keys are intentionally rejected. This server-initialized inline checkout does not need the public key. The callback is `APP_URL/payment/return`. Configure the webhook at `APP_URL/api/paystack/webhook` on a publicly reachable deployment. Use the simulated test methods Paystack provides on its checkout.
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`: a Mailgun sending key, verified domain, and sender (e.g. `Okirika <orders@your-domain>`). Choose `MAILGUN_REGION=US` or `EU`. Sandbox domains can only email authorized recipients; verify your test recipient in Mailgun first. Test Paystack purchases still send real emails.
- `APP_URL`: exact canonical origin, without trailing slash. Local default is `http://localhost:5173`. The production value must match the Google redirect registration.

A local `.env` does not configure hosted secrets. Import the configured variables into Netlify, setting `APP_URL` to the generated HTTPS origin. `ALLOWED_ORIGINS` is a comma-separated list of exact permitted origins for write requests. Add the hosted origin and local development origins; wildcards are not supported. Local development uses the allowed localhost request origin for redirects and cookies. A production server always uses `APP_URL`. Updating this list does not register redirect URIs in Google Cloud Console; those must be added there separately.

## Payment and data flow

Google auth uses state, nonce, PKCE, verified Google ID tokens, and opaque database-backed sessions. Cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS. Guest shopping bags use an opaque cookie and persist in Neon. Sign-in merges the guest bag into the account’s persistent bag (up to 20 of each item); writes require a same-origin request.

Checkout snapshots product names and server-calculated prices, delivery details, and order lines into Neon before initiating Paystack. An idempotency key prevents double-click duplicate orders. Verification checks payment reference, test domain, NGN currency, customer email, and exact amount. Both callback and signed webhook invoke the same settlement flow. Database uniqueness prevents duplicate receipts and settlement records.

Receipts use a database outbox with lease-based claims. A failed send is retained for retry from the order screen or repeated webhook. A Netlify scheduled function retries pending welcome and purchase emails every 10 minutes, up to 12 automatic attempts per message. Manual retry remains available on the signed-in account page and order screen. An ambiguous provider timeout can cause duplicate delivery on retry because Mailgun has no exactly-once send contract; the deterministic Message-ID helps downstream deduplication. Payment success is retained even when email delivery fails. “Sent” means accepted by Mailgun, not guaranteed inbox delivery.

No real inventory quantities are represented. Product availability is a catalog flag. The sample shipping rule is ₦2,500, free from ₦75,000, within Nigeria. Replace it with your fulfillment policy before launch.

## Verification

`npm test` checks validation, price arithmetic, payment matching, signature rejection, and PostgreSQL settlement/outbox idempotency using PGlite. `npm run typecheck` checks TypeScript. `npm run build` builds Next.js for Netlify. `netlify.toml` configures the official Next.js adapter, including server routes and functions.

For the full real-provider test: fill `.env`, run database setup, sign in through Google, add products, reload to check persistence, checkout with a Paystack test method, then verify the paid order in Neon and receipt in your authorized Mailgun inbox. Repeat the callback to verify idempotency; try a failed test payment and confirm no paid order or receipt. Repeat with a signed webhook on a public endpoint. Tests with mock provider data cannot prove account provisioning or email deliverability.

Official references: [Neon](https://github.com/neondatabase/serverless), [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Paystack](https://paystack.com/docs/api/transaction/), [Paystack webhooks](https://paystack.com/docs/payments/webhooks/), [Mailgun](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http).

## Hosted test checkout

Sign in at `https://okirika-home.netlify.app/signin`, then use the bag checkout. Pending orders with an initialized Paystack session include a **Continue test payment** link. Payment is enabled only when the test secret and receipt settings are configured; the server rejects live keys.

Register `https://okirika-home.netlify.app/api/auth/google/callback` exactly in Google Cloud Console. Set the Paystack test webhook to `https://okirika-home.netlify.app/api/paystack/webhook`. A successful API-key check does not prove Google account consent, completed payment, or email delivery; verify these with an actual signed-in test order.

## Account registration

`/signup` creates new Google-linked accounts; `/signin` only signs in existing accounts. The intent is bound to the single-use OAuth state. Unknown sign-ins go to sign-up, while existing sign-ups go to sign-in. Registration atomically queues a welcome email in `welcome_email_outbox`; ordinary sign-ins never queue additional welcome emails. Email failures do not prevent sign-in or undo paid orders. The callback attempts the welcome immediately and the scheduled `retry-emails` function handles transient failures. Mailgun acceptance is not proof of inbox delivery.
# marketplace

## Inline payments

The official `@paystack/inline-js` SDK resumes a server-initialized transaction using its saved access code. Checkout and pending orders open Paystack over the current page. Closing the window preserves the checkout form and idempotency key. The popup success callback only triggers server verification; it never marks an order paid directly. Verification failures offer a status retry instead of starting another payment. A verified checkout shows confirmation inline and refreshes the bag. The hosted callback remains available for payment channels that return via redirect.

## Vercel sample deployment

`vercel.json` uses the Hobby-compatible daily email retry schedule. Immediate welcome and receipt delivery remains part of signup/payment; only scheduled recovery is daily. Set a random `CRON_SECRET` as a server-side environment variable. The retry route rejects requests without its bearer secret.

Deploy this `shop` directory from the intended Vercel Hobby account. Configure the existing server environment credentials there, set `APP_URL` to the stable production Vercel URL, and add that origin to `ALLOWED_ORIGINS`. Add `<APP_URL>/api/auth/google/callback` to the existing Google OAuth client's redirect URIs. Update the Paystack test webhook to `<APP_URL>/api/paystack/webhook`. Rebuild the native app with the new `EXPO_PUBLIC_API_URL`.

Never upload `.env` files as deployment source. `.vercelignore` excludes local secrets, generated Netlify state and tool artifacts. Preserve the existing Netlify deployment until Vercel login, payment verification and emails have been checked.
