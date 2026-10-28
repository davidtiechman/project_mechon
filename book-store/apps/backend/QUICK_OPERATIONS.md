# Quick operations

The **Quick operations / תפעול מהיר** sidebar entry remains visible but is temporarily
disabled while the feature is being completed. The route remains available directly at
`/app/quick-operations` (replace `/app` if the Admin base path is customized).
Medusa 2.17.2 has no disabled-menu configuration. The extension's
`QuickOperationsMenuIcon` marks only its containing link as disabled, removes its
navigation target and tab stop, and prevents mouse/keyboard activation. To enable
the menu again, replace this icon in the route config with the ordinary `Bolt` icon.
This is an additional Admin route; standard product, inventory and order screens are unchanged.

## Configuration and use

Choose **Change settings** to select a warehouse, sales channel and shipping profile.
The summary remains visible when these controls are collapsed. Exact, unique matches
for the existing warehouse/channel/profile names are initial suggestions only;
ambiguous matches require a selection. IDs always come from authenticated APIs.
**Advanced settings** contains currency, editable generated handle, inventory,
backorders and warehouse splitting. ILS is preferred only when supported by the store.
Use **Save defaults** to retain choices for the current Admin user in this browser's
local storage (`quick-book-defaults:<user-id>`). Saving preferences revalidates current
settings; product submission revalidates settings again on the server. Refresh settings
to include new records. Every settings list is paginated, including custom brands.

The form creates standard Medusa products. Institute/series uses the existing
`brand`–product link in the site-content module; categories and collections use native
Medusa associations. The storefront's new-books section already sorts by descending
`created_at`, so there is no extra new-books tag or storefront change.

Images use `/admin/uploads` and the configured file provider. The first image is the
cover; publishing requires it, drafts do not. Uploaded files are retained on a failed
save rather than risking deletion of shared files. No new storage service is used.
Prices are major currency units (49.90 means 49.90, not 4990), with currency decimal
precision validation. Stock is a nonnegative integer; zero is explicitly supported.

## Languages

Verified installed `@medusajs/dashboard`, framework, Admin SDK and core flows: **2.17.2**.
UI: **4.1.19**. In that dashboard version:

- `src/routes/profile/profile-edit/components/edit-profile-form/edit-profile-form.tsx`
  calls the shared `i18n.changeLanguage(values.language)` after saving the profile.
- `src/i18n/config.ts` sets `fallbackLng: "en"` and detects/caches the language through
  the dashboard's cookie/local-storage mechanism. The language is not a new custom
  preference or product field.
- `src/providers/i18n-provider/i18n-provider.tsx` updates document direction and the
  Medusa UI locale provider.
- Native navigation translates extension labels when `translationNs` is supplied.

The new page uses the same `useTranslation()` instance and `i18n.dir()`, including
reactive validation and success messages. Native selects inherit direction; table
alignment is logical, the table scrolls inside its container, and numeric/SKU/handle
inputs remain LTR. There is no additional language selector, i18next initialization,
resource mutation, or document-direction override in production code.

Resources extend the existing `src/admin/i18n/index.ts` under
`translation.quickOperations`, in English and Hebrew. Suitable existing keys under
`fields`, `actions`, and `products.variant.inventory` are reused. Other languages use
the existing English fallback. The extension does not override existing keys.
Book title, description, sizes, binding, category/brand names and other catalog data
are never translated when the Admin language changes. Persisted option titles are
stable `Size`/`Binding` regardless of interface language.

