import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ICartModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CHECKOUT_CONSENT_ERROR, CHECKOUT_TERMS_VERSION, createCheckoutConsent } from "../../../../../lib/checkout-consent"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as { accepted?: unknown; terms_version?: unknown } | undefined
  if (body?.accepted !== true || body.terms_version !== CHECKOUT_TERMS_VERSION) {
    return res.status(400).json({ message: CHECKOUT_CONSENT_ERROR })
  }
  const carts: ICartModuleService = req.scope.resolve(Modules.CART)
  const cart = await carts.retrieveCart(req.params.id)
  if (cart.completed_at) return res.status(409).json({ message: "ההזמנה כבר בוצעה." })
  const config = req.scope.resolve("configModule")
  const receipt = createCheckoutConsent(cart.id, config.projectConfig.http.jwtSecret)
  await carts.updateCarts(cart.id, {
    metadata: { ...cart.metadata, checkout_consent: receipt },
  })
  return res.json({ accepted: receipt.accepted, accepted_at: receipt.accepted_at, terms_version: receipt.terms_version })
}
