// Copy the exact domain association file supplied by Nedarim into this server-side
// environment variable. Serve it at the root, without a country prefix or redirect.
export const dynamic = "force-dynamic"

export async function GET() {
  const file = process.env.NEDARIM_APPLE_PAY_DOMAIN_ASSOCIATION
  if (!file) return new Response("Not configured", { status: 404 })
  return new Response(file, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } })
}
