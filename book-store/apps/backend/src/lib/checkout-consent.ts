import { createHmac, timingSafeEqual } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

// Bump together with storefront/src/lib/checkout-consent.ts whenever any linked policy changes.
export const CHECKOUT_TERMS_VERSION = "2026-09-10-v2"
export const CHECKOUT_CONSENT_ERROR = "יש לאשר את תנאי הרכישה ומדיניות האתר לפני ביצוע ההזמנה."

export type CheckoutConsent = {
  accepted: true
  accepted_at: string
  terms_version: string
  signature: string
}

function sign(cartId: string, acceptedAt: string, version: string, secret: unknown) {
  if (typeof secret !== "string" || !secret) throw new Error("Checkout consent signing secret is not configured")
  return createHmac("sha256", secret)
    .update(JSON.stringify(["checkout-consent", cartId, true, acceptedAt, version]))
    .digest("hex")
}

export function createCheckoutConsent(cartId: string, secret: unknown): CheckoutConsent {
  const acceptedAt = new Date().toISOString()
  return {
    accepted: true,
    accepted_at: acceptedAt,
    terms_version: CHECKOUT_TERMS_VERSION,
    signature: sign(cartId, acceptedAt, CHECKOUT_TERMS_VERSION, secret),
  }
}

// Cart metadata can be written through the public API. Verify a server-issued receipt,
// rather than trusting a caller-supplied boolean or timestamp.
export function validateCheckoutConsent(cartId: string, value: unknown, secret: unknown) {
  const receipt = value as Partial<CheckoutConsent> | null | undefined
  if (!receipt || receipt.accepted !== true ||
      receipt.terms_version !== CHECKOUT_TERMS_VERSION ||
      typeof receipt.accepted_at !== "string" ||
      !Number.isFinite(Date.parse(receipt.accepted_at)) ||
      Date.parse(receipt.accepted_at) > Date.now() ||
      typeof receipt.signature !== "string" || !/^[a-f0-9]{64}$/.test(receipt.signature)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, CHECKOUT_CONSENT_ERROR)
  }
  const expected = sign(cartId, receipt.accepted_at, receipt.terms_version, secret)
  if (!timingSafeEqual(new Uint8Array(Buffer.from(receipt.signature, "hex")), new Uint8Array(Buffer.from(expected, "hex")))) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, CHECKOUT_CONSENT_ERROR)
  }
}
