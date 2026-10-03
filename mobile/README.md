# Okirika mobile

Expo SDK 57 / React Native app for Android and iOS, connected to the existing Okirika shop.

## Included

- Native collection, search, category filters and product details.
- Account-backed shopping bag, quantities and delivery totals.
- Separate Google sign-in and account creation through the system browser.
- SecureStore session storage and a single-use, verifier-bound login exchange.
- Embedded checkout with inline Paystack test payment, server-side payment verification and branded confirmation emails through the shop backend.
- Order history, payment status checks and confirmation email retries.
- Okirika app icon, splash screen, colours and typography.

## Run and check

```sh
npm ci
npm run typecheck
npx eslint App.tsx src
npx expo start
```

Optional `.env` contains only `EXPO_PUBLIC_API_URL`; its default is `https://okirika-shop.vercel.app`. Never put database, Google client secret, Mailgun or Paystack secret keys in this app. Those remain on Vercel.

The web export is a layout preview. Native Google authentication, SecureStore and embedded checkout must be tested on Android/iOS. The bundled catalogue is a read-only fallback when the API is unavailable.

## Builds

Expo project: https://expo.dev/accounts/davik4life1/projects/okirika

```sh
# Use EAS_NO_VCS=1 if working outside a Git repository.
EAS_NO_VCS=1 npm run build:android
EAS_NO_VCS=1 npm run build:simulator
# Physical iPhone: requires Apple Developer signing and registered test devices.
EAS_NO_VCS=1 npm run build:ios
```

Android preview produces an APK. The simulator profile produces an iOS simulator app, which cannot be installed on a physical iPhone. Production builds and store submission require store accounts and signing configuration. Generated `android/` and `ios/` folders are ignored; EAS generates them from app.json.

## Backend deployment

The sibling `shop` project is deployed at `https://okirika-shop.vercel.app` with its mobile endpoints and production settings. The `004_mobile.sql` migration was applied to the configured Neon database. Add `https://okirika-shop.vercel.app/api/auth/google/callback` to the Google OAuth client's authorized redirect URIs before testing sign-in.

After the Vercel callback is authorized in Google OAuth, the backend redirects to `okirika://auth` with a short-lived code; the app exchanges it using a verifier held in SecureStore. Set the Paystack webhook URL to `https://okirika-shop.vercel.app/api/paystack/webhook`. Checkout uses a separate single-use ticket to create a child web session. Signing out revokes that session too.

Before device acceptance: sign up, confirm the welcome email, sign out/in, add products, change quantity, open checkout, cancel and reopen payment, complete a Paystack test payment, verify the paid order and receipt, relaunch the app and verify session persistence. Mailgun sandbox recipients must be authorized until a production sending domain is configured.

## Release status

This is an internal test app, not an App Store / Play Store release. Native device end-to-end testing remains pending Google OAuth callback authorization and device access. Store release work still includes account deletion, Apple sign-in where required, finalized privacy/support details, store metadata and review. Payments remain in test mode.
