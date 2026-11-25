import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { validateCheckoutConsent } from "../../../../../lib/checkout-consent"
import { createNedarimTransaction, nedarimEnabled, NEDARIM_METHODS } from "../../../../../lib/nedarim"
import { activeNedarimSession, assertNedarimCart, loadNedarimCart } from "../../../../../lib/nedarim-checkout"
import { verifyWithNedarim } from "../../../../../lib/nedarim-verify"
import { loadInstallmentPolicy, maxInstallments, NEDARIM_MAX_INSTALLMENTS } from "../../../../../lib/nedarim-installments"
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
  const raw = (req.body as { installments?: unknown } | undefined)?.installments
  const installments = raw === undefined || raw === null || raw === "" ? 1 : Number(raw)
  if (!Number.isInteger(installments) || installments < 1 || installments > NEDARIM_MAX_INSTALLMENTS) {
    return res.status(400).json({ message: "מספר התשלומים אינו תקין." })
  }
  const { cart, attempt, ledger } = await context(req)
  if (cart.completed_at || attempt.paid_at) return res.json({ status: "paid" })
  if (!cart.email || !cart.shipping_address || !cart.billing_address || !cart.shipping_methods?.length) {
    return res.status(400).json({ message: "יש להשלים את פרטי ההזמנה והמשלוח לפני התשלום." })
  }
  const config = req.scope.resolve("configModule")
  validateCheckoutConsent(cart.id, cart.metadata?.checkout_consent, config.projectConfig.http.jwtSecret)
  // The owner's rule is enforced here, against the server-locked amount, never the browser.
  if (installments > 1) {
    const allowed = maxInstallments(Number(attempt.amount_minor), attempt.currency_code, await loadInstallmentPolicy(req.scope))
    if (installments > allowed) return res.json({ status: "installments_unavailable", max_installments: allowed })
  }
  // An opened transaction keeps its installment count. A different choice needs a new
  // payment session (the storefront re-creates it; a paid transaction is never replaced).
  if (attempt.transaction_id && Number(attempt.installments ?? 1) !== installments) {
    return res.json({ status: "installments_changed" })
  }
  let prepared = attempt
  if (!attempt.transaction_id) {
    const startedAt = await ledger.claimCreation(attempt.id, cart.id, installments)
    if (!startedAt) {
      return res.status(409).json({ message: "התשלום נמצא בהכנה. יש להמתין רגע ולנסות שוב." })
    }
    const transaction = await createNedarimTransaction({ ...attempt, installments }, cart)
    if (!await ledger.finishCreation(attempt.id, startedAt, transaction)) {
      return res.status(409).json({ message: "פרטי התשלום השתנו. יש לרענן את העמוד." })
    }
    prepared = await ledger.retrieveNedarimAttempt(attempt.id)
  }
  // Bit and bank transfer support single payments only; installments are card-only.
  const methods = Number(prepared.installments ?? 1) > 1 ? "Card" : NEDARIM_METHODS
  return res.json({ status: "pending", installments: Number(prepared.installments ?? 1), payment: {
    TransactionId: prepared.transaction_id, Key: prepared.transaction_key,
    Methods: methods, ButtonText: "תשלום",
  } })
}

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")
  const { attempt, ledger } = await context(req)
  if (attempt.paid_at && attempt.payment_id) return res.json({ status: "paid" })
  // Without verify=1 this is a cheap database poll for the signed callback.
  if ((req.query as Record<string, unknown> | undefined)?.verify !== "1") return res.json({ status: "pending" })
  // Ask Nedarim directly (rate limited per attempt). Only a provider-reported payment
  // that also matches authenticated history is recorded; the browser cannot supply it.
  const logger = req.scope.resolve("logger")
  let verdict: "paid" | "not_paid" | "unknown"
  try { verdict = await verifyWithNedarim(attempt, ledger, logger) }
  catch {
    logger.error(`[nedarim] Server-side verification failed for ${attempt.id}; investigate before retrying payment`)
    verdict = "unknown"
  }
  return res.json(verdict === "paid" ? { status: "paid" } : { status: "pending", provider: verdict })
}
