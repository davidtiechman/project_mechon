# Render deployment

The repository contains a Render Blueprint (`render.yaml`) for:

- `mechon-backend`: Medusa API and Admin
- `mechon-storefront`: Next.js storefront

## Required external service

Render's free PostgreSQL database expires after 30 days, so use a free external
PostgreSQL provider such as Neon.

Redis is recommended for a production Medusa deployment, especially when using
separate server and worker instances. This free demo deployment uses one backend
instance in shared worker mode, so Redis is optional and can be added later.

## Deploy

1. Create a PostgreSQL database and copy its connection URL.
2. In Render, choose **New > Blueprint** and connect this GitHub repository.
3. Render reads `render.yaml`. Enter:
   - `DATABASE_URL`: PostgreSQL connection string.
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

## Contact form delivery

On **mechon-storefront**, set the server-only `RESEND_API_KEY`,
`RESEND_FROM_EMAIL` (a verified Resend sender), and `CONTACT_FORM_TO_EMAIL`
(the approved recipient). Backend environment variables are not inherited by
the storefront. Never prefix these variables with `NEXT_PUBLIC_`.

The form sends a plain-text email with the visitor's address as `reply_to`.
An existing `CONTACT_FORM_WEBHOOK_URL` takes precedence; unset it to use Resend.
Provider failures and timeouts return 502, and missing configuration returns 503.
Success means the provider accepted the email, not that inbox delivery is confirmed.

Deploy the updated storefront after setting these variables. With authorization
to send a test message, submit the form and verify receipt in the intended inbox
and the Reply action. Production configuration and inbox delivery still require
verification. The shared rate limiting task remains tracked in `LEGAL_TODO.md`.

API reference: https://resend.com/docs/api-reference/emails/send-email
