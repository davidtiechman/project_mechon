import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { marketingUnsubscribeToken, saveMarketingConsent } from "../../../../../lib/marketing-consent"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as { accepted?: unknown; version?: unknown }
  if (typeof body?.accepted !== "boolean") return res.status(400).json({ message: "בחירת הדיוור אינה תקינה." })
  const carts = req.scope.resolve(Modules.CART)
  const cart = await carts.retrieveCart(req.params.id, { relations: ["shipping_address"] })
  if (cart.completed_at || !cart.customer_id || !cart.email) return res.status(409).json({ message: "יש להשלים תחילה את פרטי הקשר בקופה." })
  const receipt = await saveMarketingConsent(req.scope, cart.customer_id, body.accepted, "checkout", String(body.version || ""),
    { email: cart.email, phone: cart.shipping_address?.phone })
  await carts.updateCarts(cart.id, { metadata: { ...cart.metadata,
    marketing_consent: { ...receipt, checkout_opt_in: body.accepted },
  } })
  return res.json({ success: true, unsubscribe_token: marketingUnsubscribeToken(req.scope, cart.customer_id) })
}
