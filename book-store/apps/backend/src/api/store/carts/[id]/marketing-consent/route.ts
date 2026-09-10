import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { marketingUnsubscribeToken, saveMarketingConsent } from "../../../../../lib/marketing-consent"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { MARKETING_CONSENT_VERSION, marketingUnsubscribeToken, saveMarketingConsent } from "../../../../../lib/marketing-consent"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as { accepted?: unknown; version?: unknown }
  if (typeof body?.accepted !== "boolean") return res.status(400).json({ message: "בחירת הדיוור אינה תקינה." })
  if (body.accepted && body.version !== MARKETING_CONSENT_VERSION) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "נוסח ההסכמה לדיוור עודכן. יש לרענן את העמוד ולנסות שוב.")
  }
  const carts = req.scope.resolve(Modules.CART)
  const cart = await carts.retrieveCart(req.params.id, { relations: ["shipping_address"] })
  if (cart.completed_at || !cart.customer_id || !cart.email) return res.status(409).json({ message: "יש להשלים תחילה את פרטי הקשר בקופה." })
  let cart = await carts.retrieveCart(req.params.id, { relations: ["shipping_address"] })
  if (cart.completed_at || !cart.email) return res.status(409).json({ message: "יש להשלים תחילה את פרטי הקשר בקופה." })

  if (!cart.customer_id) {
    await updateCartWorkflow(req.scope).run({ input: { id: cart.id, email: cart.email } })
    cart = await carts.retrieveCart(cart.id, { relations: ["shipping_address"] })
  }
  if (!cart.customer_id || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "לא ניתן לשמור את בחירת הדיוור לעגלה זו. יש לרענן ולנסות שוב.")
  }
  const receipt = await saveMarketingConsent(req.scope, cart.customer_id, body.accepted, "checkout", String(body.version || ""),
    { email: cart.email, phone: cart.shipping_address?.phone })
  await carts.updateCarts(cart.id, { metadata: { ...cart.metadata,
    marketing_consent: { ...receipt, checkout_opt_in: body.accepted },
  } })
  return res.json({ success: true, unsubscribe_token: marketingUnsubscribeToken(req.scope, cart.customer_id) })
      { email: cart.email, phone: cart.shipping_address?.phone })
    await carts.updateCarts(cart.id, {
      metadata: {
        ...cart.metadata,
        marketing_consent: { ...receipt, checkout_opt_in: body.accepted },
      }
    })
    return res.json({ success: true, unsubscribe_token: marketingUnsubscribeToken(req.scope, cart.customer_id) })
}
