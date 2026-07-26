# Render deployment

The repository contains a Render Blueprint (`render.yaml`) for:

- `mechon-backend`: Medusa API and Admin
- `mechon-storefront`: Next.js storefront

## Required external services

Render's free PostgreSQL database expires after 30 days, so use a free external
PostgreSQL provider such as Neon. Medusa also expects Redis in production; use a
free Redis provider and copy its connection URL.

## Deploy

1. Create PostgreSQL and Redis databases and copy their connection URLs.
2. In Render, choose **New > Blueprint** and connect this GitHub repository.
3. Render reads `render.yaml`. Enter:
   - `DATABASE_URL`: PostgreSQL connection string.
   - `REDIS_URL`: Redis connection string.
   - `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`: enter `pending` for the first deploy.
   - `NEXT_PUBLIC_STRIPE_KEY`: leave empty if Stripe is not configured.
   - `IMAGE_STORAGE_URL`: the public image bucket URL, if used.
4. Deploy the Blueprint and wait for `mechon-backend` to become healthy.
5. Open `https://mechon-backend.onrender.com/app`.
6. Create an admin user from the backend service shell:
   `cd apps/backend && npx medusa user -e YOUR_EMAIL -p YOUR_PASSWORD`
7. In Medusa Admin, create or copy a publishable API key.
8. In the `mechon-storefront` Render service, replace
   `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pending` with the real key and manually
   deploy the latest commit again.

Health check: `https://mechon-backend.onrender.com/health`

Storefront: `https://mechon-storefront.onrender.com`

Admin: `https://mechon-backend.onrender.com/app`
