import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { nedarimConfig, parseNedarimCallback, validateNedarimPayment, verifyNedarimSignature } from "../../../../../lib/nedarim"
import NedarimPaymentsService from "../../../../../modules/nedarim-payments/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger")
  const config = nedarimConfig()
  const secrets = [config.secret, process.env.NEDARIM_WEBHOOK_PREVIOUS_SECRET || ""]
  if (!verifyNedarimSignature(req.rawBody, req.headers, secrets)) {
    logger.warn("[nedarim] Rejected unsigned, expired, or invalid callback")
    return res.status(401).json({ message: "Invalid signature" })
  }
  // The HMAC, rather than a caller-controlled X-Forwarded-For header, authenticates the sender.
  // Apply the provider IP allowlist at the trusted reverse proxy/firewall when available.
  if (!["18.196.146.117", "18.194.219.73"].includes(req.ip || "")) {
    logger.warn("[nedarim] Signed callback received via an unrecognized source IP; check proxy/provider IP configuration")
  }
  const ledger: NedarimPaymentsService = req.scope.resolve("nedarimPayments")
  let attempt
  try { attempt = await ledger.retrieveNedarimAttempt(req.params.attempt_id) }
  catch { return res.status(404).json({ message: "Unknown payment attempt" }) }
  if (!attempt.transaction_id || req.params.transaction_id !== attempt.transaction_id) {
    return res.status(400).json({ message: "Transaction mismatch" })
  }
  // Parse only the exact bytes that were verified, never an independently transformed body.
  let data: Record<string, unknown>
  try { data = parseNedarimCallback(req.rawBody!, attempt.transaction_id) }
  catch { return res.status(400).json({ message: "Invalid JSON" }) }
  if (data.Status === "Error") {
    logger.info(`[nedarim] Payment attempt ${attempt.id} requires another try or additional fields`)
    return res.json({ received: true })
  }
  let payment
  try { payment = validateNedarimPayment(attempt, data, config.mosad) }
  catch {
    logger.error(`[nedarim] Callback payment mismatch for ${attempt.id}; requires investigation`)
    return res.status(400).json({ message: "Payment mismatch" })
  }
  // Commit the fact BEFORE acknowledging. A background job retries order completion after crashes.
  // The unique payment_id constraint and compare-and-set make duplicate callbacks idempotent.
  await ledger.recordPayment(attempt.id, payment.paymentId, payment.method)
  if (attempt.canceled_at) logger.error(`[nedarim] Received payment for replaced attempt ${attempt.id}; manual reconciliation required`)
  return res.json({ received: true })
}
