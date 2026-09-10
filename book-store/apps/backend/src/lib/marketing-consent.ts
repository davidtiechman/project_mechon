import { createHmac, timingSafeEqual } from "node:crypto"
import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

export const MARKETING_CONSENT_VERSION = "2026-09-10-v1"
export type MarketingSource = "registration" | "checkout" | "account"
export type MarketingConsent = {
  status: "subscribed" | "not_subscribed" | "unsubscribed"
  consented_at: string | null
  source: MarketingSource
  version: string
  revoked_at: string | null
  updated_at: string
  email: string
  phone: string
  signature: string
}

const normalizeEmail = (value?: string | null) => (value || "").trim().toLowerCase()
const normalizePhone = (value?: string | null) => (value || "").replace(/[^+\d]/g, "")
function digest(container: MedusaContainer, value: unknown) {
  const secret = container.resolve("configModule").projectConfig.http.jwtSecret
  if (typeof secret !== "string" || !secret) throw new Error("Consent signing secret is not configured")
  return createHmac("sha256", secret).update(JSON.stringify(value)).digest("hex")
}
function equal(left: unknown, right: string) {
  return typeof left === "string" && /^[a-f0-9]{64}$/.test(left) &&
    timingSafeEqual(new Uint8Array(Buffer.from(left, "hex")), new Uint8Array(Buffer.from(right, "hex")))
}
function signature(container: MedusaContainer, customerId: string, consent: Omit<MarketingConsent, "signature">) {
  return digest(container, ["marketing-consent", customerId, consent.status, consent.consented_at,
    consent.source, consent.version, consent.revoked_at, consent.updated_at, consent.email, consent.phone])
}
export function readMarketingConsent(container: MedusaContainer, customerId: string, value: unknown): MarketingConsent | null {
  const receipt = value as MarketingConsent | null
  if (!receipt || !["subscribed", "not_subscribed", "unsubscribed"].includes(receipt.status)) return null
  if (!equal(receipt.signature, signature(container, customerId, receipt))) return null
  return receipt
}
export function marketingUnsubscribeToken(container: MedusaContainer, customerId: string) {
  return `${customerId}.${digest(container, ["marketing-unsubscribe", customerId])}`
}
export async function saveMarketingConsent(
  container: MedusaContainer,
  customerId: string,
  accepted: boolean,
  source: MarketingSource,
  version: string,
  contacts?: { email?: string | null; phone?: string | null },
) {
  if (accepted && version !== MARKETING_CONSENT_VERSION) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "נוסח ההסכמה לדיוור עודכן. יש לרענן את העמוד ולנסות שוב.")
  }
  const customers: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
  const customer = await customers.retrieveCustomer(customerId)
  const previous = readMarketingConsent(container, customer.id, customer.metadata?.marketing_consent)
  // An unchecked optional signup/checkout checkbox is not a withdrawal.
  if (!accepted && previous) return previous
  const now = new Date().toISOString()
  const receipt: MarketingConsent = {
    status: accepted ? "subscribed" : "not_subscribed",
    consented_at: accepted ? now : null,
    source, version: MARKETING_CONSENT_VERSION,
    revoked_at: previous?.revoked_at || null,
    updated_at: now,
    email: normalizeEmail(contacts?.email ?? customer.email),
    phone: normalizePhone(contacts?.phone ?? customer.phone),
    signature: "",
  }
  receipt.signature = signature(container, customer.id, receipt)
  await customers.updateCustomers(customer.id, { metadata: { ...customer.metadata, marketing_consent: receipt } })
  return receipt
}

export async function revokeMarketingConsent(container: MedusaContainer, customerId: string) {
  const customers: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
  const original = await customers.retrieveCustomer(customerId)
  // Guest and registered customer records can share an email. Withdraw for both.
  let skip = 0
  do {
    const batch = original.email
      ? await customers.listCustomers({ email: original.email }, { skip, take: 100 })
      : [original]
    for (const customer of batch) {
      const previous = readMarketingConsent(container, customer.id, customer.metadata?.marketing_consent)
      if (previous?.status === "unsubscribed") continue
      const now = new Date().toISOString()
      const receipt: MarketingConsent = {
        status: "unsubscribed", consented_at: previous?.consented_at || null,
        source: previous?.source || "account", version: previous?.version || MARKETING_CONSENT_VERSION,
        revoked_at: now, updated_at: now,
        email: normalizeEmail(customer.email), phone: normalizePhone(customer.phone), signature: "",
      }
      receipt.signature = signature(container, customer.id, receipt)
      await customers.updateCustomers(customer.id, { metadata: { ...customer.metadata, marketing_consent: receipt } })
    }
    if (batch.length < 100 || !original.email) break
    skip += batch.length
  } while (true)
}

export async function unsubscribeWithToken(container: MedusaContainer, token: unknown) {
  if (typeof token !== "string" || token.length > 250) throw new MedusaError(MedusaError.Types.INVALID_DATA, "קישור ההסרה אינו תקין.")
  const [customerId, tokenSignature, extra] = token.split(".")
  if (extra || !/^cus_[a-zA-Z0-9]+$/.test(customerId) ||
      !equal(tokenSignature, digest(container, ["marketing-unsubscribe", customerId]))) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "קישור ההסרה אינו תקין.")
  }
  await revokeMarketingConsent(container, customerId)
}

// Future campaign integrations must call this against current Customer metadata
// at send time, never against an old Order snapshot or an exported mailing list.
export async function canSendMarketing(container: MedusaContainer, customerId: string, channel: "email" | "phone", recipient: string) {
  if (process.env.MARKETING_DELIVERY_ENABLED !== "true") return false
  const customers: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
  const customer = await customers.retrieveCustomer(customerId)
  const receipt = readMarketingConsent(container, customer.id, customer.metadata?.marketing_consent)
  if (receipt?.status !== "subscribed" || !receipt.consented_at || receipt.version !== MARKETING_CONSENT_VERSION) return false
  const expected = channel === "email" ? normalizeEmail(recipient) : normalizePhone(recipient)
  const current = channel === "email" ? normalizeEmail(customer.email) : normalizePhone(customer.phone)
  return !!expected && receipt[channel] === expected && current === expected
}
