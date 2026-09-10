# Checkout policy consent

Current document version: `2026-09-10-v2` (privacy disclosure updated for optional marketing consent).

The unchecked, required checkbox covers these documents:

- `/il/pages/terms-of-purchase` (the existing `terms` CMS record)
- `/il/pages/shipping-returns` (the `shipping` and `cancellations` CMS records)
- `/il/pages/privacy-accessibility` (the `privacy` and `accessibility` CMS records; the checkbox requests consent to privacy only)

Before either manual payment or Stripe confirmation, the storefront sends explicit approval and the version to `POST /store/carts/:id/terms-acceptance`. The backend records its own UTC timestamp. `completeCartWorkflow.hooks.validate` rejects completion unless the cart contains a valid server-signed receipt for the current version. The signature binds the receipt to the cart and prevents public cart-metadata updates from forging approval or its time. Signing uses the existing backend JWT secret.

Medusa copies the cart metadata to the order during creation. The order's `metadata.checkout_consent` contains `accepted`, `accepted_at` (UTC ISO 8601), `terms_version`, and the integrity signature. Existing orders are not backfilled or rewritten.

## Publishing a document revision

For every update to these documents, assign a new fixed version (for example `2026-09-11-v1`) in both:

- `apps/backend/src/lib/checkout-consent.ts`
- `apps/storefront/src/lib/checkout-consent.ts`

Archive the exact approved document text for each version. Publish the revised CMS documents and deploy the matching version in both applications together. A stale storefront version is rejected before payment starts, requiring a refresh and new approval. Previously created orders retain their original version and timestamp. CMS edits do not automatically bump the version.

Deploy both backend and storefront for the consent requirement to take effect end to end.
