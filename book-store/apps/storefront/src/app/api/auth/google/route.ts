import Medusa from "@medusajs/js-sdk"
import { NextRequest, NextResponse } from "next/server"
import { safeReturnPath } from "@lib/util/safe-return-path"

const RETURN_COOKIE = "_google_oauth_return_to"

export async function GET(request: NextRequest) {
  const sdk = new Medusa({
    baseUrl:
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  })
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("return_to"))
  const storefrontUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    request.nextUrl.origin
  const callbackUrl = `${storefrontUrl}/api/auth/google/callback`

  try {
    const result = await sdk.client.fetch<{ location: string }>(
      "/auth/customer/google",
      {
        method: "POST",
        body: { callback_url: callbackUrl },
        cache: "no-store",
      }
    )

    if (!result.location) throw new Error("Google OAuth location is missing")

    const response = NextResponse.redirect(result.location)
    response.cookies.set(RETURN_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
      path: "/",
    })
    return response
  } catch {
    const errorUrl = new URL(returnTo, storefrontUrl)
    errorUrl.searchParams.set("google_auth_error", "failed")
    return NextResponse.redirect(errorUrl)
  }
}
