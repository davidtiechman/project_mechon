import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { unsubscribeWithToken } from "../../../../lib/marketing-consent"

// POST only: opening a link or an email scanner must not change a subscription.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  await unsubscribeWithToken(req.scope, (req.body as { token?: unknown })?.token)
  return res.json({ success: true })
}
