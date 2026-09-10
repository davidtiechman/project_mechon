# Marketing consent preparation

## Medusa 2.17.2 findings (checked before implementation)

The installed `@medusajs/customer` package identifies itself as 2.17.2. Its Customer model (`node_modules/@medusajs/customer/dist/models/customer.js`), Customer types and Store Customer API contain no newsletter/marketing-consent field or subscription lifecycle. The Customer module provides `metadata` and guest customer records. The cart workflows' `findOrCreateCustomerStep` associates carts with customer records, including guests.

Medusa documents metadata as its mechanism for additional data that does not require a separate relational model: https://docs.medusajs.com/learn/fundamentals/data-models/json-properties . No custom table, module, migration, or parallel mailing list was introduced.

## Storage and behavior

`Customer.metadata.marketing_consent` is the current source of truth. It stores `status` (`subscribed`, `not_subscribed`, `unsubscribed`), `consented_at`, `source`, `version`, `revoked_at`, `updated_at`, the covered email/phone, and an integrity signature. Times come from the backend in UTC. Source is `registration`, `checkout`, or `account`. Withdrawal preserves the original consent time/source and records a revocation time. A new explicit opt-in updates consent time/source while retaining the last revocation time.

Missing, invalid, or unsigned metadata means no permission. Public generic Customer/Cart metadata updates cannot write the protected key. The optional signup/checkout checkbox is initially unchecked, independent of terms acceptance, and never inferred from login, registration, purchase, or address entry. An unchecked box does not withdraw an earlier subscription; withdrawal is an explicit separate action.

At checkout the current receipt plus `checkout_opt_in` is copied to Cart metadata, which Medusa copies into the Order at creation. Order metadata is a historical snapshot, not permission for future campaigns. Marketing persistence failures never prevent checkout or authentication and do not grant consent.

Email/password signup retains the opt-in choice through the existing pending-registration cookie until verified login creates the Customer. Google signup uses a short-lived HttpOnly cookie prepared by a server action; the callback persists opt-in only after authentication. Neither path infers consent from the identity provider.

## Withdrawal and future delivery

`/il/marketing-preferences` supports authenticated preferences and token-based guest withdrawal without login. Checkout stores a signed removal token in an HttpOnly cookie, so guests can return to the preferences page from the same browser. A future campaign must include `/il/marketing-preferences?token=...` generated with `marketingUnsubscribeToken`. Opening the page does not change preferences; removal requires POST. Email/contact support remains an alternative. Removal applies to both guest and account records with the same email and does not affect transactional order/authentication emails.

**No campaign is configured or sent.** Existing Resend templates are transactional only. Future campaign integrations must call `canSendMarketing(container, customerId, channel, recipient)` immediately before every send; it loads current Customer metadata, checks the signature, explicit subscription, supported version and recipient match. Do not send from old Order snapshots or exported lists. The helper defaults to false unless `MARKETING_DELIVERY_ENABLED=true`; that flag is deliberately not enabled. Enabling the flag alone does not create a sender. A future provider must implement removal links and re-check consent at delivery time.

## Versions and privacy disclosure

Marketing wording version: `2026-09-10-v1`, in backend `src/lib/marketing-consent.ts` and storefront `src/lib/marketing-consent.ts`. Update both together for a wording revision. The exact wording is:

> אני מעוניין/ת לקבל עדכונים, מבצעים והטבות ממכון מעשה רוקח בדוא״ל ו/או באמצעי הקשר שמסרתי.

The privacy page includes the additional disclosure from `marketing-privacy-notice/index.tsx` alongside the original CMS text. The mandatory checkout policy version was bumped to `2026-09-10-v2` for that privacy update. No database migration is required. Deploy backend and storefront together.
