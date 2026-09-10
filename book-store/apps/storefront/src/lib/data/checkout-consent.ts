"use server"

import { sdk } from "@lib/config"
import { CHECKOUT_CONSENT_ERROR, CHECKOUT_TERMS_VERSION } from "@lib/checkout-consent"
import { getAuthHeaders, getCartId } from "./cookies"

export async function acceptCheckoutTerms(accepted: boolean, version: string) {
  if (accepted !== true || version !== CHECKOUT_TERMS_VERSION) {
    throw new Error(CHECKOUT_CONSENT_ERROR)
  }
  const cartId = await getCartId()
  if (!cartId) throw new Error("לא נמצאה עגלת קניות פעילה.")
  await sdk.client.fetch(`/store/carts/${cartId}/terms-acceptance`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: { accepted: true, terms_version: version },
    cache: "no-store",
  })
}
