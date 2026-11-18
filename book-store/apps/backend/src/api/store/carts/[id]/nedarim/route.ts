import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { validateCheckoutConsent } from "../../../../../lib/checkout-consent"
import { createNedarimTransaction, nedarimEnabled, NEDARIM_METHODS } from "../../../../../lib/nedarim"
import { activeNedarimSession, assertNedarimCart, loadNedarimCart } from "../../../../../lib/nedarim-checkout"
import NedarimPaymentsService from "../../../../../modules/nedarim-payments/service"

async function context(req: MedusaStoreRequest) {
  if (!nedarimEnabled()) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Nedarim is not configured")
  const cart = await loadNedarimCart(req.scope, req.params.id)
  if (!req.publishable_key_context?.sales_channel_ids.includes(cart.sales_channel_id!)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }
  const session = activeNedarimSession(cart)
  if (!session || typeof session.data?.attempt_id !== "string") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "יש לבחור תשלום בנדרים פלוס.")
  }
  const ledger: NedarimPaymentsService = req.scope.resolve("nedarimPayments")
  const attempt = await ledger.retrieveNedarimAttempt(session.data.attempt_id)
  assertNedarimCart(attempt, cart, session)
  return { cart, attempt, ledger }
}

export async function POST(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")
  if (process.env.NEDARIM_ACCEPT_NEW_PAYMENTS === "false") {
    return res.status(503).json({ message: "פתיחת תשלומים חדשים מושהית בסביבה זו.", code: "nedarim_payments_paused" })
  }
  const { cart, attempt, ledger } = await context(req)
  if (cart.completed_at || attempt.paid_at) return res.json({ status: "paid" })
  if (!cart.email || !cart.shipping_address || !cart.billing_address || !cart.shipping_methods?.length) {
    return res.status(400).json({ message: "יש להשלים את פרטי ההזמנה והמשלוח לפני התשלום." })
  }
  const config = req.scope.resolve("configModule")
  validateCheckoutConsent(cart.id, cart.metadata?.checkout_consent, config.projectConfig.http.jwtSecret)
  let prepared = attempt
  if (!attempt.transaction_id) {
    const startedAt = await ledger.claimCreation(attempt.id, cart.id)
    if (!startedAt) {
      return res.status(409).json({ message: "התשלום נמצא בהכנה. יש להמתין רגע ולנסות שוב." })
    }
    const transaction = await createNedarimTransaction(attempt, cart)
    if (!await ledger.finishCreation(attempt.id, startedAt, transaction)) {
      return res.status(409).json({ message: "פרטי התשלום השתנו. יש לרענן את העמוד." })
    }
    prepared = await ledger.retrieveNedarimAttempt(attempt.id)
  }
  return res.json({ status: "pending", payment: {
    TransactionId: prepared.transaction_id, Key: prepared.transaction_key,
    Methods: NEDARIM_METHODS, ButtonText: "תשלום",
  } })
}

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")
  const { attempt } = await context(req)
  return res.json({ status: attempt.paid_at && attempt.payment_id ? "paid" : "pending" })
}
