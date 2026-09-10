"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId } from "./cookies"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { MARKETING_CONSENT_VERSION } from "@lib/marketing-consent"

export async function prepareGoogleMarketingConsent(accepted: boolean, version: string) {
  const jar = await cookies()
  if (accepted === true && version === MARKETING_CONSENT_VERSION) {
    jar.set("_google_oauth_marketing", version, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
    })
  } else {
    jar.delete("_google_oauth_marketing")
  }
}

export async function saveCheckoutMarketingConsent(accepted: boolean, version: string) {
  const cartId = await getCartId()
  if (!cartId) throw new Error("לא נמצאה עגלת קניות פעילה.")
  const result = await sdk.client.fetch<{ unsubscribe_token: string }>(`/store/carts/${cartId}/marketing-consent`, {
  const result = await sdk.client.fetch<{ unsubscribe_token?: string | null }>(`/store/carts/${cartId}/marketing-consent`, {
    method: "POST", headers: await getAuthHeaders(), body: { accepted, version }, cache: "no-store",
  })
  const jar = await cookies()
  jar.set("_marketing_unsubscribe", result.unsubscribe_token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  })
  if (result?.unsubscribe_token) {
    const jar = await cookies()
    jar.set("_marketing_unsubscribe", result.unsubscribe_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
    })
  }
}

export async function getMarketingPreference() {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) return null
  return sdk.client.fetch<{ consent: { status: string; consented_at: string | null; revoked_at: string | null } | null }>(
    "/store/customers/me/marketing-consent", { headers, cache: "no-store" },
  )
}

export async function updateMarketingPreference(accepted: boolean, version: string) {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) throw new Error("יש להתחבר לחשבון.")
  await sdk.client.fetch("/store/customers/me/marketing-consent", {
    method: "POST", headers, body: { accepted, version, source: "account" }, cache: "no-store",
  })
  revalidatePath("/il/marketing-preferences")
  revalidatePath("/il/account/profile")
}

export async function unsubscribeMarketing(token: string) {
  await sdk.client.fetch("/store/marketing-consent/unsubscribe", {
    method: "POST", body: { token }, cache: "no-store",
  })
  revalidatePath("/il/marketing-preferences")
}
