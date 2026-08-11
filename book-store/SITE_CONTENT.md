# Site Content module

The storefront content system is implemented as an additive Medusa 2.17.2 module. It uses the existing Admin, authentication, PostgreSQL database, File Module and design system. No Medusa core screen is forked or modified.

## Admin usage

Open the regular Medusa Admin and select **Site Content / תוכן האתר**. The `/front` dashboard links to Home, Pages, Brands, Articles, Banners, Navigation, FAQ, Footer, SEO and Settings. Admin language follows the existing Medusa profile language; Hebrew content controls use local RTL without changing core Admin pages.

All editors use an explicit Save action. Published content is exposed by Store routes; drafts and archived records are not. Deleting Pages, Brands or Articles archives them. Rich text is sanitized on the backend with a small HTML allowlist.

To attach products to a Brand, open the Brand editor and select existing Medusa products in the Products field. Products stay in the Product Module; only Module Link records are stored.

## Data model

The `siteContent` module owns these PostgreSQL tables:

- `site_content_page`
- `site_content_section`
- `site_content_brand`
- `site_content_article`
- `site_content_banner`
- `site_content_navigation_menu`
- `site_content_navigation_item`
- `site_content_faq_item`
- `site_content_footer_section`
- `site_content_footer_link`
- `site_content_site_setting`

Medusa link tables connect Brand and Article records to Product records. The generated migration is `Migration20260809143806.ts`. It is additive and does not alter commerce data.

## API

Authenticated Admin routes:

- `GET /admin/site-content/dashboard`
- `GET|POST /admin/site-content/:entity`
- `GET|POST|DELETE /admin/site-content/:entity/:id`
- `GET|POST /admin/site-content/brands/:id/products`

Supported entity names are `pages`, `sections`, `brands`, `articles`, `banners`, `navigation-menus`, `navigation-items`, `faq`, `footer-sections`, `footer-links`, and `settings`.

Published Store routes:

- `GET /store/site-content/home`
- `GET /store/site-content/:entity`
- `GET /store/site-content/pages/:slug`
- `GET /store/site-content/brands/:slug`
- `GET /store/site-content/articles/:slug`

Store requests use the project's existing publishable API key. List routes return summaries/paginated records and accept `limit` and `offset`.

## Storefront and SEO

The Next.js data layer is in `apps/storefront/src/lib/data/site-content.ts`. Requests use a 60-second revalidation window and gracefully fall back to the previous hardcoded Home content when the backend is unavailable. New public routes are:

- `/:countryCode/pages/:slug`
- `/:countryCode/brands/:slug`
- `/:countryCode/articles/:slug`
- `/sitemap.xml`

Page metadata supports title, description, canonical and Open Graph values stored in the `seo` JSON field. The sitemap contains published Pages, Brands and Articles. Brand pages expose linked Product pages for internal linking.

## Deployment and maintenance

Run from the repository root:

```sh
npm run build
```

On a new database, apply the additive schema and initial content:

```sh
cd apps/backend
npx medusa db:migrate
npx medusa exec ./src/scripts/seed-site-content.ts
```

The seed is idempotent. It imports the four existing institute brands, the current Home hero and default SEO settings without changing Product data.

## Future extension points

- A publish subscriber can trigger an external static-site build webhook.
- Cache invalidation can replace the current short revalidation window when a shared cache is introduced.
- Article-to-Brand, Article-to-Article and Article-to-Product selection can be surfaced in richer Admin pickers using the relationships already represented by the model/link architecture.
- Navigation and Footer support structured records; the remaining hardcoded technical/account labels should stay in code.
