import { checkNedarimTransaction, InstallmentSplit, NedarimAttempt, retrieveNedarimHistoryPayment } from "./nedarim"

export type NedarimVerdict = "paid" | "not_paid" | "unknown"

type Ledger = { recordPayment(id: string, paymentId: string, method: string, split?: InstallmentSplit | null): Promise<void> }
type Logger = { error(message: string): void; warn?(message: string): void }

// Browsers poll every few seconds. Ask Nedarim about one attempt at most once per
// interval and share in-flight lookups, so polling cannot flood the provider.
export const NEDARIM_CHECK_INTERVAL_MS = 10_000
// History allows only 20 calls/hour per institution+IP, shared with reconciliation.
// After a failed history verification, wait much longer before trying it again.
export const NEDARIM_HISTORY_RETRY_MS = 5 * 60_000
const recent = new Map<string, { until: number; verdict: NedarimVerdict }>()
const inFlight = new Map<string, Promise<NedarimVerdict>>()

export function resetNedarimVerificationCache() { recent.clear(); inFlight.clear() }

/**
 * Server-side answer to "was this attempt paid?", for when the callback is late or lost.
 * - "paid": Nedarim reported a final payment ID AND authenticated history matched its
 *   comment, amount, currency and confirmation. The payment is recorded before returning.
 * - "not_paid": Nedarim reported that the transaction was not executed.
 * - "unknown": no reliable answer (network, unrecognized response, history unavailable).
 *   Callers must never treat "unknown" as a failure the customer may pay again for.
 */
export async function verifyWithNedarim(attempt: NedarimAttempt, ledger: Ledger, logger?: Logger, now = Date.now()): Promise<NedarimVerdict> {
  if (attempt.paid_at && attempt.payment_id) return "paid"
  if (!attempt.transaction_id) return "not_paid"
  const cached = recent.get(attempt.id)
  if (cached && now < cached.until) return cached.verdict
  const pending = inFlight.get(attempt.id)
  if (pending) return pending
  let retryAfter = NEDARIM_CHECK_INTERVAL_MS
  const lookup = (async (): Promise<NedarimVerdict> => {
    let state
    try { state = await checkNedarimTransaction(attempt.transaction_id!) }
    catch { return "unknown" }
    if (state.state === "not_paid") return "not_paid"
    let payment
    try { payment = await retrieveNedarimHistoryPayment(attempt, state.paymentId) }
    catch {
      retryAfter = NEDARIM_HISTORY_RETRY_MS
      logger?.error(`[nedarim] Provider reports payment ${state.paymentId} for ${attempt.id}, but history verification failed; awaiting callback or reconciliation`)
      return "unknown"
    }
    await ledger.recordPayment(attempt.id, payment.paymentId, payment.method, payment.split)
    if (attempt.canceled_at) logger?.error(`[nedarim] Recovered payment for replaced attempt ${attempt.id}; manual reconciliation required`)
    return "paid"
  })()
  inFlight.set(attempt.id, lookup)
  try {
    const verdict = await lookup
    recent.set(attempt.id, { until: now + retryAfter, verdict })
    if (recent.size > 2000) {
      for (const [id, entry] of recent) if (now >= entry.until) recent.delete(id)
    }
    return verdict
  } finally { inFlight.delete(attempt.id) }
}