This is Medusa's supported extension mechanism; no translation-extension limitation
was found and no alternate translation system was created. Official reference:
[Translate Admin Customizations](https://docs.medusajs.com/learn/fundamentals/admin/translations).
Installed source, rather than the latest documentation version, determined behavior.

## Save and recovery

`POST /admin/quick-operations/books` requires Admin authentication and native policies
for product creation/update, price creation, and inventory item/level creation.
The settings endpoint has corresponding native read policies. These use Medusa's
existing permission enforcement when RBAC is enabled.

The custom workflow composes official inventory creation, product/variant/pricing,
inventory-level and product-update workflows, with a compensating brand-link step.
Each new inventory link requires one unit. Publication is last and depends on both
inventory levels and brand linkage. No checkout, reservation, payment or fulfillment
logic is replaced. Location/channel mismatches block saving; missing matching shipping
options are explained without modifying global settings. Full checkout compatibility
still requires a cart and address.

The client blocks concurrent uploads/saves. A request UUID plus authenticated actor
produces a deterministic product ID; a payload fingerprint detects changed requests.
Medusa's configured Locking Module serializes saves within its provider's scope.
Identical successful retries return the same product. Compensated failures can retry
with the same request. On an uncertain network failure the form is frozen and offers
an identical-request retry. Partial products are explicitly reported and linked to the
full Admin for review/completion, rather than automatically replaying stock changes.

The project currently uses Medusa's default in-memory locking provider. Deterministic
IDs also prevent duplicate products across processes, but a concurrent request on a
second server may temporarily report the still-in-progress product as partial. For a
multi-server deployment, configure Medusa's official distributed locking provider
(e.g. PostgreSQL) as an infrastructure change. No global locking configuration was
changed by this feature. Form/request state is held in the mounted page; avoid
reloading during an unresolved request and review the product in native Admin after
an interrupted browser session. Media storage and the commerce modules do not share
one database transaction.

## Files

- `src/admin/routes/quick-operations/page.tsx`: route, form and authenticated client calls.
- `src/admin/i18n/quick-operations.ts`, `src/admin/i18n/index.ts`: resources and registration.
- `src/api/admin/quick-operations/settings/{route,data}.ts`: paginated live configuration.
- `src/api/admin/quick-operations/books/route.ts`, `src/api/middlewares.ts`: save, authentication and policies.
- `src/shared/quick-book.ts`: validation and compatibility checks shared by client/server.
- `src/workflows/create-quick-book.ts`: standard Medusa workflow composition.
- New `__tests__` files alongside shared validation and both API areas: unit coverage.

## Verification and activation

- `npm run test:unit --workspace=@dtc/backend` from the monorepo: **48 tests passed in
  7 suites**, including existing tests. Coverage includes multiple/single variants,
  prices, explicit inventory links and split quantities, zero stock, duplicate options,
  SKUs and warehouses, deleted defaults, unauthorized requests, concurrent retries,
  compensated/partial failure handling, pagination past 100 records, language changes,
  English fallback, matching translation placeholders and existing site-content labels.
- `npm run build --workspace=@dtc/backend`: backend and Admin builds passed. Existing
  lint warnings remain; the shared browser-safe Zod import also triggers Medusa's
  server-oriented Zod-import warning.
- Standalone backend/Admin `tsc --noEmit`: not clean. Existing React 18/19 type
  incompatibilities affect Medusa UI components throughout old and new pages; the
  root Node16 compiler configuration rejects the pre-existing JSON import attribute;
  existing front-content routes also have `products` typing errors. No broad dependency
  or unrelated route changes were made to hide these failures.
- Browser verification used the actual route and built Admin stylesheet with local
  mocked APIs only: Hebrew/English direction, translated validation and success,
  preserved Hebrew book title, French-to-English fallback, adding a variant, and a
  390px viewport. The 790px table scrolls within its 310px container; the document
  remains 390px wide. Numeric inputs remain LTR.
- No live Medusa backend/database was running. Actual profile-drawer interaction,
  real storage upload, database workflow compensation, permission enforcement over
  HTTP and end-to-end checkout still need an integration pass in a test environment.
  Unit tests mock workflow execution and do not claim to exercise live persistence.

No migration or new dependency is required. Rebuild and restart the existing backend
through the normal development/staging procedure to load the extension and API routes.
No deployment, production products, orders, or existing catalog data were created or changed.
