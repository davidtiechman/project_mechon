import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { MARKETING_CONSENT_VERSION, readMarketingConsent, revokeMarketingConsent, saveMarketingConsent } from "../../../../../lib/marketing-consent"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customer = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  const receipt = readMarketingConsent(req.scope, customer.id, customer.metadata?.marketing_consent)
  return res.json({ consent: receipt ? { status: receipt.status, consented_at: receipt.consented_at, revoked_at: receipt.revoked_at } : null })
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { accepted?: unknown; version?: unknown; source?: unknown }
  if (typeof body?.accepted !== "boolean" || !["registration", "account"].includes(String(body.source))) {
    return res.status(400).json({ message: "בחירת הדיוור אינה תקינה." })
  }
  if (!body.accepted && body.source === "account") {
    await revokeMarketingConsent(req.scope, req.auth_context.actor_id)
  } else {
    await saveMarketingConsent(req.scope, req.auth_context.actor_id, body.accepted,
      body.source as "registration" | "account", String(body.version || ""))
  }
  return res.json({ success: true, version: MARKETING_CONSENT_VERSION })
}
