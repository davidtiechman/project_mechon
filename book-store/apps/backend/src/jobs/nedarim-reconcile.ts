import type { MedusaContainer } from "@medusajs/framework/types"
import { nedarimConfig, nedarimEnabled, validateNedarimHistoryPayment } from "../lib/nedarim"
import NedarimPaymentsService from "../modules/nedarim-payments/service"

export default async function reconcileNedarim(container: MedusaContainer) {
  if (!nedarimEnabled() || !process.env.NEDARIM_API_PASSWORD) return
  const ledger: NedarimPaymentsService = container.resolve("nedarimPayments")
  const logger = container.resolve("logger")
  const { mosad } = nedarimConfig()
  // Persisted lease: at most 6 requests/hour across replicas, even after failures/restarts.
  const lastId = await ledger.claimSync(mosad)
  if (lastId === undefined) return
  try {
    const params = new URLSearchParams({ Action: "GetHistoryJson", MosadId: mosad,
      ApiPassword: process.env.NEDARIM_API_PASSWORD, LastId: lastId, MaxId: "2000" })
    const response = await fetch(`https://matara.pro/nedarimplus/Reports/Manage3.aspx?${params}`, {
      signal: AbortSignal.timeout(12_000), redirect: "error",
    })
    if (!response.ok) throw new Error("History unavailable")
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error("Invalid Nedarim history response")
    let cursor = BigInt(lastId)
    for (const row of rows) {
      if (!/^\d+$/.test(String(row.TransactionId))) throw new Error("Invalid history ID")
      const rowId = BigInt(row.TransactionId)
      if (rowId > cursor) cursor = rowId
      const match = /^Mechon (ndp_[a-f0-9]{32})$/.exec(String(row.Comments || ""))
      if (!match) continue
      const [attempt] = await ledger.listNedarimAttempts({ id: match[1] })
      if (!attempt || attempt.paid_at || Number(row.Amount) <= 0 || row.KevaId) continue
      let payment
      try { payment = validateNedarimHistoryPayment(attempt, row) }
      catch {
        logger.error(`[nedarim] History payment mismatch for ${attempt.id}; manual investigation required`)
        continue
      }
      await ledger.recordPayment(attempt.id, payment.paymentId, payment.method)
      logger.info(`[nedarim] Recovered missing callback for ${attempt.id} from authenticated provider history`)
    }
    await ledger.updateNedarimSyncs({ id: mosad, last_id: cursor.toString() })
  } catch {
    // Never log the URL: its query contains the API password.
    logger.error("[nedarim] History reconciliation failed; check API credentials, permissions and provider availability")
  }
}

export const config = { name: "nedarim-reconcile", schedule: "*/10 * * * *" }
