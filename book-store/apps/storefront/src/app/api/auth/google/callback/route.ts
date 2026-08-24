import Medusa, { FetchError } from "@medusajs/js-sdk"
import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { getCacheTag } from "@lib/data/cookies"

const RETURN_COOKIE = "_google_oauth_return_to"

type GoogleTokenPayload = {
  actor_id?: string
  user_metadata?: {
    email?: string
    given_name?: string
    family_name?: string
  }
}

const decodeTokenPayload = (token: string): GoogleTokenPayload => {
  const payload = token.split(".")[1]
  if (!payload) throw new Error("Invalid authentication token")
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
}

const safeReturnPath = (value: string | undefined) =>
  value?.startsWith("/") && !value.startsWith("//") && value.length <= 2048
    ? value
    : "/il/account"

const authHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
})

export async function GET(request: NextRequest) {
  // Use a request-scoped SDK instance so authentication state is never shared
  // between users in the long-lived Next.js server process.
  const sdk = new Medusa({
    baseUrl:
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  })
  const storefrontUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    request.nextUrl.origin
  const returnTo = safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value)
  const destination = new URL(returnTo, storefrontUrl)

  if (request.nextUrl.searchParams.get("error")) {
    destination.searchParams.set("google_auth_error", "cancelled")
    const response = NextResponse.redirect(destination)
    response.cookies.delete(RETURN_COOKIE)
    return response
  }

  try {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const callback = await sdk.client.fetch<{ token: string }>(
      "/auth/customer/google/callback",
      { method: "GET", query, cache: "no-store" }
    )
    let token = callback.token
    const payload = decodeTokenPayload(token)

    if (!payload.actor_id) {
      try {
        await sdk.client.fetch("/auth/link-customer-google", {
          method: "POST",
          headers: authHeaders(token),
          cache: "no-store",
        })
      } catch (error) {
        if (!(error instanceof FetchError) || error.status !== 404) throw error

        const email = payload.user_metadata?.email
        if (!email) throw new Error("Google did not return an email")

        await sdk.store.customer.create(
          {
            email,
            first_name: payload.user_metadata?.given_name,
            last_name: payload.user_metadata?.family_name,
          },
          {},
          authHeaders(token)
        )
      }

      const refreshed = await sdk.client.fetch<{ token: string }>(
        "/auth/token/refresh",
        {
          method: "POST",
          headers: authHeaders(token),
          cache: "no-store",
        }
      )
      token = refreshed.token
    }

    if (
      payload.user_metadata?.given_name ||
      payload.user_metadata?.family_name
    ) {
      const { customer } = await sdk.store.customer.retrieve(
        {},
        authHeaders(token)
      )
      const missingNames = {
        ...(!customer.first_name && payload.user_metadata.given_name
          ? { first_name: payload.user_metadata.given_name }
          : {}),
        ...(!customer.last_name && payload.user_metadata.family_name
          ? { last_name: payload.user_metadata.family_name }
          : {}),
      }

      if (Object.keys(missingNames).length) {
        await sdk.store.customer.update(
          missingNames,
          {},
          authHeaders(token)
        )
      }
    }

    const cartId = request.cookies.get("_medusa_cart_id")?.value
    if (cartId) {
      await sdk.store.cart
        .transferCart(cartId, {}, authHeaders(token))
        .catch(() => undefined)
    }

    const customerCacheTag = await getCacheTag("customers")
    const cartCacheTag = await getCacheTag("carts")
    if (customerCacheTag) revalidateTag(customerCacheTag)
    if (cartCacheTag) revalidateTag(cartCacheTag)

    const response = NextResponse.redirect(destination)
    response.cookies.set("_medusa_jwt", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    response.cookies.delete(RETURN_COOKIE)
    return response
  } catch {
    destination.searchParams.set("google_auth_error", "failed")
    const response = NextResponse.redirect(destination)
    response.cookies.delete(RETURN_COOKIE)
    return response
  }
}
