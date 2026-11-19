import type { ExecArgs } from "@medusajs/framework/types"
import { nedarimConfig, retrieveNedarimHistoryPayment } from "../lib/nedarim"
import NedarimPaymentsService from "../modules/nedarim-payments/service"
import completeNedarimOrders from "../jobs/nedarim-complete-orders"

// Server-side recovery only: medusa exec ./src/scripts/recover-nedarim-payment.ts ATTEMPT_ID PAYMENT_ID
// Never records a payment from browser data, email content or a supplied JSON file.
export default async function recoverNedarimPayment({ container, args }: ExecArgs) {
  const [attemptId, paymentId] = args
  if (!/^ndp_[a-f0-9]{32}$/.test(attemptId || "") || !/^[1-9]\d*$/.test(paymentId || "")) {
    throw new Error("Provide the server payment attempt ID and provider history payment ID")
  }
  const ledger: NedarimPaymentsService = container.resolve("nedarimPayments")
  const attempt = await ledger.retrieveNedarimAttempt(attemptId)
  if (attempt.canceled_at || !attempt.cart_id || !attempt.transaction_id) throw new Error("This attempt requires manual investigation")
  if (attempt.paid_at) {
    if (attempt.payment_id !== paymentId) throw new Error("A different payment is already recorded")
  } else {
    if (!process.env.NEDARIM_API_PASSWORD?.trim()) throw new Error("Configure NEDARIM_API_PASSWORD with history read permission")
    const { mosad } = nedarimConfig()
    if (await ledger.claimSync(mosad) === undefined) throw new Error("History rate limit is active; retry after the ten-minute lease expires")
    const payment = await retrieveNedarimHistoryPayment(attempt, paymentId)
    await ledger.recordPayment(attempt.id, payment.paymentId, payment.method)
  }
  await completeNedarimOrders(container)
  const completed = await ledger.retrieveNedarimAttempt(attempt.id)
  if (!completed.processed_at) throw new Error("Payment verified and saved; order completion is pending and will retry automatically")
  container.resolve("logger").info(`[nedarim] Verified existing payment ${paymentId} and completed the order for ${attempt.id}; no new charge was created`)
}
