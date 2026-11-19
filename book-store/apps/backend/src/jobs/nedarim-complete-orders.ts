import type { MedusaContainer } from "@medusajs/framework/types"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { activeNedarimSession, assertNedarimCart, loadNedarimCart } from "../lib/nedarim-checkout"
import { nedarimEnabled } from "../lib/nedarim"
import NedarimPaymentsService from "../modules/nedarim-payments/service"

export default async function completeNedarimOrders(container: MedusaContainer) {
  if (!nedarimEnabled()) return
  const ledger: NedarimPaymentsService = container.resolve("nedarimPayments")
  const logger = container.resolve("logger")
  const attempts = await ledger.listNedarimAttempts(
    { paid_at: { $ne: null }, processed_at: null, canceled_at: null },
    { take: 50, order: { updated_at: "ASC" } },
  )
  for (const attempt of attempts) {
    try {
      if (!attempt.cart_id) throw new Error("Payment has no cart")
      const cart = await loadNedarimCart(container, attempt.cart_id)
      if (!cart.completed_at) {
        assertNedarimCart(attempt, cart, activeNedarimSession(cart))
        await completeCartWorkflow(container).run({ input: { id: attempt.cart_id } })
      }
      const completed = await loadNedarimCart(container, attempt.cart_id)
      if (!completed.completed_at) throw new Error("Cart completion needs retry")
      await ledger.updateNedarimAttempts({ id: attempt.id, processed_at: new Date() })
    } catch {
      logger.error(`[nedarim] Paid attempt ${attempt.id} could not complete its order; retry pending, investigate if persistent`)
      // Persistent failures cannot monopolize the first batch and starve later paid orders.
      await ledger.deferCompletion(attempt.id)
    }
  }
}

export const config = { name: "nedarim-complete-orders", schedule: "* * * * *" }
